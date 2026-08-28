"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";
import { Navigation } from "@/components/sections/navigation";
import { Footer } from "@/components/sections/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const contactFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid 10-digit phone number is required"),
  segment: z.enum(["home", "commercial", "ev_fleet"]),
  city: z.string().min(2, "City / Pincode is required"),
  message: z.string().min(5, "Please tell us about your property requirements"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [leadId, setLeadId] = React.useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      segment: "home",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    const id = `contact_${Date.now()}`;
    setLeadId(id);

    try {
      await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "completed",
          source: "contact_page",
          segment: data.segment,
          formData: {
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
          },
          contact: {
            name: data.fullName,
            email: data.email,
            phone: data.phone,
            city: data.city,
            message: data.message,
          },
        }),
      });

      setIsSubmitted(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#34D399", "#16A34A", "#0D9488"],
      });
    } catch (err) {
      console.error("Contact submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-primary">
      <Navigation />

      <main className="flex-1 pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="fluid-container">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="eyebrow-label justify-center">
              <span>GET IN TOUCH</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-theme-primary">
              Speak with a WayTara{" "}
              <span className="text-primary-gradient">Power Systems Architect.</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-theme-secondary">
              Whether you need rooftop solar sizing, whole-home battery backup, or commercial fleet charging — our engineers are here to assist.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left: Contact Form */}
            <div className="lg:col-span-7">
              <Card className="rounded-3xl border-theme-border bg-theme-surface shadow-xl p-6 sm:p-10">
                {!isSubmitted ? (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName" className="text-xs font-semibold text-theme-secondary">
                          Your Full Name *
                        </Label>
                        <Input
                          id="fullName"
                          placeholder="e.g. Vikram Singhania"
                          {...register("fullName")}
                          className="mt-1"
                        />
                        {errors.fullName && (
                          <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="phone" className="text-xs font-semibold text-theme-secondary">
                          Phone Number *
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="e.g. 9876543210"
                          {...register("phone")}
                          className="mt-1"
                        />
                        {errors.phone && (
                          <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email" className="text-xs font-semibold text-theme-secondary">
                          Email Address *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="e.g. vikram@example.com"
                          {...register("email")}
                          className="mt-1"
                        />
                        {errors.email && (
                          <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="city" className="text-xs font-semibold text-theme-secondary">
                          City / Pincode *
                        </Label>
                        <Input
                          id="city"
                          placeholder="e.g. Bengaluru, 560001"
                          {...register("city")}
                          className="mt-1"
                        />
                        {errors.city && (
                          <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="segment" className="text-xs font-semibold text-theme-secondary">
                        Property / Customer Segment *
                      </Label>
                      <select
                        id="segment"
                        {...register("segment")}
                        className="mt-1 flex h-11 w-full rounded-xl border border-theme-border bg-theme-surface px-4 py-2 text-sm text-theme-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                      >
                        <option value="home">Residential / Home Independence (Solar + Storage)</option>
                        <option value="commercial">Commercial / Industrial Building (Rooftop + BESS)</option>
                        <option value="ev_fleet">EV Fleet / Depot Charging Hub</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-xs font-semibold text-theme-secondary">
                        Tell us about your property, average monthly bill &amp; backup goals *
                      </Label>
                      <textarea
                        id="message"
                        rows={4}
                        placeholder="e.g. We have a 4BHK independent villa in Pune with monthly bill ~₹8,500. We want 24/7 battery backup for 2 ACs and upcoming EV charging."
                        {...register("message")}
                        className="mt-1 flex w-full rounded-xl border border-theme-border bg-theme-surface px-4 py-2.5 text-sm text-theme-primary transition-colors placeholder:text-theme-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                      />
                      {errors.message && (
                        <p className="text-xs text-red-500 mt-1">{errors.message.message}</p>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="gradient"
                        size="lg"
                        disabled={isSubmitting}
                        className="w-full justify-center font-bold"
                      >
                        {isSubmitting ? (
                          <span>Dispatching Enquiry...</span>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            <span>Request Free Consultation</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="py-8 text-center animate-in zoom-in-95 duration-200">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 mx-auto mb-4 border border-emerald-500/30">
                      <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                    </div>
                    <h3 className="text-2xl font-bold text-theme-primary">
                      Enquiry Received!
                    </h3>
                    <p className="mt-2 text-sm text-theme-secondary max-w-md mx-auto leading-relaxed">
                      Thank you. Reference ID: <strong className="font-mono text-theme-highlight">{leadId}</strong>. A WayTara power engineering specialist will review your property requirements and contact you within 2 business hours.
                    </p>
                    <div className="mt-8 flex justify-center gap-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsSubmitted(false);
                          reset();
                        }}
                        className="rounded-xl"
                      >
                        Send Another Enquiry
                      </Button>
                      <Button asChild variant="gradient" className="rounded-xl">
                        <Link href="/#energy-planner">
                          <span>Try Interactive Planner</span>
                          <ArrowRight className="h-4 w-4 ml-1.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Right: Office, Helpline, and Direct Channels */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 sm:p-8 rounded-3xl bg-theme-surface border border-theme-border shadow-md">
                <h3 className="text-xl font-bold text-theme-primary mb-6">
                  Direct Engineering Helpline
                </h3>

                <ul className="space-y-5 text-sm">
                  <li className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-theme-highlight-subtle text-theme-highlight shrink-0 mt-0.5">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted block">
                        Direct Helpline
                      </span>
                      <a
                        href="tel:9384800141"
                        className="text-base font-bold text-theme-primary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        +91 93848 00141
                      </a>
                      <p className="text-xs text-theme-secondary mt-0.5">
                        Mon–Sat: 8:00 AM – 8:00 PM IST
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-theme-highlight-subtle text-theme-highlight shrink-0 mt-0.5">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted block">
                        Engineering Inquiries
                      </span>
                      <a
                        href="mailto:contactus@waytaraenergy.com"
                        className="text-base font-bold text-theme-primary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        contactus@waytaraenergy.com
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-theme-highlight-subtle text-theme-highlight shrink-0 mt-0.5">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted block">
                        Registered Office
                      </span>
                      <a
                        href="https://maps.app.goo.gl/uDAuNfJjh5uXBpZa9"
                        target="_blank"
                        rel="noreferrer"
                        className="group/map"
                      >
                        <span className="not-italic text-sm font-semibold text-theme-primary block group-hover/map:text-emerald-600 dark:group-hover/map:text-emerald-400 transition-colors">
                          WayTara Energy Systems
                        </span>
                        <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed group-hover/map:text-theme-primary transition-colors">
                          No. 6 &amp; 7, 3rd floor 5th Street,
                          <br />
                          Dr. Radhakrishnan Salai, Mylapore,
                          <br />
                          Chennai - 600 004, India
                        </p>
                      </a>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Service SLA Commitment */}
              <div className="p-6 rounded-3xl bg-primary-gradient text-white shadow-lg shadow-emerald-600/15">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 fill-white/20" />
                  <h4 className="font-bold text-base">Our Engineering SLA Guarantee</h4>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">
                  Every site proposal includes computer-aided 3D shadow analysis, generation simulation (PVSyst modeled), DISCOM net-metering feasibility, and a locked price quote.
                </p>
              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
