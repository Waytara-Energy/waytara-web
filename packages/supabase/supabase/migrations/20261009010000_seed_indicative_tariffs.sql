-- A first set of rates so the Cost & Savings section has something to work from. EVERY row here is "indicative", not
-- verified: there is no single reliable all-India source, and the public summaries disagree with each other (the same state
-- is shown with different slab ranges on different sites). Each rate below is the midpoint of the residential slab range on
-- which the summaries I could compare agree, rounded to 5 paise; it is a typical rate for a home in that state, not what any
-- one bill is charged. The customer is told it is an estimate. The admin app's Electricity rates page is where each one is
-- replaced by the regulator's order (confidence "verified" + the order's link) as it is checked.
--
-- States not listed have no rate yet: their customers' savings use the rate set on their own account until one is added.
-- Commercial and industrial rates are only given where a source could be found (Tamil Nadu commercial).

insert into waytara.electricity_tariffs (state, category, rate_per_kwh, effective_from, source_url, source_note, confidence) values
  ('Tamil Nadu', 'residential', 8.00, '2025-07-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of the Rs 4.95-11.05 domestic range on propertygeek.in. A tariff-document summary of TNERC order no. 6 of 2025 gives Rs 4.95-12.15 and two other sites give different ranges; the first 100 units are subsidised. Not checked against the order - replace it.', 'indicative'),
  ('Tamil Nadu', 'commercial', 8.70, '2025-07-01', 'https://www.mercomindia.com/tamil-nadu-hikes-fy-2026-electricity-tariffs-by-3-16', 'Mercom confirms the 3.16% rise for commercial consumers from 1 July 2025. The Rs 8.55-8.80 range comes from a web-search summary of a page I could not identify, and other sites give different figures - UNVERIFIED, replace with the order.', 'indicative'),
  ('Delhi', 'residential', 5.50, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of Rs 3.00-8.00; the first 200 units are free under the state scheme. Replace with the DERC order.', 'indicative'),
  ('Punjab', 'residential', 5.85, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 4.25-7.45 (three summary sites give 4.10-7.50, 4.49-7.30 and 4.19-7.52). The Tribune reports PSERC kept domestic tariffs unchanged for 2025-26. Replace with the order.', 'indicative'),
  ('Haryana', 'residential', 4.65, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 2.20-7.10. Replace with the HERC order.', 'indicative'),
  ('Rajasthan', 'residential', 6.35, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of Rs 4.75-7.95. Replace with the RERC order.', 'indicative'),
  ('Kerala', 'residential', 5.85, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 3.30-8.40. Replace with the KSERC order.', 'indicative'),
  ('Odisha', 'residential', 4.75, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 3.00-6.50. Replace with the OERC order.', 'indicative'),
  ('Assam', 'residential', 6.45, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 5.00-7.90. Replace with the AERC order.', 'indicative'),
  ('West Bengal', 'residential', 6.95, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 5.00-8.90. Replace with the WBERC order.', 'indicative'),
  ('Karnataka', 'residential', 6.25, '2025-04-01', 'https://www.propertygeek.in/electricity-rate-per-unit-in-india/', 'Midpoint of about Rs 4.15-8.35. Replace with the KERC order.', 'indicative')
on conflict (state, category, effective_from) do nothing;
