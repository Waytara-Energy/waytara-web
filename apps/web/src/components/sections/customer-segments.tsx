"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Home,
  Building,
  Factory,
  Building2,
  Truck,
  Cpu,
} from "lucide-react";
import { CustomerSegmentId } from "@/types";
import { Reveal } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";

export interface JourneyItem {
  id: string;
  segmentMapping: CustomerSegmentId;
  title: string;
  category: string;
  tagline: string;
  image: string;
  shortDesc: string;
  icon: React.ElementType;
  specs: {
    typicalCapacity: string;
    batteryStorage: string;
    expectedSavings: string;
    roiPayback: string;
  };
  highlights: string[];
  idealFor: string;
  deepDive: string;
}

const JOURNEYS: JourneyItem[] = [
  {
    id: "home",
    segmentMapping: "home",
    title: "Home",
    category: "Residential",
    tagline: "The Frontier of Home Independence.",
    image: "/images/segments/home.jpg",
    shortDesc:
      "Rooftop solar paired with silent LFP battery storage to eliminate blackouts and cut residential electricity bills by up to 90%.",
    icon: Home,
    specs: {
      typicalCapacity: "3 kW – 15 kW",
      batteryStorage: "5 kWh – 20 kWh",
      expectedSavings: "Up to 90%",
      roiPayback: "3.5 – 4.5 Years",
    },
    highlights: [
      "Sub-20ms instant UPS switchover for seamless power",
      "PM Surya Ghar government subsidy assistance & fast-track net metering",
      "24/7 Mobile app monitoring with individual appliance tracking",
      "25-Year panel warranty with dedicated annual health checks",
    ],
    idealFor:
      "Independent houses, row villas, bungalows, and farmhouses seeking complete power independence.",
    deepDive:
      "Our residential journey integrates ultra-efficient N-type TOPCon solar panels with smart hybrid inverters and compact lithium iron phosphate (LFP) wall batteries. It powers heavy appliances like air conditioners, refrigerators, and EV home chargers even during complete grid failure.",
  },
  {
    id: "apartment",
    segmentMapping: "home",
    title: "Apartment",
    category: "Communities",
    tagline: "Clean Power for Gated Communities.",
    image: "/images/segments/apartment.jpg",
    shortDesc:
      "Shared rooftop solar architecture powering common areas, lifts, water pumps, and EV parking bays to slash society maintenance fees.",
    icon: Building,
    specs: {
      typicalCapacity: "25 kW – 100 kW+",
      batteryStorage: "30 kWh – 150 kWh",
      expectedSavings: "70% – 85%",
      roiPayback: "3 – 4 Years",
    },
    highlights: [
      "Zero-diesel transition for lifts, STPs, and common lighting",
      "Automated sub-metering and society RWA billing integration",
      "Shared EV charging slots with RFID access and revenue sharing",
      "Compliant with local electrical inspectorate (CEIG) norms",
    ],
    idealFor:
      "Resident Welfare Associations (RWAs), apartment complexes, and high-rise residential towers.",
    deepDive:
      "Instead of running expensive, noisy diesel generators during load shedding, our multi-dwelling system provides clean rooftop solar energy that directly offsets common area utility tariffs and charges community electric vehicles.",
  },
  {
    id: "factory",
    segmentMapping: "commercial",
    title: "Factory",
    category: "Industrial",
    tagline: "High-Yield Power for Heavy Industry.",
    image: "/images/segments/factory.jpg",
    shortDesc:
      "High-voltage industrial PV and multi-megawatt BESS to eliminate peak demand charges, power factor penalties, and diesel fuel costs.",
    icon: Factory,
    specs: {
      typicalCapacity: "100 kW – 2 MW+",
      batteryStorage: "100 kWh – 1 MWh+",
      expectedSavings: "₹15L – ₹1.2Cr / yr",
      roiPayback: "2.8 – 3.5 Years",
    },
    highlights: [
      "Peak kVA maximum demand shaving during high-tariff production hours",
      "40% Year-1 accelerated tax depreciation benefit",
      "Heavy inductive motor load support with zero harmonic distortion",
      "SCADA & cloud microgrid telemetry with automated generator interlocking",
    ],
    idealFor:
      "Automotive plants, textile mills, cold storage facilities, packaging units, and fabrication facilities.",
    deepDive:
      "Industrial facilities face steep peak tariff penalties and massive diesel generator costs. WayTara’s industrial solar and utility-grade storage synchronize with high-voltage substations to automate peak shaving, reduce carbon compliance audits, and guarantee uninterrupted production lines.",
  },
  {
    id: "commercial",
    segmentMapping: "commercial",
    title: "Commercial",
    category: "Commercial",
    tagline: "Sustainable Energy for Modern Workspaces.",
    image: "/images/segments/commercial.jpg",
    shortDesc:
      "Cut operational building electricity costs, elevate corporate ESG ratings, and provide reliable power for critical tenant infrastructure.",
    icon: Building2,
    specs: {
      typicalCapacity: "50 kW – 500 kW",
      batteryStorage: "50 kWh – 300 kWh",
      expectedSavings: "60% – 75%",
      roiPayback: "3.2 – 4 Years",
    },
    highlights: [
      "Powers centralized HVAC chillers, server rooms, and elevators",
      "Green Building IGBC & LEED rating accreditation credits",
      "Smart tenant solar billing sub-systems",
      "Integrated rooftop canopy solar with usable shaded terrace spaces",
    ],
    idealFor:
      "Multi-tenant corporate offices, hospitals, private universities, shopping malls, and hospitality resorts.",
    deepDive:
      "Commercial real estate requires reliable power quality and reduced operating overhead. We deploy elevated rooftop canopies that preserve recreational terrace space while generating megawatts of clean power to run central cooling and building systems.",
  },
  {
    id: "ev_fleet",
    segmentMapping: "ev_fleet",
    title: "EV Fleet",
    category: "Logistics",
    tagline: "Powering the Next-Gen Fleet Transit.",
    image: "/images/segments/ev-fleet.jpg",
    shortDesc:
      "Dedicated high-power DC fast charging hubs fueled directly by on-site solar generation and dynamic energy buffer storage.",
    icon: Truck,
    specs: {
      typicalCapacity: "60 kW – 360 kW DC",
      batteryStorage: "100 kWh – 500 kWh",
      expectedSavings: "Up to 65% / km",
      roiPayback: "2.5 – 3.2 Years",
    },
    highlights: [
      "Dual-gun CCS2 & GB/T fast chargers up to 240 kW per dispenser",
      "Dynamic solar-surplus routing to minimize grid draw during fleet turnarounds",
      "Automated RFID driver authorization and fleet telematics portal",
      "Battery buffering to avoid costly grid transformer upgrades",
    ],
    idealFor:
      "E-commerce delivery fleets, electric bus transit depots, last-mile 3-wheeler hubs, and logistics parks.",
    deepDive:
      "Electrifying commercial fleets demands high electrical power that often exceeds local substation capacity. Our depot solution pairs on-site solar with high-capacity battery buffers to enable ultra-fast vehicle turnaround times at a fraction of diesel or grid-only costs.",
  },
  {
    id: "it_park",
    segmentMapping: "commercial",
    title: "IT Park",
    category: "Tech Campuses",
    tagline: "Mission-Critical Power for Tech Hubs.",
    image: "/images/segments/it-park.jpg",
    shortDesc:
      "Mission-critical microgrid architecture offering 99.999% clean sine wave uptime with solar parking canopies and battery arbitrage.",
    icon: Cpu,
    specs: {
      typicalCapacity: "250 kW – 5 MW",
      batteryStorage: "250 kWh – 2 MWh+",
      expectedSavings: "₹30L – ₹2.5Cr / yr",
      roiPayback: "3 – 3.8 Years",
    },
    highlights: [
      "Zero-interruption sine wave power for high-density compute & server racks",
      "Solar canopy carports with integrated EV employee charging",
      "AI-driven Time-of-Day (ToD) tariff arbitrage and peak curtailment",
      "24/7 Network Operations Center (NOC) remote diagnostic telemetry",
    ],
    idealFor:
      "Software development centers, financial data hubs, co-working tech campuses, and R&D facilities.",
    deepDive:
      "Data-driven IT campuses cannot tolerate even a millisecond voltage sag. WayTara engineers turnkey campus microgrids that leverage parking carports and rooftops, coupled with automated islanding controls that switch from grid to battery in under 10ms.",
  },
];

interface CustomerSegmentsProps {
  selectedSegment: CustomerSegmentId;
  onSelectSegment: (segment: CustomerSegmentId) => void;
}

export function CustomerSegments({
  selectedSegment,
  onSelectSegment,
}: CustomerSegmentsProps) {
  return (
    <section
      id="customer-segments"
      className="section-padding bg-theme-bg relative scroll-mt-16"
    >
      <div className="fluid-container">
        
        {/* 1. Top Pill Badge matching Who We Are */}
        <Reveal direction="up" delay={50} duration={600}>
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-[#EBF4EC] dark:bg-[#16271C] select-none transition-colors">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D8ECD9] dark:bg-[#223B2B] text-[#0F1E14] dark:text-[#E2F0E5]">
                <ArrowDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </span>
              <span className="text-xs sm:text-[13px] font-medium text-[#0F1E14] dark:text-[#E2F0E5] tracking-tight">
                Who We Serve ?
              </span>
            </div>
          </div>
        </Reveal>

        {/* 2. Split Header: Title on Left, Subtitle on Right End */}
        <Reveal direction="up" delay={120} duration={700}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <h2 className="text-[clamp(2.1rem,3.8vw,3.35rem)] font-bold tracking-tight text-theme-primary leading-[1.18]">
              <span className="block">Tailored Solutions.</span>
              <span className="block text-primary-gradient">For Every Scale.</span>
            </h2>
            <p className="text-sm sm:text-base text-theme-secondary leading-relaxed max-w-md lg:max-w-lg md:pb-1">
              Explore dedicated clean energy journeys tailored for your property type — from independent homes to commercial enterprises and EV charging hubs.
            </p>
          </div>
        </Reveal>

        {/* 3. Six Frameless Journey Cards with Bottom Frosted Glass Blur */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-14">
          {JOURNEYS.map((journey, index) => {
            const solutionPath = `/solutions/${journey.id.replace(/_/g, "-")}`;
            return (
              <Reveal
                key={journey.id}
                direction="up"
                delay={index * 90}
                duration={650}
                distance={28}
              >
                <Link
                  href={solutionPath}
                  className={cn(
                    "group relative rounded-3xl overflow-hidden aspect-[16/10] sm:aspect-[16/10.5] block",
                    "shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]",
                    "cursor-pointer select-none border-0 transition-all duration-300 hover:shadow-2xl"
                  )}
                >
                  {/* Full-Bleed Background Image */}
                  <Image
                    src={journey.image}
                    alt={journey.title}
                    fill
                    priority={false}
                    unoptimized
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  />

                  {/* 1. Progressive Masked Backdrop Blur (Zero Hard Edges) */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-[48%] pointer-events-none backdrop-blur-md z-0"
                    style={{
                      maskImage: "linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
                      WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
                    }}
                  />

                  {/* 2. Smooth Dark Vignette Gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none z-0" />

                  {/* 3. Bottom Content Area */}
                  <div className="absolute inset-x-0 bottom-0 pb-4 sm:pb-5 px-5 sm:px-6 flex items-end justify-between gap-3 z-10">
                    {/* Left: Title & Tagline */}
                    <div className="text-left pr-2">
                      <h3 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight drop-shadow-md leading-tight">
                        {journey.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] font-medium text-white/90 tracking-wide drop-shadow mt-1">
                        {journey.tagline}
                      </p>
                    </div>

                    {/* Right: Circular Top-Right Arrow Action Button */}
                    <div
                      aria-label={`Explore ${journey.title} Solution`}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/70 text-white group-hover:bg-white group-hover:text-black group-hover:border-white flex items-center justify-center backdrop-blur-md border border-white/25 shadow-xl transition-all duration-300 group-hover:scale-110 active:scale-95 shrink-0"
                    >
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 stroke-[2.2]" />
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>

        {/* 4. Bottom Action Link -> Navigates to Solutions & Packages Hub */}
        <Reveal direction="fade" delay={200} duration={600}>
          <div className="text-center flex justify-center">
            <Link
              href="/solutions"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-theme-primary hover:text-theme-highlight underline underline-offset-4 decoration-theme-primary/30 hover:decoration-theme-highlight transition-all duration-200 group cursor-pointer"
            >
              <span>Discover Solutions and Packages</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
