import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { categoryIdPattern } from "@mizan/contracts";
import { SuppliersPage } from "@/features/suppliers";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";

export const Route = createFileRoute("/suppliers")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { supplier?: string; purchase?: string; view?: "purchases" } => ({
    supplier:
      typeof search.supplier === "string" &&
      categoryIdPattern.test(search.supplier)
        ? search.supplier.toLowerCase()
        : undefined,
    purchase:
      typeof search.purchase === "string" &&
      categoryIdPattern.test(search.purchase)
        ? search.purchase.toLowerCase()
        : undefined,
    view: search.view === "purchases" ? "purchases" : undefined,
  }),
  component: SuppliersRoute,
});

function SuppliersRoute() {
  const search = Route.useSearch();
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <SuppliersPage search={search} />
    </Suspense>
  );
}
