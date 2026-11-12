#!/usr/bin/env python3
"""
The daily work log: one CSV with every piece of work, and a workbook with one sheet for each day.

Columns: Date | Area | Page / section | Event.
Areas: Landing page, Customer dashboard, Admin page, Firmware, Supabase, Backend, Documentation.

  python scripts/work_log.py sync                      add the commits that are not in the log yet, then rebuild the workbook
  python scripts/work_log.py add --date 2026-11-12 --area Supabase --section "Migration" --event "What was done"
                                                       a row for work that is not a commit (a live database change, flashing a board)
  python scripts/work_log.py build                     rebuild docs/work-log/WORK_LOG.xlsx from the CSV
  python scripts/work_log.py export --date 2026-11-12 --out day.xlsx    a workbook with that one day's sheet
  python scripts/work_log.py export --all --out all.xlsx                a workbook with every day's sheet
  python scripts/work_log.py body --date 2026-11-12    the e-mail body (HTML) for one day; "body --all" for the every-day mail
  python scripts/work_log.py days                      JSON: every date that has rows, oldest first
  python scripts/work_log.py day --date 2026-11-12     JSON: that day's rows ([area, section, event], in the CSV's order); used by update-work-log-excel.ps1

The commits are read from git (the author's date, in India time). Each file a commit changed is placed in an area by its path, and the page or section
is named from the file; a commit that touched two areas gives one row in each. Only the standard library is used.
"""
import argparse
import csv
import datetime as dt
import hashlib
import os
import re
import subprocess
import sys
import zipfile
from collections import Counter, OrderedDict
from xml.sax.saxutils import escape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOG_DIR = os.path.join(ROOT, "docs", "work-log")
CSV_PATH = os.path.join(LOG_DIR, "work-log.csv")
SEEN_PATH = os.path.join(LOG_DIR, "logged-commits.txt")
XLSX_PATH = os.path.join(LOG_DIR, "WORK_LOG.xlsx")
HEADER = ["Date", "Area", "Page / section", "Event"]
AREAS = ["Landing page", "Customer dashboard", "Admin page", "Firmware", "Supabase", "Backend", "Documentation"]
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))

# ------------------------------------------------------------------------------------------------ placing a file in an area

IGNORED_PREFIXES = (
    "pnpm-lock.yaml", "package.json", ".gitignore", ".env.example", "turbo.json", "pnpm-workspace.yaml", ".claude/", "test-results/",
    "docs/WEBSITE_PROGRESS.md", "docs/work-log/", "apps/web/package.json", "apps/admin/package.json", "packages/ui/package.json",
    "packages/supabase/package.json", "apps/web/tsconfig.json", "apps/admin/tsconfig.json",
)
# Libraries of the public website; every other library of the web app is the server side of the product.
LANDING_LIBS = re.compile(r"^(seo|site-search|landing-sample|public-weather|time-ago|site\b|address|geo)")
WEB_SERVER_FILES = ("apps/web/src/proxy.ts", "apps/web/next.config.ts", "apps/admin/src/proxy.ts", "apps/admin/next.config.ts")


SPECIAL_NAMES = {"llms.txt": "llms.txt (AI guide)", "robots.ts": "robots.txt", "sitemap.ts": "Sitemap", "page.tsx": "Home page", "layout.tsx": "Site layout", "globals.css": "Site styles"}


def clean(text):
    """Without the control characters that neither a spreadsheet nor XML can hold."""
    return re.sub(r"[^\x09\x0a\x0d\x20-\ud7ff\ue000-\ufffd\U00010000-\U0010ffff]", "", text)


def humanise(name):
    if name in SPECIAL_NAMES:
        return SPECIAL_NAMES[name]
    name = re.sub(r"\.(test|spec)(\.[a-z0-9]+)$", r"\2", name)  # a test belongs to the thing it tests
    name = re.sub(r"\.[a-z0-9]+$", "", name)
    name = re.sub(r"^\[(.+)\]$", r"\1", name)
    text = re.sub(r"[-_]+", " ", name).strip()
    return (text[:1].upper() + text[1:]) if text else name


def route_name(parts):
    """The route of a file under src/app: the first folder that is not a route group, as 'Name page'."""
    for part in parts:
        if part.startswith("(") or part.startswith("[") or part in ("api",):
            continue
        if part.endswith((".tsx", ".ts", ".css", ".txt", ".png", ".ico")):
            return humanise(part)
        if part == "page.tsx":
            return "Home page"
        return humanise(part) + " page"
    return "Site"


def classify(path):
    """(area, section) of one changed file, or None when the file says nothing about the work (lock files, the log itself)."""
    if path.startswith(IGNORED_PREFIXES) or path.endswith("pnpm-lock.yaml"):
        return None
    p = path.split("/")
    base = p[-1]
    if path.startswith("apps/admin/"):
        if "/api/" in path or path in WEB_SERVER_FILES or "/src/lib/" in path:
            return ("Backend", "Admin: " + humanise(base))
        if "/src/app/" in path:
            return ("Admin page", route_name(p[p.index("app") + 1:]))
        return ("Admin page", humanise(base) if "/components/" in path else "Admin app")
    if path.startswith("apps/setup/"):
        return ("Firmware", "Gateway setup app")
    if path.startswith("packages/supabase/supabase/"):
        if "/migrations/" in path:
            return ("Supabase", "Migration: " + humanise(re.sub(r"^\d+_", "", base)))
        if "/tests/" in path:
            return ("Supabase", "Database tests")
        return ("Supabase", humanise(base))
    if path.startswith("packages/supabase/scripts/"):
        return ("Firmware", humanise(base))
    if path.startswith(("packages/supabase/", "packages/cadence/", "packages/config/")):
        return ("Backend", p[1].capitalize() + " package: " + humanise(base))
    if path.startswith("packages/ui/"):
        return ("Customer dashboard", humanise(base))
    if path.startswith("apps/web/"):
        if "/api/" in path or path in WEB_SERVER_FILES:
            return ("Backend", "API / server: " + humanise(base))
        if "/src/app/dashboard" in path:
            return ("Customer dashboard", route_name(p[p.index("dashboard"):]) if len(p) > p.index("dashboard") + 1 else "Dashboard")
        if "/src/components/dashboard/" in path:
            return ("Customer dashboard", humanise(base))
        if "/src/lib/" in path:
            name = base
            if LANDING_LIBS.match(name):
                return ("Landing page", humanise(name))
            return ("Backend", "Library: " + humanise(name))
        if "/src/app/" in path:
            return ("Landing page", route_name(p[p.index("app") + 1:]))
        if "/src/components/sections/" in path:
            return ("Landing page", humanise(base) + " section")
        if "/src/components/" in path:
            return ("Landing page", humanise(base))
        if "/public/" in path:
            return ("Landing page", "Images and media" if re.search(r"\.(png|jpe?g|webp|mp4|svg|ico)$", base) else humanise(base))
        return ("Landing page", humanise(base))
    if path.startswith(("e2e/", ".github/", "scripts/")):
        return ("Backend", "Tests and deploy: " + humanise(base))
    if path.startswith("docs/"):
        return ("Documentation", humanise(base))
    return ("Backend", humanise(base))


def event_text(subject):
    subject = re.sub(r"^[a-z]+(\([^)]*\))?!?:\s*", "", subject.strip())
    if len(subject) > 1 and subject[1].isupper():  # "iPhone", "eSIM": leave the brand's own spelling
        return subject
    return (subject[:1].upper() + subject[1:]) if subject else subject


# ------------------------------------------------------------------------------------------------ the commits

def git_commits():
    """Every non-merge commit, oldest first: (hash, date in India, subject, [files])."""
    out = subprocess.run(
        ["git", "log", "--reverse", "--no-merges", "--name-only", "--format=@@%H%x1f%aI%x1f%s"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
    commits = []
    for block in out.split("@@")[1:]:
        lines = block.split("\n")
        h, iso, subject = lines[0].split("\x1f", 2)
        when = dt.datetime.fromisoformat(iso).astimezone(IST)
        commits.append((h, when, subject, [l for l in lines[1:] if l.strip()]))
    return commits


def rows_for(commit):
    h, when, subject, files = commit
    by_area = OrderedDict()
    for f in files:
        placed = classify(f)
        if placed:
            by_area.setdefault(placed[0], Counter())[placed[1]] += 1
    if not by_area:
        by_area["Documentation" if any(f.startswith("docs/") for f in files) else "Backend"] = Counter({"Notes": 1})
    rows = []
    for area, sections in by_area.items():
        top = [s for s, _ in sections.most_common(3)]
        rows.append([when.date().isoformat(), area, clean("; ".join(top)), clean(event_text(subject))])
    return rows


# ------------------------------------------------------------------------------------------------ the CSV

def read_rows():
    if not os.path.exists(CSV_PATH):
        return []
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader, None)
        return [r for r in reader if len(r) == 4]


def write_rows(rows):
    os.makedirs(LOG_DIR, exist_ok=True)
    rows = sorted(rows, key=lambda r: r[0])  # stable: the order within a day is kept
    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:  # the BOM lets Excel open it as UTF-8
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)
    return rows


def read_seen():
    if not os.path.exists(SEEN_PATH):
        return set()
    with open(SEEN_PATH, encoding="utf-8") as f:
        return {l.strip() for l in f if l.strip()}


def cmd_sync(_args):
    seen = read_seen()
    rows = read_rows()
    new_rows, new_hashes = [], []
    for c in git_commits():
        if c[0] in seen:
            continue
        new_rows.extend(rows_for(c))
        new_hashes.append(c[0])
    rows = write_rows(rows + new_rows)
    with open(SEEN_PATH, "a", encoding="utf-8") as f:
        f.writelines(h + "\n" for h in new_hashes)
    build_workbook(rows, XLSX_PATH)
    print(f"{len(new_hashes)} new commits, {len(new_rows)} new rows; {len(rows)} rows on {len({r[0] for r in rows})} days")


def cmd_add(args):
    if args.area not in AREAS:
        sys.exit("area must be one of: " + ", ".join(AREAS))
    date = args.date or dt.datetime.now(IST).date().isoformat()
    rows = write_rows(read_rows() + [[date, args.area, clean(args.section), clean(args.event)]])
    build_workbook(rows, XLSX_PATH)
    print(f"added to {date}; {len(rows)} rows")


# ------------------------------------------------------------------------------------------------ the workbook (a minimal .xlsx, no libraries)

def col_letter(i):
    return "ABCD"[i]


def sheet_xml(rows):
    widths = [12, 20, 42, 110]
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths))
    body = []
    for ri, row in enumerate([HEADER] + rows, start=1):
        cells = "".join(
            f'<c r="{col_letter(ci)}{ri}" t="inlineStr" s="{1 if ri == 1 else 0}"><is><t xml:space="preserve">{escape(value)}</t></is></c>'
            for ci, value in enumerate(row)
        )
        body.append(f'<row r="{ri}">{cells}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        f"<cols>{cols}</cols><sheetData>{''.join(body)}</sheetData>"
        f'<autoFilter ref="A1:D{len(rows) + 1}"/>'
        "</worksheet>"
    )


STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FF15803D"/><bgColor indexed="64"/></patternFill></fill></fills>'
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="2">'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>'
    "</cellXfs>"
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    "</styleSheet>"
)


def build_workbook(rows, out_path):
    """One sheet for each day (named by its date), oldest first. Returns the number of sheets."""
    days = OrderedDict()
    for r in sorted(rows, key=lambda r: r[0]):
        days.setdefault(r[0], []).append(r)
    if not days:
        days[dt.datetime.now(IST).date().isoformat()] = []
    names = list(days.keys())
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   + "".join(f'<Override PartName="/xl/worksheets/sheet{i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(len(names)))
                   + "</Types>")
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr("xl/workbook.xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                   + "".join(f'<sheet name="{escape(n)}" sheetId="{i + 1}" r:id="rId{i + 1}"/>' for i, n in enumerate(names))
                   + "</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   + "".join(f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i + 1}.xml"/>' for i in range(len(names)))
                   + f'<Relationship Id="rId{len(names) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        z.writestr("xl/styles.xml", STYLES)
        for i, n in enumerate(names):
            z.writestr(f"xl/worksheets/sheet{i + 1}.xml", sheet_xml(days[n]))
    return len(names)


def cmd_build(_args):
    rows = read_rows()
    print(f"{build_workbook(rows, XLSX_PATH)} sheets, {len(rows)} rows -> {XLSX_PATH}")


def cmd_export(args):
    rows = read_rows()
    if not args.all:
        if not args.date:
            sys.exit("give --date YYYY-MM-DD or --all")
        rows = [r for r in rows if r[0] == args.date]
    n = build_workbook(rows, args.out)
    sha = hashlib.sha256(open(args.out, "rb").read()).hexdigest()
    print(f"{n} sheets, {len(rows)} rows -> {os.path.abspath(args.out).replace(os.sep, '/')}\nsha256 {sha}")


# ------------------------------------------------------------------------------------------------ the e-mail body

def cmd_body(args):
    rows = read_rows()
    td = 'style="padding:6px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:13px"'
    th = 'style="padding:6px 10px;text-align:left;background:#15803d;color:#fff;font-size:13px"'
    if args.all:
        days = OrderedDict()
        for r in rows:
            days.setdefault(r[0], Counter())[r[1]] += 1
        lines = [f"<p>The work log from the start to {max(days)}: {len(rows)} entries on {len(days)} days. The attached workbook has one sheet for each day (oldest first), and the CSV has everything in one table.</p>",
                 f'<table style="border-collapse:collapse"><tr><th {th}>Date</th><th {th}>Entries</th><th {th}>Areas</th></tr>']
        for d, c in days.items():
            areas = ", ".join(f"{a} ({n})" for a, n in c.most_common())
            lines.append(f"<tr><td {td}>{d}</td><td {td}>{sum(c.values())}</td><td {td}>{escape(areas)}</td></tr>")
        lines.append("</table>")
    else:
        day = [r for r in rows if r[0] == args.date]
        lines = [f"<p>The work log for {args.date}: {len(day)} entries. The attached workbook has the day's sheet.</p>"]
        if day:
            lines.append(f'<table style="border-collapse:collapse"><tr><th {th}>Area</th><th {th}>Page / section</th><th {th}>Event</th></tr>')
            for _, area, section, event in day:
                lines.append(f"<tr><td {td}>{escape(area)}</td><td {td}>{escape(section)}</td><td {td}>{escape(event)}</td></tr>")
            lines.append("</table>")
        else:
            lines.append("<p>No work was recorded for this day.</p>")
    print("\n".join(lines))


def cmd_days(_args):
    import json
    print(json.dumps(sorted({r[0] for r in read_rows()})))


def cmd_day(args):
    import json
    print(json.dumps([r[1:] for r in read_rows() if r[0] == args.date], ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sync").set_defaults(fn=cmd_sync)
    a = sub.add_parser("add")
    a.add_argument("--date")
    a.add_argument("--area", required=True)
    a.add_argument("--section", required=True)
    a.add_argument("--event", required=True)
    a.set_defaults(fn=cmd_add)
    sub.add_parser("build").set_defaults(fn=cmd_build)
    sub.add_parser("days").set_defaults(fn=cmd_days)
    d = sub.add_parser("day")
    d.add_argument("--date", required=True)
    d.set_defaults(fn=cmd_day)
    e = sub.add_parser("export")
    e.add_argument("--date")
    e.add_argument("--all", action="store_true")
    e.add_argument("--out", required=True)
    e.set_defaults(fn=cmd_export)
    b = sub.add_parser("body")
    b.add_argument("--date")
    b.add_argument("--all", action="store_true")
    b.set_defaults(fn=cmd_body)
    args = ap.parse_args()
    if args.cmd == "body" and not args.all and not args.date:
        sys.exit("give --date YYYY-MM-DD or --all")
    args.fn(args)


if __name__ == "__main__":
    main()
