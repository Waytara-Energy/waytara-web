import { KeyRound, Laptop, Lock, Mail, ShieldCheck, TimerReset, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";

/** The protections the account really has (each one exists in the product today), in the order a person meets them. */
const PROTECTIONS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: KeyRound, title: "A one-time code", body: "Sent to your e-mail, it works once, lasts 10 minutes and allows 5 tries." },
  { icon: Mail, title: "A note when it changes", body: "We e-mail you the moment your password changes." },
  { icon: Lock, title: "Never readable", body: "Passwords are never stored in a readable form, and never sent by e-mail." },
  { icon: ShieldCheck, title: "Two-step sign-in", body: "Add a code from your authenticator app." },
  { icon: Laptop, title: "Your devices", body: "See your recent sign-ins and sign out of the others." },
  { icon: TimerReset, title: "Automatic sign-out", body: "Choose how long an idle session stays open." },
];

/** Keeps words like "e-mail" and "sign-out" in one piece: in a narrow column they would otherwise break after the hyphen. */
function Whole({ text }: { text: string }) {
  return (
    <>
      {text.split(/(e-mail|sign-ins?|sign-out|one-time|Two-step)/).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * The left half of the password-recovery pages: the sign-in page's layout (logo, a headline, edge to edge), with nothing that moves. One headline and the six ways the
 * account is protected, set out as a quiet grid with hairlines between the rows. Wide screens only. On a short screen the padding closes up and the one-line
 * explanations are dropped, so it always fits.
 */
export function SecurityShowcase() {
  const edge = "pl-16 pr-12 xl:pl-20 xl:pr-14";
  return (
    <div className="relative hidden w-1/2 flex-col overflow-hidden bg-theme-bg lg:flex">
      <div className={`${edge} pt-20 xl:pt-24 [@media(max-height:760px)]:pt-10`}>
        <Logo />
      </div>

      <div className={`${edge} login-slide mt-10 [@media(max-height:760px)]:mt-6`}>
        <h2 className="max-w-xl text-[clamp(2rem,3.4vw,3.75rem)] font-bold leading-[1.1] tracking-tight text-theme-primary">
          Your account,
          <span className="block text-primary-gradient">protected.</span>
        </h2>
        <p className="mt-5 max-w-xl text-[clamp(1rem,1.2vw,1.3rem)] leading-snug text-theme-secondary">
          <Whole text="Recovering a password takes a code that only your e-mail can receive, and we tell you the moment it changes." />
        </p>
      </div>

      <div className={`${edge} login-slide-late @container mt-auto pb-12 pt-10 xl:pb-16 [@media(max-height:760px)]:pb-6 [@media(max-height:760px)]:pt-6`}>
        {/* fills the width of its half: two columns, and three once the half is wide enough for them to read well */}
        <ul className="grid grid-cols-2 gap-x-12 @2xl:grid-cols-3 @2xl:gap-x-8">
          {PROTECTIONS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4 border-t border-theme-border py-6 @2xl:py-8 [@media(max-height:760px)]:py-3.5">
              <Icon className="mt-0.5 size-7 shrink-0 stroke-[1.5] 2xl:size-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <p className="text-[clamp(1rem,1vw,1.15rem)] font-semibold text-theme-primary">
                  <Whole text={title} />
                </p>
                <p className="mt-1 text-[clamp(0.875rem,0.85vw,1rem)] leading-snug text-theme-secondary [@media(max-height:760px)]:hidden">
                  <Whole text={body} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
