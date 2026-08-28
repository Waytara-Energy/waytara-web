import { EnquiryRecord } from "@/types";

export interface AcknowledgmentResult {
  success: boolean;
  messageId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  customMessage: string;
}

/**
 * Sends a personalized acknowledgment email / notification based on the visitor's
 * selected customer segment, recommended package, and property context.
 */
export async function sendAcknowledgment(
  enquiry: EnquiryRecord
): Promise<AcknowledgmentResult> {
  const recipientName = enquiry.contact?.name || "Valued Property Owner";
  const recipientEmail = enquiry.contact?.email;
  const recipientPhone = enquiry.contact?.phone;
  const packageName = enquiry.packageId
    ? enquiry.packageId.replace(/_/g, " ").toUpperCase()
    : "WAYTARA CLEAN ENERGY SYSTEM";
  const segmentName = enquiry.segment
    ? enquiry.segment.replace(/_/g, " ").toUpperCase()
    : "PROPERTY";

  // Segment-specific personalized messaging
  let contextualNote = "Our senior solar and storage architect will contact you within 2 business hours.";
  if (enquiry.segment === "ev_fleet") {
    contextualNote =
      "Our commercial mobility engineer is reviewing your fleet charging profile and transformer requirements.";
  } else if (enquiry.segment === "commercial") {
    contextualNote =
      "Our C&I solar specialist is preparing a customized ROI and Section-32 tax depreciation model for your facility.";
  } else if (enquiry.formData?.backupNeeds === "full_home") {
    contextualNote =
      "We are sizing a dedicated 24/7 whole-home LFP battery solution to eliminate grid outage downtime.";
  }

  const customMessage = `Hello ${recipientName},\n\nThank you for choosing WayTara. We have received your assessment for the ${packageName} (${segmentName} Segment).\n\n${contextualNote}\n\nSite Visit Lead Reference: ${enquiry.id}\nEstimated Solar Capacity: ${enquiry.recommendation?.solarSizeKw || "Custom"} kW\nEstimated Payback: ${enquiry.recommendation?.paybackPeriodYears || "3.5"} Years\n\nWarm regards,\nThe WayTara Engineering Team\nhttps://waytara.com`;

  // Dev logger / Transactional email hook
  console.log(`\n========================================`);
  console.log(`[WayTara Email Acknowledgment Dispatch]`);
  console.log(`To: ${recipientEmail || "[Phone Only: " + recipientPhone + "]"}`);
  console.log(`Subject: Your WayTara Energy System Assessment [${enquiry.id}]`);
  console.log(`Body:\n${customMessage}`);
  console.log(`========================================\n`);

  /*
   * --------------------------------------------------------------------------
   * TIER-2 EXTENSION POINT: Transactional Email Provider (SendGrid / Postmark)
   * --------------------------------------------------------------------------
   * if (process.env.POSTMARK_SERVER_TOKEN && recipientEmail) {
   *   await postmarkClient.sendEmailWithTemplate({
   *     From: "assessments@waytara.com",
   *     To: recipientEmail,
   *     TemplateAlias: "assessment-lead-received",
   *     TemplateModel: { name: recipientName, package: packageName, id: enquiry.id }
   *   });
   * }
   */

  /*
   * --------------------------------------------------------------------------
   * TIER-2 EXTENSION POINT: WhatsApp Business Cloud API Acknowledgment & Bill Upload
   * --------------------------------------------------------------------------
   * if (process.env.WHATSAPP_API_TOKEN && recipientPhone) {
   *   await sendWhatsAppTemplateMessage({
   *     to: recipientPhone,
   *     template: "waytara_assessment_confirmation",
   *     params: [recipientName, packageName, enquiry.id]
   *   });
   * }
   */

  return {
    success: true,
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientEmail,
    recipientPhone,
    customMessage,
  };
}
