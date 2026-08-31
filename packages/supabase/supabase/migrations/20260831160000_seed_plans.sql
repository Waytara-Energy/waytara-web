-- Task 8.1 needs a real plan to pick when building a quotation, and
-- `plans` was empty. `plans` is the ongoing monitoring/dashboard
-- subscription tier (Basic/Pro/Advance — what Tasks 9/10 gate customer
-- dashboard modules on via `features`), separate from the one-time
-- hardware/installation cost captured in a quotation's own
-- `pricing_breakdown`. Seeding a reasonable first pass here; Task 11's
-- plan catalog editor is where these get tuned for real.

insert into waytara.plans (code, name, max_devices, price_monthly, price_yearly, features, is_active)
values
  (
    'basic',
    'Basic',
    3,
    499,
    4990,
    '{"monitoring": false, "performance": false, "analytics": false, "reports": false, "instrument_settings": false}'::jsonb,
    true
  ),
  (
    'pro',
    'Pro',
    10,
    1499,
    14990,
    '{"monitoring": true, "performance": true, "analytics": true, "reports": false, "instrument_settings": false}'::jsonb,
    true
  ),
  (
    'advance',
    'Advance',
    null,
    2999,
    29990,
    '{"monitoring": true, "performance": true, "analytics": true, "reports": true, "instrument_settings": true}'::jsonb,
    true
  )
on conflict (code) do nothing;
