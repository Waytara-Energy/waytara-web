import { EnergyPlannerInput, RecommendationResult } from "@/types";

/**
 * Plain, explainable pure TS rule set for recommending WayTara energy packages.
 * Evaluates property parameters, monthly consumption, backup urgency, and EV plans.
 */
export function calculateRecommendation(
  input: EnergyPlannerInput
): RecommendationResult {
  const bill = Math.max(1000, Number(input.monthlyBill) || 6000);
  const isCommercial =
    input.propertyType === "commercial_building" ||
    input.propertyType === "fleet_depot";
  const isApartment = input.propertyType === "apartment";
  const hasEvOrPlanning =
    input.evPlans === "have_one_ev" ||
    input.evPlans === "planning_soon" ||
    input.evPlans === "commercial_fleet";
  const needsBackup =
    input.backupNeeds === "critical_only" ||
    input.backupNeeds === "full_home" ||
    input.backupNeeds === "heavy_commercial";

  let packageId = "home_independence";
  let packageName = "Home Independence";
  let tagline = "Total energy autonomy with 24/7 solar + smart battery backup.";
  let solarSizeKw = 5;
  let batterySizeKwh = 10;
  let hasEvCharger = false;
  let minCost = 450000;
  let maxCost = 720000;
  let estimatedBackupHours: number | string = "12 - 18 Hours";
  const rationale: string[] = [];

  // Commercial / Fleet Branch
  if (isCommercial) {
    packageId = "business_energy";
    packageName = "Business Energy";
    tagline =
      "Commercial-grade solar & BESS engineered to drop peak demand charges.";
    solarSizeKw = Math.max(20, Math.round(bill / 1500));
    batterySizeKwh = Math.max(30, Math.round(solarSizeKw * 1.5));
    hasEvCharger = input.evPlans === "commercial_fleet";
    minCost = Math.round(solarSizeKw * 48000 + batterySizeKwh * 25000);
    maxCost = Math.round(minCost * 1.35);
    estimatedBackupHours =
      input.backupNeeds === "heavy_commercial"
        ? "8 - 14 Hours Industrial"
        : "Critical Operations Cover";

    rationale.push(
      `Sized for commercial sanctioned load: ${solarSizeKw} kW PV array to offset daytime peak kVA demand.`
    );
    if (hasEvCharger) {
      rationale.push(
        "Includes workplace & commercial fleet high-speed multi-gun AC charging ports."
      );
    }
    rationale.push(
      "Direct eligibility for 40% accelerated tax depreciation (Sec 32) & ESG reporting."
    );
  }
  // Apartment Society Branch
  else if (isApartment) {
    packageId = "apartment_energy";
    packageName = "Apartment Energy";
    tagline =
      "Smart common-area solar + individualized EV charging infrastructure.";
    solarSizeKw = Math.max(15, Math.round(bill / 1200));
    batterySizeKwh = 20;
    hasEvCharger = hasEvOrPlanning;
    minCost = Math.round(solarSizeKw * 52000 + 350000);
    maxCost = Math.round(minCost * 1.3);
    estimatedBackupHours = "Elevators & Water Pumps Full Backup";

    rationale.push(
      `Engineered for society common area loads (~${solarSizeKw} kW) to slash RWA maintenance charges.`
    );
    rationale.push(
      "Sub-metered EV charging distribution with individual resident RFID billing."
    );
  }
  // EV Focused Residential Branch
  else if (hasEvOrPlanning) {
    packageId = "ev_ready_home";
    packageName = "EV Ready Home";
    tagline = "Charge your EV directly on free sunshine with dynamic solar-sync.";
    solarSizeKw = Math.max(6, Math.round(bill / 1100) + 3);
    batterySizeKwh = needsBackup ? 15 : 10;
    hasEvCharger = true;
    minCost = Math.round(580000 + (solarSizeKw - 6) * 45000);
    maxCost = Math.round(minCost * 1.32);
    estimatedBackupHours = needsBackup ? "14 - 20 Hours" : "8 - 12 Hours";

    rationale.push(
      `Expanded ${solarSizeKw} kW array provides ~40-60 km daily zero-cost EV driving range.`
    );
    rationale.push(
      "Integrated Smart 7.4 kW Level-2 charger with automatic solar-surplus routing."
    );
    rationale.push(
      "Dynamic load balancing safeguards main breaker against tripping during vehicle charging."
    );
  }
  // Pure High-Savings Solar (No critical backup)
  else if (!needsBackup && input.budgetTier === "value_optimized") {
    packageId = "home_essential";
    packageName = "Home Essential";
    tagline =
      "Grid-tied high efficiency solar designed to slash monthly electricity bills by up to 90%.";
    solarSizeKw = Math.max(3, Math.round(bill / 1400));
    batterySizeKwh = 0;
    hasEvCharger = false;
    minCost = Math.round(solarSizeKw * 55000);
    maxCost = Math.round(minCost * 1.25);
    estimatedBackupHours = "Grid-Tied (Battery Expandable)";

    rationale.push(
      `Right-sized ${solarSizeKw} kW grid-interactive array offsets up to 90% of electricity bills.`
    );
    rationale.push(
      "Zero battery maintenance overhead with future storage-ready hybrid architecture."
    );
  }
  // Default: Home Independence (Solar + Battery Storage)
  else {
    packageId = "home_independence";
    packageName = "Home Independence";
    tagline = "Total energy autonomy with 24/7 solar + smart battery backup.";
    solarSizeKw = Math.max(4, Math.round(bill / 1300));
    batterySizeKwh = input.backupNeeds === "full_home" ? 15 : 10;
    hasEvCharger = false;
    minCost = Math.round(450000 + (solarSizeKw - 4) * 45000);
    maxCost = Math.round(minCost * 1.3);
    estimatedBackupHours =
      input.backupNeeds === "full_home" ? "16 - 24 Hours" : "10 - 16 Hours";

    rationale.push(
      `Continuous uninterrupted power with ${batterySizeKwh} kWh safe LFP battery storage.`
    );
    rationale.push(
      "Sub-20ms instant automatic switchover — computers and ACs stay online without blinking."
    );
    rationale.push(
      "Single-point WayTara warranty covering solar, inverter, and storage under one phone call."
    );
  }

  // Generation and Financial Computations
  // Average ~1450 kWh per kW per year in Indian conditions
  const yearlyGenerationKwh = Math.round(solarSizeKw * 1450);
  // Average commercial/residential blended tariff of ₹8.5/kWh
  const avgTariff = isCommercial ? 10.5 : 8.5;
  const yearlySavingsInr = Math.round(
    Math.min(yearlyGenerationKwh * avgTariff, bill * 12 * 0.92)
  );

  const midpointCost = (minCost + maxCost) / 2;
  const paybackPeriodYears = Number(
    Math.max(2.5, Math.min(5.5, midpointCost / (yearlySavingsInr || 50000))).toFixed(1)
  );

  // ~0.82 kg CO2 saved per kWh solar in India
  const co2OffsetTonnesPerYear = Number(
    ((yearlyGenerationKwh * 0.82) / 1000).toFixed(1)
  );

  return {
    packageId,
    packageName,
    tagline,
    solarSizeKw,
    batterySizeKwh,
    hasEvCharger,
    investmentRange: {
      minFormatted: formatInrLakhs(minCost),
      maxFormatted: formatInrLakhs(maxCost),
    },
    yearlyGenerationKwh,
    yearlySavingsInr,
    estimatedBackupHours,
    paybackPeriodYears,
    rationale,
    co2OffsetTonnesPerYear,
  };
}

function formatInrLakhs(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}
