"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useFacility } from "@/components/providers/FacilityProvider";
import { useWarnings } from "@/components/providers/WarningsProvider";
import { formatFacilitySubtitle } from "@/lib/data/facility";
import { CountBadge } from "@/components/ui/Badge";

export function TopBar() {
  const { facility } = useFacility();
  const { openCount } = useWarnings();

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-card px-8 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {!facility ? (
          <span className="text-sm text-muted">Loading facility{"…"}</span>
        ) : (
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{facility.facility_name}</span>
            <span className="text-sm text-muted">
              {formatFacilitySubtitle(facility)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/warnings"
          aria-label={`${openCount} warnings to resolve`}
          className="relative flex h-11 w-11 items-center justify-center rounded-md border-[1.5px] border-line text-navy transition-colors duration-150 hover:bg-blue-tint focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
        >
          <Bell size={22} aria-hidden="true" />
          {openCount > 0 ? (
            <CountBadge count={openCount} className="absolute -top-2 -right-2" />
          ) : null}
        </Link>
      </div>
    </header>
  );
}
