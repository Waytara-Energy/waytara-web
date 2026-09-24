# @waytara/supabase

Shared Supabase client + auth helpers for `apps/web` and `apps/admin`. Every
query defaults to the `waytara` schema, not `public`.

## Usage

```ts
// Client Components
import { createClient } from "@waytara/supabase/client";

// Server Components / Server Actions / Route Handlers
import { createClient } from "@waytara/supabase/server";

// middleware.ts
import { createMiddlewareClient } from "@waytara/supabase/middleware";

// Auth guard (server-only)
import { getCurrentProfile } from "@waytara/supabase/auth";
```

`getCurrentProfile` only works inside the App Router render/action pipeline
(Server Components, Server Actions, Route Handlers) via `next/headers`
cookies — not in `middleware.ts`. In middleware, call
`getCurrentProfile(supabase)` with an explicit client from
`createMiddlewareClient` instead; see the example in
[`src/middleware.ts`](./src/middleware.ts). Each page is responsible for its
own `redirect()` on a missing/unauthorized profile — see any dashboard
`page.tsx` for the pattern.

## Environment variables

Consuming apps need (see the root `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Regenerating types

`src/types.ts` is generated from the live Supabase schema via the Supabase
CLI and committed. After any migration:

```bash
SUPABASE_PROJECT_ID=<your-project-ref> pnpm db:types
```

Requires CLI auth: either `npx supabase login` once on your machine, or a
`SUPABASE_ACCESS_TOKEN` (personal access token) exported in your shell.
`SUPABASE_PROJECT_ID` is the `<ref>` in `https://<ref>.supabase.co`.
