import { createFileRoute } from "@tanstack/react-router";
import { SalesPage } from "@/features/sales";

export const Route = createFileRoute("/sales")({
  validateSearch: (search: Record<string, unknown>): { product?: string } => ({
    product:
      typeof search.product === "string" && search.product
        ? search.product
        : undefined,
  }),
  component: SalesRoute,
});

function SalesRoute() {
  const { product } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SalesPage
      productId={product}
      closeCreate={() => void navigate({ search: {}, replace: true })}
    />
  );
}
