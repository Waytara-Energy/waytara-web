"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { BASE_NAV, GATED_NAV } from "./nav-config";

const ALL_NAV = [...BASE_NAV, ...GATED_NAV];

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const current = ALL_NAV.find((item) => item.href === pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{current?.label ?? "Dashboard"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
