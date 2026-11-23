import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/features/products";

export const Route = createFileRoute("/products")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { product?: string; intent?: "create" | "sale" } => ({
    product:
      typeof search.product === "string"
        ? search.product || undefined
        : undefined,
    intent:
      search.intent === "create" || search.intent === "sale"
        ? search.intent
        : undefined,
  }),
  component: ProductsRoute,
});

function ProductsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProductsPage
      {...search}
      closeLinkedProduct={() => void navigate({ search: {}, replace: true })}
      startSale={(product) =>
        void navigate({ to: "/sales", search: { product } })
      }
    />
  );
}
