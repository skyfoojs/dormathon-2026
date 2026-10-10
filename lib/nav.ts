import {
  LayoutGrid,
  Boxes,
  LineChart,
  Truck,
  ScrollText,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// Day-to-day pages, shown at the top of the sidebar.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Predictions", href: "/predictions", icon: LineChart },
  { label: "Orders", href: "/orders", icon: Truck },
];

// Setup and reference pages, pinned to the bottom of the sidebar.
export const NAV_SECONDARY_ITEMS: NavItem[] = [
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Policies", href: "/policies", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];
