-- A tariff is not one rate. Indian domestic bills are SLABS (the first units are cheap, later ones dearer), some states give free
-- units (Tamil Nadu's 200, Karnataka's Gruha Jyothi, ...), some bill every two months, and there is electricity duty on top. The
-- Cost & Savings section works a customer's bill out from these, month by month, with and without solar.
--
--   slabs               [{ "upTo": 100, "rate": 3.5 }, { "upTo": 300, "rate": 6 }, { "upTo": null, "rate": 8 }]
--                       bands per bill, lowest first, charged telescopically; the last band has "upTo": null. Empty/null = no bands,
--                       every unit costs rate_per_kwh.
--   billing_months      1, or 2 where the utility bills every two months (Tamil Nadu). Bands and free units are per bill.
--   duty_pct            electricity duty, % of the energy charge.
--   surcharge_per_kwh   Rs per unit added to every unit (fuel adjustment / wheeling) where the order lists one.
--   free_units          units free in each bill under a state scheme.
--   free_units_cap      use more than this in a bill and the scheme changes (null = never).
--   free_units_over_cap the free units that still apply past the cap (Tamil Nadu 100; Punjab/Telangana 0 = the whole bill is charged).
--
-- rate_per_kwh stays as the headline "typical" Rs per unit (the average cost of a unit at 250 units a month, free units left out):
-- it is what the page shows first, what an EV charger's cost uses, and what the daily job compares to spot a change.
-- Fixed (demand) charges and meter rent are not modelled: they are the same with and without solar, so they cannot change a saving.

alter table waytara.electricity_tariffs
  add column if not exists slabs               jsonb,
  add column if not exists billing_months      smallint not null default 1 check (billing_months in (1, 2)),
  add column if not exists duty_pct            numeric  not null default 0 check (duty_pct >= 0 and duty_pct <= 50),
  add column if not exists surcharge_per_kwh   numeric  not null default 0 check (surcharge_per_kwh >= 0 and surcharge_per_kwh <= 20),
  add column if not exists free_units          numeric  not null default 0 check (free_units >= 0 and free_units <= 1000),
  add column if not exists free_units_cap      numeric  check (free_units_cap is null or free_units_cap >= 0),
  add column if not exists free_units_over_cap numeric  not null default 0 check (free_units_over_cap >= 0);

alter table waytara.electricity_tariffs
  add constraint electricity_tariffs_slabs_is_array check (slabs is null or jsonb_typeof(slabs) = 'array');

comment on column waytara.electricity_tariffs.slabs is 'Telescopic bands per bill: [{upTo, rate}], last upTo null. Null = a single rate (rate_per_kwh).';
comment on column waytara.electricity_tariffs.rate_per_kwh is 'Headline typical Rs per unit (average cost at 250 units a month, free units excluded).';
