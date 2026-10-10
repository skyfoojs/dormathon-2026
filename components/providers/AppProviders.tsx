"use client";

import * as React from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { FacilityProvider } from "@/components/providers/FacilityProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <FacilityProvider>{children}</FacilityProvider>
    </QueryProvider>
  );
}
