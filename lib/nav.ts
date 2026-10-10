import {
  LayoutGrid,
  Boxes,
  LineChart,
  TriangleAlert,
  Share2,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Predictions", href: "/predictions", icon: LineChart },
  { label: "Warnings", href: "/warnings", icon: TriangleAlert },
  { label: "Insights", href: "/insights", icon: Share2 },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];
