/**
 * The standard WayTara e-mail: one layout for every message the apps send, so they all look like they come from the same company.
 *
 * Built the way e-mail has to be built, not the way a web page is: tables, inline styles, a 600 px card, system fonts after the brand font, an image with a full
 * address, and a button made of a table cell (it still shows in Outlook). It also makes the plain-text version from the same pieces, so the two never drift apart.
 *
 * A message is described, not drawn: a title, a greeting, some blocks (paragraphs, a code, a few facts, a quoted message, a note, a list), at most one button, and
 * why the person is getting it. The layout adds the logo, the help line, the quick links, the legal links, the address and the copyright.
 */

export type MailBlock =
  | { type: "p"; text: string }
  /** A short bold heading for a group of lines. */
  | { type: "h"; text: string }
  /** A one-time code, large and spaced out. */
  | { type: "code"; code: string }
  /** Label and value pairs, in two columns with hairlines. */
  | { type: "facts"; rows: [string, string][] }
  /** A message someone wrote, with a label above it. */
  | { type: "quote"; label: string; text: string }
  /** A smaller, quieter line (a reassurance, a "if this was not you"). */
  | { type: "note"; text: string }
  | { type: "list"; items: string[] };

export interface MailLayoutInput {
  /** The line an inbox shows next to the subject. Keep it under about 90 characters. */
  preheader?: string;
  /** The heading inside the e-mail. */
  title: string;
  /** "Hi Priya," and so on. Leave out for a message that is not addressed to one person. */
  greeting?: string;
  blocks: MailBlock[];
  button?: { label: string; url: string };
  /** Why the person gets this e-mail ("You get this because ..."). */
  why?: string;
  /** Which quick links go in the footer. */
  audience?: "customer" | "team" | "public";
  /** The public website (the logo and the legal links come from here). */
  siteUrl?: string;
  /** The admin app, for the team's quick link. */
  adminUrl?: string;
}

export interface RenderedMail {
  html: string;
  text: string;
}

const DEFAULT_SITE = "https://www.waytaraenergy.com";
const SUPPORT_EMAIL = "hello@waytaraenergy.com";
/** Where a reply to any WayTara e-mail goes (set as Reply-To on every message, so a reply reaches a mailbox people read). */
export const MAIL_REPLY_TO = SUPPORT_EMAIL;
const WHATSAPP = "https://wa.me/919363021195";
const ADDRESS = "WayTara Energy LLP, No. 6 & 7, 3rd Floor, 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai - 600 004, India";

const EMERALD = "#059669";
const INK = "#0f172a";
const BODY = "#475569";
const MUTED = "#64748b";
const HAIRLINE = "#e2e8f0";
const PAGE = "#f1f5f3";
const FONT = "Poppins,'Segoe UI',Helvetica,Arial,sans-serif";

/** Escapes text for HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const trim = (url: string) => url.replace(/\/+$/, "");

function quickLinks(audience: NonNullable<MailLayoutInput["audience"]>, site: string, admin: string | undefined): { label: string; href: string }[] {
  if (audience === "team") {
    return [
      ...(admin ? [{ label: "Admin app", href: admin }] : []),
      { label: "waytaraenergy.com", href: site },
    ];
  }
  if (audience === "public") {
    return [
      { label: "Energy planner", href: `${site}/planner` },
      { label: "Platform", href: `${site}/technology` },
      { label: "Support", href: `${site}/support` },
      { label: "WhatsApp", href: WHATSAPP },
    ];
  }
  return [
    { label: "My dashboard", href: `${site}/dashboard` },
    { label: "Support", href: `${site}/dashboard/support` },
    { label: "Settings", href: `${site}/dashboard/settings` },
    { label: "WhatsApp", href: WHATSAPP },
  ];
}

function blockHtml(b: MailBlock): string {
  switch (b.type) {
    case "p":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BODY}">${escapeHtml(b.text)}</p>`;
    case "h":
      return `<p style="margin:8px 0 8px;font-size:16px;font-weight:700;color:${INK}">${escapeHtml(b.text)}</p>`;
    case "code":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:16px 26px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${INK}">${escapeHtml(b.code)}</td></tr></table>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border-top:1px solid ${HAIRLINE}">${b.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:11px 16px 11px 0;border-bottom:1px solid ${HAIRLINE};font-size:14px;color:${MUTED};width:34%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:11px 0;border-bottom:1px solid ${HAIRLINE};font-size:14px;font-weight:600;color:${INK};vertical-align:top">${escapeHtml(v)}</td></tr>`
        )
        .join("")}</table>`;
    case "quote":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td style="border-left:3px solid ${EMERALD};padding:2px 0 2px 16px"><p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${MUTED}">${escapeHtml(b.label)}</p><p style="margin:0;font-size:15px;line-height:1.65;color:${INK};white-space:pre-line">${escapeHtml(b.text)}</p></td></tr></table>`;
    case "note":
      return `<p style="margin:0 0 16px;font-size:13px;line-height:1.65;color:${MUTED}">${escapeHtml(b.text)}</p>`;
    case "list":
      return `<ul style="margin:0 0 16px;padding:0 0 0 20px">${b.items.map((i) => `<li style="margin:0 0 6px;font-size:15px;line-height:1.65;color:${BODY}">${escapeHtml(i)}</li>`).join("")}</ul>`;
  }
}

function blockText(b: MailBlock): string {
  switch (b.type) {
    case "p":
    case "note":
      return b.text;
    case "h":
      return `${b.text}:`;
    case "code":
      return b.code;
    case "facts":
      return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    case "quote":
      return `${b.label}:\n"${b.text}"`;
    case "list":
      return b.items.map((i) => `- ${i}`).join("\n");
  }
}

/** Builds the HTML and the plain-text version of one e-mail from its pieces. */
export function renderMail(input: MailLayoutInput): RenderedMail {
  const site = trim(input.siteUrl || DEFAULT_SITE);
  const audience = input.audience ?? "customer";
  const links = quickLinks(audience, site, input.adminUrl ? trim(input.adminUrl) : undefined);
  const year = new Date().getFullYear();
  const preheader = input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${escapeHtml(input.preheader)}${"&nbsp;&zwnj;".repeat(30)}</div>` : "";

  const button = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 8px"><tr><td align="center" bgcolor="${EMERALD}" style="border-radius:999px;background:${EMERALD}"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(input.button.label)}</a></td></tr></table>`
    : "";

  const legal = [
    { label: "Privacy Policy", href: `${site}/privacy` },
    { label: "Terms of Service", href: `${site}/terms` },
  ];
  const a = (l: { label: string; href: string }) => `<a href="${escapeHtml(l.href)}" style="color:${MUTED};text-decoration:none">${escapeHtml(l.label)}</a>`;
  const sep = `<span style="color:#cbd5e1">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>@media only screen and (max-width:480px){.px{padding-left:24px!important;padding-right:24px!important}.wrap{padding:16px 8px!important}}</style><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${FONT}">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background:${PAGE}"><tr><td align="center" class="wrap" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:20px">
<tr><td align="center" style="padding:40px 40px 0"><a href="${escapeHtml(site)}" style="text-decoration:none"><img src="${escapeHtml(site)}/images/logo.png" width="150" alt="WayTara Energy" style="display:block;border:0;outline:none;height:auto;width:150px"></a></td></tr>
<tr><td class="px" style="padding:32px 48px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="40" height="4" bgcolor="${EMERALD}" style="background:${EMERALD};border-radius:4px;font-size:0;line-height:0">&nbsp;</td></tr></table><h1 style="margin:18px 0 0;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-.01em;color:${INK}">${escapeHtml(input.title)}</h1></td></tr>
<tr><td class="px" style="padding:20px 48px 0;font-family:${FONT}">${input.greeting ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${INK}">${escapeHtml(input.greeting)}</p>` : ""}${input.blocks.map(blockHtml).join("")}${button}<p style="margin:22px 0 0;font-size:15px;color:${BODY}">- The WayTara Team</p></td></tr>
<tr><td class="px" style="padding:36px 48px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${HAIRLINE};padding-top:24px;font-family:${FONT};font-size:13px;line-height:1.7;color:${MUTED}">Questions? Visit <a href="${escapeHtml(site)}/support" style="color:${EMERALD};font-weight:600;text-decoration:none">Support</a> or e-mail <a href="mailto:${SUPPORT_EMAIL}" style="color:${EMERALD};font-weight:600;text-decoration:none">${SUPPORT_EMAIL}</a>.</td></tr></table></td></tr>
<tr><td align="center" class="px" style="padding:22px 48px 0;font-family:${FONT};font-size:13px;line-height:2;color:${MUTED}">${links.map(a).join(sep)}</td></tr>
<tr><td align="center" class="px" style="padding:20px 48px 40px;font-family:${FONT};font-size:12px;line-height:1.75;color:#94a3b8">${input.why ? `${escapeHtml(input.why)}<br>` : ""}${legal.map(a).join(sep)}<br>${escapeHtml(ADDRESS)}<br>&copy; ${year} WayTara Energy LLP. All rights reserved.</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    input.title,
    "",
    input.greeting,
    input.greeting ? "" : undefined,
    ...input.blocks.flatMap((b) => [blockText(b), ""]),
    input.button ? `${input.button.label}: ${input.button.url}` : undefined,
    input.button ? "" : undefined,
    "- The WayTara Team",
    "",
    `Questions? ${site}/support or ${SUPPORT_EMAIL}`,
    links.map((l) => `${l.label}: ${l.href}`).join("\n"),
    "",
    input.why,
    ADDRESS,
    `© ${year} WayTara Energy LLP`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { html, text };
}
