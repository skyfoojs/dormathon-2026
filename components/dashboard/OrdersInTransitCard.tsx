import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { getPurchaseOrderDisplayStatus, type PurchaseOrderDisplayStatus } from "@/lib/data/purchaseOrders";
import type { PurchaseOrderRow } from "@/lib/data/inventory";

const STATUS_TONE: Partial<Record<PurchaseOrderDisplayStatus, TagTone>> = {
  "On the way": "blue",
  "Due today": "amber",
  Delayed: "red",
};

export function OrdersInTransitCard({ rows }: { rows: PurchaseOrderRow[] }) {
  const inTransit = rows
    .filter((r) => r.po.status === "In transit")
    .sort((a, b) => a.po.expected_receipt_date.localeCompare(b.po.expected_receipt_date));
  const top = inTransit.slice(0, 3);

  return (
    <Card className="flex min-w-80 flex-1 flex-col gap-3.5 p-6">
      <CardHeader>
        <CardTitle>Orders in transit</CardTitle>
        <Link href="/orders" className="text-sm font-semibold text-navy">
          View all {inTransit.length}
        </Link>
      </CardHeader>
      <CardBody>
        {top.length === 0 ? (
          <p className="text-sm text-muted">Nothing in transit right now.</p>
        ) : (
          top.map((r) => {
            const { label, note } = getPurchaseOrderDisplayStatus(r.po);
            return (
              <div key={r.po.po_id} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Tag tone={STATUS_TONE[label] ?? "grey"}>{label}</Tag>
                  <span className="font-mono text-xs text-muted">PO-{r.po.po_id}</span>
                </div>
                <div className="text-sm font-semibold">{r.itemName}</div>
                <div className="text-xs text-muted">
                  {r.po.qty_ordered} from {r.supplierName}
                  {note ? `, ${note.toLowerCase()}` : ""}
                </div>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
