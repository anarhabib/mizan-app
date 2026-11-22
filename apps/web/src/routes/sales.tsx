import { createFileRoute } from "@tanstack/react-router";
import { SalesPage } from "@/features/sales";

export const Route = createFileRoute("/sales")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { product?: string; sale?: string } => ({
    product:
      typeof search.product === "string" && search.product
        ? search.product
        : undefined,
    sale:
      typeof search.sale === "string" && search.sale ? search.sale : undefined,
  }),
  component: SalesRoute,
});

function SalesRoute() {
  const { product, sale } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SalesPage
      productId={product}
      saleId={sale}
      closeCreate={() => void navigate({ search: {}, replace: true })}
    />
  );
}
