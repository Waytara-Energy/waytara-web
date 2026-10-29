-- Plans: what an admin can now set on each monitoring tier besides its price and feature gates.
--
--   tagline / badge / highlights   the words around the plan ("For small homes", "Most popular", a list of bullet points)
--   offer_*                        an offer on the price: a label, a percent or flat amount, which price it applies to, until when
--   tax_mode / gst_rate            how GST relates to the price entered: 'included' (the price already contains GST), 'excluded' (GST is
--                                  added on top; the default, as quotations do today) or 'none' (no GST on this plan)
--
-- All columns have defaults, so every existing plan keeps behaving as it does now (no offer, GST added on top at 18 %). Nothing reads the new
-- columns yet except the admin's Plans page.

alter table waytara.plans
  add column if not exists tagline text,
  add column if not exists badge text,
  add column if not exists highlights jsonb not null default '[]'::jsonb,
  add column if not exists offer_enabled boolean not null default false,
  add column if not exists offer_label text,
  add column if not exists offer_type text not null default 'percent',
  add column if not exists offer_value numeric(12, 2) not null default 0,
  add column if not exists offer_applies_to text not null default 'both',
  add column if not exists offer_valid_until date,
  add column if not exists tax_mode text not null default 'excluded',
  add column if not exists gst_rate numeric(5, 2) not null default 18;

alter table waytara.plans drop constraint if exists plans_offer_type_check;
alter table waytara.plans add constraint plans_offer_type_check check (offer_type in ('percent', 'flat'));

alter table waytara.plans drop constraint if exists plans_offer_applies_to_check;
alter table waytara.plans add constraint plans_offer_applies_to_check check (offer_applies_to in ('both', 'monthly', 'yearly'));

alter table waytara.plans drop constraint if exists plans_offer_value_check;
alter table waytara.plans add constraint plans_offer_value_check check (offer_value >= 0 and (offer_type <> 'percent' or offer_value <= 100));

alter table waytara.plans drop constraint if exists plans_tax_mode_check;
alter table waytara.plans add constraint plans_tax_mode_check check (tax_mode in ('included', 'excluded', 'none'));

alter table waytara.plans drop constraint if exists plans_gst_rate_check;
alter table waytara.plans add constraint plans_gst_rate_check check (gst_rate >= 0 and gst_rate <= 100);

alter table waytara.plans drop constraint if exists plans_highlights_array_check;
alter table waytara.plans add constraint plans_highlights_array_check check (jsonb_typeof(highlights) = 'array');
