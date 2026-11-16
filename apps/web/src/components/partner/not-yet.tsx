import Link from "next/link";

/** What a page shows to someone who is not approved yet: a plain line and the way back, not an error. */
export function NotYet({ what }: { what: string }) {
  return (
    <main className="fluid-container pb-20">
      <div className="mx-auto max-w-xl">
        <h1 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight text-theme-primary">{what}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-theme-secondary">This page opens once your application is approved. Until then, you can follow it and send what we ask for on your Application page.</p>
        <p className="mt-5 text-sm">
          <Link href="/partner/portal" className="text-theme-primary underline underline-offset-4">
            Go to your application
          </Link>
        </p>
      </div>
    </main>
  );
}
