import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Inventory Movements</h1>
        <Link href="/inventory/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Movement
          </Button>
        </Link>
      </div>
      <div className="rounded-lg border shadow-sm p-4 h-[400px] flex items-center justify-center bg-muted/10">
        <div className="text-center">
          <h3 className="text-lg font-medium">No Movements Logged</h3>
          <p className="text-sm text-muted-foreground">
            Stock adjustments and transactions will be listed here.
          </p>
        </div>
      </div>
    </div>
  );
}
