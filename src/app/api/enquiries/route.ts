import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveEnquiry, getAllEnquiries } from "@/lib/enquiries";
import { sendAcknowledgment } from "@/lib/email";
import { EnquiryRecord } from "@/types";

// Validation schema for incoming enquiry payloads
const enquirySchema = z.object({
  id: z.string().optional(),
  status: z.enum(["partial", "completed"]).default("partial"),
  source: z.enum(["energy_planner", "contact_page", "package_card"]).default("energy_planner"),
  segment: z.enum(["home", "commercial", "ev_fleet"]).optional(),
  packageId: z.string().optional(),
  formData: z
    .object({
      propertyType: z.enum([
        "independent_house",
        "villa",
        "apartment",
        "commercial_building",
        "fleet_depot",
      ]).optional(),
      state: z.string().optional(),
      monthlyBill: z.coerce.number().optional(),
      backupNeeds: z.enum(["none", "critical_only", "full_home", "heavy_commercial"]).optional(),
      evPlans: z.enum(["no_ev", "have_one_ev", "planning_soon", "commercial_fleet"]).optional(),
      roofType: z.enum([
        "rcc_flat",
        "tiled_slope",
        "metal_sheet",
        "elevated_structure",
      ]).optional(),
      budgetTier: z.enum([
        "value_optimized",
        "balanced_independence",
        "premium_maximum_capacity",
      ]).optional(),
      fullName: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      pincode: z.string().optional(),
    })
    .optional(),
  recommendation: z.record(z.any()).optional(),
  contact: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      city: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = enquirySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload: Partial<EnquiryRecord> = {
      ...parseResult.data,
      formData: parseResult.data.formData as any,
    };

    const savedRecord = await saveEnquiry(payload);

    let acknowledgment = null;
    if (
      savedRecord.status === "completed" &&
      (savedRecord.contact?.email || savedRecord.contact?.phone)
    ) {
      acknowledgment = await sendAcknowledgment(savedRecord);
    }

    return NextResponse.json({
      success: true,
      data: savedRecord,
      acknowledgment,
    });
  } catch (error: any) {
    console.error("API /api/enquiries error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process enquiry",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const enquiries = await getAllEnquiries();
  return NextResponse.json({
    success: true,
    count: enquiries.length,
    data: enquiries,
  });
}
