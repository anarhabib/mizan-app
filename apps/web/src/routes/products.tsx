import { createFileRoute } from "@tanstack/react-router";
import { isBusinessDate, type ProductStatus } from "@mizan/contracts";
import { ProductsPage } from "@/features/products";

export const Route = createFileRoute("/products")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    product?: string;
    intent?: "create" | "sale";
    view?: "sets";
    status?: ProductStatus;
    soldOn?: string;
    receivedOn?: string;
    agedDays?: number;
    credit?: true;
  } => ({
    view: search.view === "sets" ? "sets" : undefined,
    product:
      typeof search.product === "string"
        ? search.product || undefined
        : undefined,
    status:
      search.status === "IN_STOCK" || search.status === "SOLD"
        ? search.status
        : undefined,
    credit:
      search.credit === true && search.status !== "IN_STOCK" ? true : undefined,
    soldOn: isBusinessDate(search.soldOn) ? search.soldOn : undefined,
    receivedOn: isBusinessDate(search.receivedOn)
      ? search.receivedOn
      : undefined,
    agedDays:
      typeof search.agedDays === "number" &&
      Number.isInteger(search.agedDays) &&
      search.agedDays >= 1 &&
      search.agedDays <= 365
        ? search.agedDays
        : undefined,
    intent:
      search.intent === "create" || search.intent === "sale"
        ? search.intent
        : undefined,
  }),
  component: ProductsRoute,
});

function ProductsRoute() {
  const { product, intent, view, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProductsPage
      product={product}
      intent={intent}
      view={view}
      filters={filters}
      clearDashboardFilters={() =>
        void navigate({
          search: {
            product,
            intent,
            status: filters.status,
            credit: filters.credit,
          },
          replace: true,
        })
      }
      closeLinkedProduct={() =>
        void navigate({ search: filters, replace: true })
      }
      startSale={(product) =>
        void navigate({ to: "/sales", search: { product } })
      }
    />
  );
}
