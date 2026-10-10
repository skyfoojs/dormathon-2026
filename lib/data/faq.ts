import {
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Database,
  Filter,
  Flag,
  GitCompareArrows,
  Globe,
  MousePointerClick,
  PackageSearch,
  Percent,
  Scale,
  ShieldPlus,
  Sigma,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { FlowStage } from "@/components/ui/FlowChart";

export type FaqEntry = {
  id: string;
  icon: LucideIcon;
  question: string;
  // The answer in a sentence or two, before the chart.
  summary: string;
  flow: FlowStage[];
  example: string;
};

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "predictions",
    icon: Sigma,
    question: "How are predictions made from internal inventory and purchase order data?",
    summary:
      "Two forecasting methods run on your own stock records with the day-of-week pattern taken out, Holt's damped trend and a weighted moving average, and are blended. No AI, and the same data always gives the same answer.",
    flow: [
      { tone: "data", icon: Database, title: "Daily stock records", text: "Demand = issued + unmet demand." },
      {
        tone: "calc",
        icon: CalendarRange,
        title: "Day-of-week adjustment",
        text: "Each weekday's usual high or low is divided out.",
      },
      [
        {
          tone: "calc",
          icon: TrendingUp,
          title: "Holt's damped trend",
          text: "Double exponential smoothing, tuned on 7-day totals.",
        },
        {
          tone: "calc",
          icon: CalendarDays,
          title: "Weighted moving average",
          text: "Last 56 days, newest weighted most.",
        },
      ],
      {
        tone: "calc",
        icon: Scale,
        title: "Error-weighted blend",
        text: "Backtested on 7-day totals; lower error gets more weight.",
      },
      [
        { tone: "data", icon: Truck, title: "Lead time", text: "Mean days from order to delivery." },
        {
          tone: "calc",
          icon: ShieldPlus,
          title: "Safety stock",
          text: "z × σ × √lead time, at 95% or 98% service level.",
        },
      ],
      { tone: "calc", icon: Flag, title: "Reorder point", text: "Lead-time usage + safety stock." },
      { tone: "calc", icon: TrendingDown, title: "Stock projection", text: "Usage out, deliveries in, day by day." },
      { tone: "result", icon: CalendarClock, title: "Two dates", text: "When to reorder and when stock runs out." },
    ],
    example: "40 units a day and a 5-day lead time need 200. Add safety stock of 60 and the reorder point is 260.",
  },
  {
    id: "ai-adjustment",
    icon: Sparkles,
    question: "How does AI process external data and trends to affect predictions?",
    summary: "AI reads outbreak news and returns a percentage, never a quantity. The arithmetic still produces every number.",
    flow: [
      { tone: "external", icon: Globe, title: "WHO outbreak news", text: "Only reports not seen before." },
      { tone: "ai", icon: Filter, title: "Screen", text: "Keep what could affect supply or demand." },
      {
        tone: "ai",
        icon: Users,
        title: "Panel 1: is it real?",
        text: "4 models judge it, review each other, and a chair decides.",
      },
      {
        tone: "ai",
        icon: Users,
        title: "Panel 2: what changes?",
        text: "4 models weigh stock, orders and the confirmed news.",
      },
      { tone: "ai", icon: Percent, title: "A percentage", text: "More or less usage, and for how long." },
      { tone: "calc", icon: Calculator, title: "Recalculate", text: "Usage is scaled and stock counted forward again." },
      { tone: "result", icon: Sparkles, title: "AI line", text: "Shown beside the original prediction." },
    ],
    example: "A nearby outbreak: 30% more masks, fading over 30 days. About 15% more in two weeks, normal after a month.",
  },
  {
    id: "purchase-orders",
    icon: Truck,
    question: "How are purchase orders generated from the prediction results?",
    summary: "Sync now checks every item and drafts a Pending order for anything predicted to run low.",
    flow: [
      { tone: "user", icon: MousePointerClick, title: "Press Sync now", text: "Every item is checked." },
      {
        tone: "check",
        icon: Truck,
        title: "Already on order?",
        text: "Pending or In transit.",
        exit: "Yes: no new order",
      },
      { tone: "ai", icon: GitCompareArrows, title: "Pick the prediction", text: "AI-adjusted if the item has one." },
      {
        tone: "check",
        icon: PackageSearch,
        title: "Running low?",
        text: "Hits the reorder point before a delivery could arrive.",
        exit: "No: well stocked",
      },
      { tone: "calc", icon: Calculator, title: "Quantity", text: "Predicted buy amount minus stock on hand." },
      { tone: "calc", icon: Building2, title: "Group by supplier", text: "One order per supplier." },
      { tone: "result", icon: ClipboardCheck, title: "Saved as Pending", text: "Staff review it on the Orders page." },
    ],
    example: "1,200 needed for 30 days including the buffer, 350 on hand. AiGIS drafts an order for 850.",
  },
];
