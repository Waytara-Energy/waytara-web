import { SITE } from "@/lib/site";

/** The contact lines at the foot of a legal page: plain text, no box. */
export function LegalContact({ question }: { question: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-theme-primary">{question}</p>
      <p className="mt-2">
        <a href={`mailto:${SITE.email}`} className="text-theme-highlight underline-offset-4 hover:underline">
          {SITE.email}
        </a>
        {" · "}
        <a href="tel:9363021195" className="text-theme-highlight underline-offset-4 hover:underline">
          {SITE.phone}
        </a>
      </p>
      <p className="mt-1 text-sm text-theme-muted">WayTara Energy LLP, No. 6 &amp; 7, 3rd Floor, 5th Street, Dr. Radhakrishnan Salai, Mylapore, Chennai - 600 004</p>
    </div>
  );
}
