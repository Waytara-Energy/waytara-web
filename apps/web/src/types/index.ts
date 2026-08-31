export type CustomerSegmentId = "home" | "commercial" | "ev_fleet";

export interface SolutionPackage {
  id: string;
  name: string;
  tagline: string;
  targetSegment: CustomerSegmentId;
  idealFor: string;
  solarCapacity: string;
  batteryCapacity: string;
  evCharging: string;
  inclusions: {
    title: string;
    description: string;
    icon: string;
  }[];
  priceRange: {
    min: number;
    max: number;
    formatted: string;
    factors: string;
  };
  expectedGeneration: string;
  backupHours: string;
  paybackPeriod: string;
  isPopular?: boolean;
}

export interface EnergyPlannerInput {
  propertyType: "independent_house" | "villa" | "apartment" | "commercial_building" | "fleet_depot";
  state: string;
  monthlyBill: number;
  backupNeeds: "none" | "critical_only" | "full_home" | "heavy_commercial";
  evPlans: "no_ev" | "have_one_ev" | "planning_soon" | "commercial_fleet";
  roofType: "rcc_flat" | "tiled_slope" | "metal_sheet" | "elevated_structure";
  budgetTier: "value_optimized" | "balanced_independence" | "premium_maximum_capacity";
  // Contact details captured at end
  fullName?: string;
  email?: string;
  phone?: string;
  pincode?: string;
}

export interface RecommendationResult {
  packageId: string;
  packageName: string;
  tagline: string;
  solarSizeKw: number;
  batterySizeKwh: number;
  hasEvCharger: boolean;
  investmentRange: {
    minFormatted: string;
    maxFormatted: string;
  };
  yearlyGenerationKwh: number;
  yearlySavingsInr: number;
  estimatedBackupHours: number | string;
  paybackPeriodYears: number;
  rationale: string[];
  co2OffsetTonnesPerYear: number;
}

export interface EnquiryRecord {
  id: string;
  createdAt: string;
  status: "partial" | "completed";
  source: "energy_planner" | "contact_page" | "package_card";
  segment?: CustomerSegmentId;
  packageId?: string;
  formData: Partial<EnergyPlannerInput>;
  recommendation?: Partial<RecommendationResult>;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
    message?: string;
  };
}
