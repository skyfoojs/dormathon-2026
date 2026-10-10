"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getFacilities } from "@/lib/api/resources";
import type { Facility } from "@/lib/db/types";

type FacilityContextValue = {
  facilities: Facility[];
  facilityId: number | null;
  facility: Facility | null;
  setFacilityId: (id: number) => void;
  isLoading: boolean;
};

const FacilityContext = React.createContext<FacilityContextValue | null>(null);

// Facility picking is disabled app-wide: this app only ever shows Sunway
// Medical Centre. setFacilityId is kept on the context for API shape, but
// nothing calls it.
const LOCKED_FACILITY_NAME = "Sunway Medical Centre";

export function FacilityProvider({ children }: { children: React.ReactNode }) {
  const [explicitFacilityId, setFacilityId] = React.useState<number | null>(null);

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
  });

  const lockedFacilityId = facilities.find((f) => f.facility_name === LOCKED_FACILITY_NAME)?.facility_id ?? null;
  const facilityId = explicitFacilityId ?? lockedFacilityId ?? facilities[0]?.facility_id ?? null;
  const facility = facilities.find((f) => f.facility_id === facilityId) ?? null;

  const value = React.useMemo<FacilityContextValue>(
    () => ({ facilities, facilityId, facility, setFacilityId, isLoading }),
    [facilities, facilityId, facility, isLoading],
  );

  return (
    <FacilityContext.Provider value={value}>
      {children}
    </FacilityContext.Provider>
  );
}

export function useFacility(): FacilityContextValue {
  const ctx = React.useContext(FacilityContext);
  if (!ctx) {
    throw new Error("useFacility must be used within a FacilityProvider");
  }
  return ctx;
}
