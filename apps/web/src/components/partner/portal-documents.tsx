"use client";

import {
  SECTIONS,
  categorySubject,
  documentRequirements,
  memberKey,
  memberRequirements,
  memberSubject,
  workCategories,
  type OnboardingData,
  type OnboardingDocument,
} from "@waytara/supabase/partner-onboarding";
import { DocumentError, DocumentSlot, ExtraDocuments, useDocumentStore } from "./file-slots";

/**
 * An approved partner's documents, in the same groups as their onboarding: add a renewed licence, a new team member's ID and certificate, more photos of work; open
 * or download what was sent; take a file back. A newly added file or person is checked by the team before it counts.
 */
export function PortalDocuments({ partnerType, data, initialDocuments }: { partnerType: string | null; data: OnboardingData; initialDocuments: OnboardingDocument[] }) {
  const store = useDocumentStore("/api/partner/track/me", initialDocuments);
  const reqs = documentRequirements(partnerType, data);
  const mine = store.docs.filter((d) => d.subject === "partner").map((d) => d.kind);
  const groups = SECTIONS.map((s) => ({ ...s, reqs: reqs.filter((r) => r.section === s.id) })).filter((g) => g.reqs.length > 0);

  return (
    <div className="space-y-10">
      <DocumentError store={store} />
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`pd-${g.id}`} className="space-y-3">
          <h3 id={`pd-${g.id}`} className="text-sm font-semibold text-theme-primary">
            {g.label}
          </h3>
          {g.reqs.map((r) => (
            <DocumentSlot key={r.kind} store={store} kind={r.kind} label={r.label} hint={r.hint} need={r.need} satisfied={r.anyOf ? r.anyOf.some((k) => mine.includes(k)) : undefined} />
          ))}
        </section>
      ))}

      {data.team.members.length > 0 && (
        <section aria-labelledby="pd-team" className="space-y-5">
          <div>
            <h3 id="pd-team" className="text-sm font-semibold text-theme-primary">
              Team
            </h3>
            <p className="mt-1 text-xs text-theme-muted">Our team verifies each person before they count as part of your team. Add or remove people under Profile and team.</p>
          </div>
          {data.team.members.map((m, i) => {
            const subject = memberSubject(memberKey(m, i));
            const theirs = store.docs.filter((d) => d.subject === subject).map((d) => d.kind);
            return (
              <div key={subject} className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  <span className="font-medium text-theme-primary">{m.name || `Person ${i + 1}`}</span>
                  {m.role ? ` · ${m.role}` : ""}
                </p>
                {memberRequirements(m.needsLicence).map((r) => (
                  <DocumentSlot key={r.kind} store={store} kind={r.kind} subject={subject} label={r.label} hint={r.hint} need={r.need} satisfied={r.anyOf ? r.anyOf.some((k) => theirs.includes(k)) : undefined} />
                ))}
              </div>
            );
          })}
        </section>
      )}

      <section aria-labelledby="pd-work" className="space-y-3">
        <h3 id="pd-work" className="text-sm font-semibold text-theme-primary">
          Past work and photos
        </h3>
        {workCategories(partnerType).map((c) => (
          <DocumentSlot key={c.id} store={store} kind={c.kind} subject={categorySubject(c.id)} label={c.label} need="optional" hint={c.kind === "survey_record" ? "Survey reports, sketches or measurement sheets" : "Photos of finished work"} />
        ))}
        <DocumentSlot store={store} kind="completion_certificate" label="Completion certificates and references" need="optional" />
      </section>

      <section aria-labelledby="pd-other" className="space-y-3">
        <h3 id="pd-other" className="text-sm font-semibold text-theme-primary">
          Anything else
        </h3>
        {/* only the kinds that have no slot of their own above */}
        <ExtraDocuments store={store} kinds={["certificate", "trade_certificate", "training_certificate", "licence", "other"].filter((k) => !reqs.some((r) => r.kind === k))} shownKinds={reqs.map((r) => r.kind)} />
      </section>
    </div>
  );
}
