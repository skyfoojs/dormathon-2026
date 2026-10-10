"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useFacility } from "@/components/providers/FacilityProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, facilityId } = useFacility();

  return (
    <div className="flex min-h-screen items-stretch bg-page">
      <Sidebar />
      <div className="ml-16 flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-8 py-7">
          {isLoading || facilityId === null ? (
            <p className="p-8 text-center text-muted">Loading facilities{"…"}</p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
