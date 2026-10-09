# Reports, subsidies, credits and tax: research for the customer Reports module

Researched 9 Oct 2026 for WayTara (customers in Tamil Nadu: homes, housing societies, businesses, industries, EV charging).
This is **research to design from, not legal or tax advice.** Each fact carries a confidence tag:

- **[confirmed]** several independent sources agree (still check the official page before showing a customer any amount).
- **[secondary]** one blog, news item or vendor page. Verify against the notification before relying on it.
- **[unverified]** I could not find it, or sources conflict. Needs a check with the named body.

Official portals for the checks: pmsuryaghar.gov.in, tnebltd.gov.in/usrp (state portal, per press), tnerc.gov.in, teda.in, beeindia.gov.in (RCO, PAT, carbon market), cercind.gov.in and recregistryindia.nic.in (RECs), cea.nic.in (emission factors), sebi.gov.in (BRSR), cbic.gov.in (GST).

---

## 1. What each customer type can claim

| Customer | Central | Tamil Nadu | Tax | Credits |
|---|---|---|---|---|
| **Home (residential)** | PM Surya Ghar subsidy: ₹30,000/kW up to 2 kW, ₹18,000 for the 3rd kW, capped at ₹78,000 (3 kW and above) [confirmed] | State top-up announced in the 2026-27 revised budget: ₹5,000 (up to 1 kW), ₹10,000 (up to 2 kW), ₹22,000 (3 kW and above), so ₹1 lakh for 3 kW [secondary: press reports of the launch] | none for a household | none practical (too small) |
| **Housing society / RWA** | ₹18,000/kW for common-facility load (lifts, lights, pumps, EV charging) up to 500 kW, counted at 3 kW per house; the connection must serve common facilities only [confirmed] | state top-up for societies: not found [unverified] | none | none practical |
| **Commercial** | no capital subsidy found for commercial rooftops [secondary: not stated explicitly by an official source] | TN net-metering / gross-metering only | 40% accelerated depreciation (see below); GST input credit | CCTS offset, I-REC, domestic REC: all marginal at rooftop size (section 5) |
| **Industrial** | as commercial, plus obligations: RCO (renewable consumption obligation), PAT, BRSR for listed firms | as commercial | as commercial | as commercial, plus RCO compliance by self-use or RECs |
| **EV charging owner** | PM E-DRIVE public-charger subsidy, but eligibility is government bodies, CPSUs and states/UTs and their PSUs (not a private owner directly) [secondary] | TN EV Policy 2023: 25% capital subsidy on equipment (public fast chargers up to ₹10 lakh, slow chargers up to ₹1 lakh) and demand-charge relief [secondary; amendments recommended, not confirmed notified] | GST on EVs (not researched) | Verra VM0038 for EV charging (needs scale) |

Farmers (PM-KUSUM) were out of scope.

---

## 2. Residential and RWA: PM Surya Ghar

**Flow** [confirmed, from several guides; the portal wording may have changed]:
1. Apply on the national portal (state, discom, consumer number, mobile, e-mail). One source says the registration step was removed and the consumer applies directly; check the live flow.
2. Discom feasibility approval (sanctioned load, transformer capacity).
3. Installation by a vendor registered with the discom, using **DCR (domestic content) modules and ALMM-listed equipment** (subsidy projects only; private non-subsidy projects are lighter) [secondary].
4. Vendor uploads plant details; consumer applies for the net meter.
5. Discom installs the net meter, inspects, and the portal produces the **commissioning certificate/report**.
6. Consumer uploads bank details (cancelled cheque); subsidy is expected within about 30 days [secondary].

**Documents** [secondary]: Aadhaar, latest electricity bill, property proof, cancelled cheque/passbook, photograph, technical specification of panels and inverter, site photos after installation, discom net-meter certificate, joint inspection report, DCR report.

**Formats:** all of these are portal-generated or discom/vendor-issued. WayTara does not produce the official forms; it can produce an **evidence pack** that makes the claim easy (see section 7).

**Tamil Nadu:** a state integrated portal (tnebltd.gov.in/usrp) is reported to cover application, central and state subsidy, vendor and meter. The discom is now TNPDCL (older guides still say TANGEDCO). I found no official TNPDCL/TNERC checklist or fee schedule: [unverified].

**Net metering (TN):** gross and net feed-in are available to all consumer categories under the 2019 policy and 2021 GISS regulations; 2024 draft regulations are not confirmed in force; settlement period and year-end treatment for commercial/industrial: [unverified] (one vendor says monthly). WayTara's own tariff model (monthly billing, carry-forward until April) must be re-checked against the order.

---

## 3. Commercial and industrial: tax and obligations

**Accelerated depreciation** [secondary, vendor blogs agree on 40%]:
- Solar plants sit in a block with a **40% first-year rate on written-down value** (Income-tax Act s.32 with the depreciation appendix). A contested extra 20% (for manufacturers or for late-year commissioning) is not safe to assume. The 180-day rule (reduced first-year rate if used under 180 days) is my recollection; verify.
- The Income-tax Act, 2025 replaces the 1961 Act from April 2026, so section numbers may have changed. **A chartered accountant must confirm** entity type, ownership model and commissioning date.
- What a customer needs to submit: the fixed-asset register entry (cost, date put to use), the depreciation schedule, and the audit report depreciation clause. WayTara can supply the **cost, commissioning date, and a depreciation schedule worksheet**, not the filing.

**GST** [secondary]: 5% on solar modules and inverters, 18% on structures and cables; blended EPC rate depends on the invoice split; registered businesses claim input credit. Confirm on the latest CBIC notification.

**RCO (Renewable Consumption Obligation)** for *designated consumers* (energy-intensive units above a BEE threshold) [secondary; final notification unclear]:
- Obligation as a share of electricity consumption, rising year by year (one summary: about 29.9% to 43.3% from 2024-25 to 2029-30, with sub-quotas), met by own renewable generation (**behind-the-meter solar now counts**), RECs, or buy-out.
- Reporting forms (BEE templates): **Form D** (RCO compliance: target in MU, compliance in MU, surplus/deficit, RECs, buy-out) and **Form C** (holding-company declaration). Draft dates: energy accounts by 31 July, compliance report by 31 October [draft; unverified].

**PAT scheme / ESCerts** (separate track for designated consumers) [secondary]: **Form 1** (energy and production profile), **Form A** with **Form B** (performance assessment, certified by an accredited energy auditor), **Form D** (compliance). Do not mix with RCO.

**BRSR Core (SEBI), listed companies** [secondary, from SEBI Annexure I]: Scope 2 = purchased energy × emission factor, per the GHG Protocol; energy footprint attribute: total energy, renewable share, intensity. The renewable share must be **measured consumption**, not contracted. Scope 2 and the energy attribute must come from **one reconciled dataset**. GHG Protocol asks for both location-based and market-based Scope 2.

---

## 4. EV charging

- **PM E-DRIVE** [secondary]: about 72,300 public chargers planned; support is highest for government premises, 80% on upstream infrastructure at other sites, with BEE benchmark costs; eligible applicants are government bodies, CPSUs, states/UTs and their PSUs. Payments in stages (conflicting reports). Charger standards per the Ministry of Power guidelines.
- **Tamil Nadu EV Policy 2023** [secondary]: 25% capital subsidy on equipment, demand-charge cuts (75% for two years, 50% for the next two, per one source), at least three chargers per public station, a GO requiring EV charging in new buildings. A technical committee has recommended amendments [unverified status].
- **Reports a charging owner needs:** sessions, energy delivered, uptime, utilisation, revenue, tariff compliance, and the proof of eligibility the scheme or discom asks for (invoices, installation certificate, commissioning date).
- **Carbon credits for EV charging:** Verra VM0038 exists (credits come from displaced fossil-vehicle emissions, solar is only the supply). Needs scale; version status unclear.

---

## 5. Carbon credits and energy credits: what is realistic

- **CCTS (India Carbon Credit Trading Scheme)**: compliance mechanism (obligated entities) and an **offset mechanism** (voluntary projects get Carbon Credit Certificates). Process: register on the Indian Carbon Market portal with a **Project Design Document** (objectives, technology, boundary, baseline, monitoring), 30-day public comment, third-party validation by a BEE-accredited verification agency, monitoring against the registered plan, periodic verification, BEE issuance [secondary]. **No rooftop-solar methodology found; rules for renewables were still pending in March 2026** [unverified]. Double claiming with subsidies/RECs is a likely concern.
- **Domestic REC (CERC 2022 regulations)**: eligible entities include renewable generators and captive stations; a condition around concessional charges/banking appeared in the draft; an older consultancy page gives a **250 kW minimum**, which would exclude most rooftops [unverified]. A 2026 amendment added virtual PPAs and multipliers.
- **I-REC (international)**: India's local issuer is **ICX** (IEX subsidiary) since September 2024; rooftop rules, minimum size and fees in India not found [unverified]. Useful for corporate market-based Scope 2.
- **Verra/Gold Standard**: fixed fees are large against one rooftop's credits (illustration, my assumptions: 100 kW gives about 140 MWh a year, roughly 100 credits; Verra's issuance levy about $0.23 per credit, registration about $3,750, verification review about $5,000, validators and consultants extra). Only **aggregation** (many sites) can pay. Gold Standard has distributed-unit and micro-scale routes.
- **Conclusion for the product:** do not promise customers carbon revenue. Build an **MRV-ready dataset** (metered generation, calibration/ownership records, monthly statement) so an aggregator or future scheme can use it.

**Emission factor (important for every CO₂ figure):** CEA CO₂ Baseline Database (latest found: Version 22.0, August 2026). A news item reports FY 2023-24: renewable-adjusted weighted average **0.727 tCO₂/MWh**, combined margin 0.757, build margin 0.552 [secondary]. **Our app uses 0.82 kg/kWh** (`lib/environmental-impact.ts`), older and higher. Read Table S-1 of the current CEA guide, then store the factor with its version and year and show it on every report.

---

## 6. Report catalogue WayTara can generate

Data we already hold: inverter and charger readings (15-min, hourly, daily rollups), energy counters (PV, load, import, export, battery), EV sessions, device status and downtime (heartbeat), alerts and faults, maintenance tickets, site/device details, the tariff model (slabs, free units, duty, net-metering).

### A. Operational (every customer)
1. **Monthly/annual energy statement**: generation, consumption, import, export, net, self-use %, self-sufficiency %.
2. **Daily/weekly/monthly generation report** (exists as CSV/PDF) with peak, average and per-string split.
3. **Specific yield (kWh/kWp)** and **Capacity Utilisation Factor** = kWh ÷ (kWp × hours): the figure discoms and lenders ask for. Needs kWp per site.
4. **Performance ratio** and **actual vs expected** (needs irradiance, e.g. a clear-sky or satellite model) and **soiling/degradation trend**.
5. **System availability / uptime %** from the heartbeat (online, device unreachable, offline minutes): strong for O&M and for EV chargers.
6. **Fault and alert history**, **maintenance history**, **warranty and service due**.
7. **Battery report**: cycles, state of health, round-trip efficiency, throughput.
8. **Grid report**: import, export, net, outages/voltage and frequency excursions.

### B. Financial
9. **Bill with and without solar** (tariff model), **monthly savings**, cumulative savings, **payback/ROI/IRR** (needs the invoice cost and subsidy received).
10. **Net-metering settlement statement**: units exported, imported, banked, expected credit, aligned to the discom bill. Needs the discom bill as input to reconcile.
11. **Subsidy tracker**: applied, approved, received, with dates and documents.
12. **Depreciation worksheet** (commercial/industrial) and **GST input credit summary** from invoices.
13. **EV economics**: cost per km vs petrol/diesel, charging cost, revenue per charger.
14. **Levelised cost of solar vs grid tariff**.

### C. Environmental and sustainability
15. **CO₂ avoided** (location-based factor with version and year) and trees equivalent (label as an estimate).
16. **Scope 2 summary**: location-based and market-based (with certificates).
17. **BRSR Core extract**: total electricity, renewable share, energy intensity, Scope 2 inputs, from one reconciled dataset.
18. **RCO worksheet**: consumption (MU), target, behind-the-meter solar (MU), shortfall.
19. **Carbon/REC MRV dataset** (monthly metered generation, ownership, meter calibration record): marked "inverter-measured, not revenue-grade".

### D. Compliance and subsidy packs (PDF + CSV, one click)
20. **PM Surya Ghar evidence pack**: system size and specification, commissioning date, generation since commissioning, photos, discom certificate attachment.
21. **Annual generation certificate** for banks, the discom, state agencies.
22. **EV charger public-scheme report**: uptime, sessions, energy, tariff.
23. **Industrial energy report** (inputs for PAT Form 1 and energy audits).

### E. Comparison reports
- **Period over period**: this month vs last month and vs the same month last year, with the weather caveat.
- **Site vs site** (multi-site customers, e.g. Guindy vs Waytara Office): kWh/kWp, CUF, self-use, savings, uptime.
- **Device vs device**: inverter vs inverter, string vs string (PV1 vs PV2), charger vs charger.
- **Actual vs expected** and **with vs without solar/battery**.
- **EV vs fuel**, **grid tariff vs solar cost**.
- **Peer benchmark** (customers of similar size and region), only once we have enough data and consent.

### By customer category: emphasis
- **Home**: simple monthly statement, savings, subsidy status, net-metering units, CO₂/trees.
- **RWA**: common-area energy, **per-flat allocation** of solar and EV energy, bill allocation, subsidy evidence.
- **Commercial**: demand (kVA) and time-of-day analysis, peak shaving, power factor, depreciation worksheet, ESG summary.
- **Industrial**: load profile, RCO/PAT/BRSR inputs, energy-audit pack, Scope 2.
- **EV owner**: sessions, utilisation, revenue, uptime, scheme-eligibility evidence.

---

## 7. Format and trust requirements for every report

- **Outputs:** PDF (customer, signed footer), CSV/Excel (auditors, CA), a ZIP **evidence pack** with a manifest and file hashes. Scheduled monthly e-mail. A stable report ID and version.
- **Disclosures on every page:** period, time zone (IST), data source, **completeness %**, which numbers are measured vs estimated, tariff version, emission-factor version, and the line "inverter-measured, not DISCOM revenue-grade metering".
- **Methodology page** per report type (formulas, assumptions).
- **Official forms stay official:** subsidy, GST, income-tax and BEE forms are filed by the customer or their vendor/CA on the official portals; WayTara supplies the data and a ready worksheet.

## 8. Gaps in our platform before these reports are credible
- Per site: kWp, panel count, commissioning date, sanctioned load (kW/kVA), consumer number, tariff category, discom, subsidy status, vendor.
- **Time-of-day and demand tariffs** (commercial/industrial) are not modelled yet.
- Irradiance/weather data for expected-vs-actual.
- Discom bill upload or entry to reconcile net metering.
- Invoices and costs for ROI and depreciation.
- Inverter counters are not revenue-grade: reports for subsidy or credits must say so, and some programmes need the discom's bidirectional-meter data instead.
- Update the CO₂ factor and store its version.
- Heartbeat history (status changes with timestamps) for availability reports: today only the current status is stored.

## 9. Suggested build order
1. **Report engine foundation**: report records (ID, version, period, completeness), PDF + CSV + evidence pack, disclosures, the tariff-based cost and savings (same as Performance), the corrected CO₂ factor.
2. **Core set**: items 1, 2, 3, 5, 9, 10, 15 and the comparison reports (period over period, site vs site).
3. **Category packs**: RWA allocation, commercial ToD/demand, EV owner pack, subsidy evidence pack, depreciation and GST worksheet.
4. **Compliance exports**: BRSR Core extract, RCO worksheet, PAT inputs, MRV dataset, once the official templates and rules are verified.

## 10. Verification checklist before building the compliance parts
- [ ] Read the live PM Surya Ghar portal flow and the TN state portal checklist.
- [ ] Get the TNERC final GISS regulations (net/gross metering, settlement, banking).
- [ ] CA confirms depreciation rate, extra 20%, 180-day rule, and the new Income-tax Act sections.
- [ ] CBIC notification for solar and EV GST rates.
- [ ] BEE: final RCO notification, current Form D/C versions, deadlines; CCTS offset procedure for renewables.
- [ ] ICX: rooftop I-REC registration, minimum size, fees. CERC: domestic REC eligibility and size.
- [ ] CEA Table S-1 (v22.0) for the emission factor.
- [ ] MHI/MoP: charger scheme eligibility for private owners; TN EV policy amendments.

## Sources (as searched)
PM Surya Ghar: housing.com, servotech.in, freyrenergy.com, kissht.com, heavengreenenergy.com, publicservicesmap.in, cag.org.in consumer manual, jbvnl.co.in CFA structure. Tamil Nadu: dtnext.in (TN Budget 2026, solar subsidy launch), energetica-india.net, solarsquare.in, mercomindia.com (TNERC billing, generic tariff), prayaspune.org (draft TNERC GISS 2024). Tax: solarsquare.in, bridgewaypower.in, heavengreenenergy.com, quickestimate.co. CCTS: solarquarter.com, ksandk.com, khaitanco.com, lawrbit.com. REC: nishithdesai.com, cercind.gov.in comments, anert.gov.in, solarquarter.com (2026 amendment), trackingstandard.org (ICX). EV: vajiramandravi.com, outlookbusiness.com, emobilityplus.com, bolt.earth, dtnext.in, itdp.in. Corporate: sebi.gov.in Annexure I (BRSR Core), nseindia.com, greensutra.in, indiaghgp.org. RCO/PAT: beeindia.gov.in (forms), renewablewatch.in, powerline.net.in. Carbon: verra.org (VM0038, fees), globalgoals.goldstandard.org, cea.nic.in (baseline user guides), wri.org.
