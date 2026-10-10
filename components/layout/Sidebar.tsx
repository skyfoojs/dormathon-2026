"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/lib/nav";
import { useWarnings } from "@/components/providers/WarningsProvider";
import { Tag } from "@/components/ui/Tag";
import { CountBadge } from "@/components/ui/Badge";

export function Sidebar() {
  const [expanded, setExpanded] = React.useState(false);
  const pathname = usePathname();
  const { openCount } = useWarnings();

  return (
    <>
      {expanded ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-40 bg-ink/20"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col gap-5 overflow-hidden border-r border-line bg-card px-2 py-3",
          expanded ? "w-sidebar-expanded shadow-lg" : "w-16",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            expanded ? "flex-row justify-between px-2" : "flex-col",
          )}
        >
          {expanded ? (
            <Link href="/dashboard" className="shrink-0">
              <img
                src="/aigis-logo.png"
                alt="AiGIS, AI Guardian Intelligence System"
                className="h-10 w-auto"
              />
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="relative block h-12 w-9 shrink-0 overflow-hidden"
              aria-label="AiGIS"
            >
              <img
                src="/aigis-logo.png"
                alt=""
                className="h-12 w-auto max-w-none"
              />
            </Link>
          )}
          <button
            type="button"
            aria-label={expanded ? "Collapse menu" : "Expand menu"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-[1.5px] border-line text-navy transition-colors duration-150 hover:bg-blue-tint focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;
            const isWarnings = item.href === "/warnings";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  isWarnings
                    ? `${item.label}, ${openCount} to resolve`
                    : item.label
                }
                onClick={() => setExpanded(false)}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-md px-2.5 font-semibold text-ink no-underline transition-colors duration-150",
                  expanded ? "justify-start" : "justify-center",
                  isActive ? "bg-navy text-white" : "hover:bg-blue-tint",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={cn(!expanded && "sr-only")}>
                  {item.label}
                </span>
                {isWarnings && openCount > 0 ? (
                  <CountBadge
                    count={openCount}
                    className={cn(
                      expanded
                        ? "ml-auto"
                        : "absolute top-0.5 right-0.5",
                    )}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {expanded ? (
          <div className="mt-auto flex flex-col gap-1.5 px-2 text-sm text-muted">
            <Tag tone="dashed" className="self-start">
              Mockup · sample data
            </Tag>
            <Link href="/predictions" className="font-semibold text-navy">
              Last sync 34 min ago
            </Link>
          </div>
        ) : null}
      </aside>
    </>
  );
}
