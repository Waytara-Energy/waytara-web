"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ShieldCheck } from "lucide-react";

interface AssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedSegment?: string;
  packageDetails?: {
    name?: string;
    solarKw?: string;
    batteryKwh?: string;
  };
}

export function AssessmentModal({
  open,
  onOpenChange,
  preselectedSegment,
  packageDetails,
}: AssessmentModalProps) {
  const [contactName, setContactName] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPincode, setContactPincode] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [isSubmittingLead, setIsSubmittingLead] = React.useState(false);
  const [leadSubmitted, setLeadSubmitted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLead(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: contactName,
          phone: contactPhone,
          email: contactEmail,
          pincode: contactPincode,
          source: "solutions_page",
          segment: preselectedSegment,
          packageId: packageDetails?.name,
          website,
        }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Something went wrong. Please try again.");
      }

      setLeadSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setLeadSubmitted(false);
      setSubmitError(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:p-8 rounded-3xl bg-theme-surface border border-theme-border shadow-2xl">
        <DialogHeader className="text-left pb-3 border-b border-theme-border">
          <DialogTitle className="text-xl font-bold text-theme-primary">
            Book Engineering Site Assessment
          </DialogTitle>
          <DialogDescription className="text-xs text-theme-secondary pt-1">
            {packageDetails ? (
              <span>
                Lock in your tailored blueprint for{" "}
                <strong>{packageDetails.name}</strong> (
                {packageDetails.solarKw} Solar • {packageDetails.batteryKwh}{" "}
                Storage).
              </span>
            ) : (
              <span>
                Schedule an on-site feasibility study with a certified WayTara
                Power Systems Engineer.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!leadSubmitted ? (
          <form onSubmit={handleLeadSubmit} className="space-y-4 pt-2">
            {/* Honeypot — off-screen, never focusable/visible to real visitors */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="solWebsite">Website</label>
              <input
                id="solWebsite"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {submitError && (
              <div className="rounded-xl border border-theme-border bg-red-500/10 px-3 py-2.5 text-xs text-red-500">
                {submitError}
              </div>
            )}

            <div>
              <Label
                htmlFor="solName"
                className="text-xs font-semibold text-theme-secondary"
              >
                Full Name *
              </Label>
              <Input
                id="solName"
                required
                placeholder="e.g. Rahul Sharma"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-10 text-xs mt-1 bg-theme-bg"
              />
            </div>

            <div>
              <Label
                htmlFor="solPhone"
                className="text-xs font-semibold text-theme-secondary"
              >
                Mobile Number (for engineering dispatch) *
              </Label>
              <Input
                id="solPhone"
                required
                type="tel"
                placeholder="+91 98765 43210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-10 text-xs mt-1 bg-theme-bg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="solEmail"
                  className="text-xs font-semibold text-theme-secondary"
                >
                  Email Address
                </Label>
                <Input
                  id="solEmail"
                  type="email"
                  placeholder="name@domain.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="h-10 text-xs mt-1 bg-theme-bg"
                />
              </div>
              <div>
                <Label
                  htmlFor="solPincode"
                  className="text-xs font-semibold text-theme-secondary"
                >
                  Pin Code
                </Label>
                <Input
                  id="solPincode"
                  placeholder="e.g. 560100"
                  value={contactPincode}
                  onChange={(e) => setContactPincode(e.target.value)}
                  className="h-10 text-xs mt-1 bg-theme-bg"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-theme-secondary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Zero-obligation shadow analysis &amp; structural engineering study.</span>
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-11 text-xs font-semibold mt-2 cursor-pointer"
              disabled={isSubmittingLead}
            >
              {isSubmittingLead
                ? "Scheduling Site Engineer..."
                : "Confirm Free Assessment & Quote"}
            </Button>
          </form>
        ) : (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-theme-primary">
              Assessment Request Confirmed!
            </h4>
            <p className="text-xs text-theme-secondary leading-relaxed">
              A WayTara Power Systems Engineer will contact{" "}
              <strong>{contactPhone}</strong> within 2 business hours to review
              your property layout and provide the formal design proposal.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="mt-2 text-xs cursor-pointer"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
