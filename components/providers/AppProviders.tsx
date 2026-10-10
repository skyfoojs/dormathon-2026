"use client";

import * as React from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { FacilityProvider } from "@/components/providers/FacilityProvider";
import { PredictionsProvider } from "@/components/providers/PredictionsProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <FacilityProvider>
        <PredictionsProvider>{children}</PredictionsProvider>
      </FacilityProvider>
    </QueryProvider>
  );
}
