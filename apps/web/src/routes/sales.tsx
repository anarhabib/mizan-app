import { createFileRoute } from "@tanstack/react-router";
import { isBusinessDate, type SalePaymentStatus } from "@mizan/contracts";
import { SalesPage } from "@/features/sales";

export const Route = createFileRoute("/sales")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    product?: string;
    sale?: string;
    date?: string;
    paymentDate?: string;
    paymentStatus?: SalePaymentStatus;
  } => ({
    product:
      typeof search.product === "string" && search.product
        ? search.product
        : undefined,
    sale:
      typeof search.sale === "string" && search.sale ? search.sale : undefined,
    date: isBusinessDate(search.date) ? search.date : undefined,
    paymentDate: isBusinessDate(search.paymentDate)
      ? search.paymentDate
      : undefined,
    paymentStatus:
      search.paymentStatus === "PAID" ||
      search.paymentStatus === "PARTIALLY_PAID" ||
      search.paymentStatus === "UNPAID"
        ? search.paymentStatus
        : undefined,
  }),
  component: SalesRoute,
});

function SalesRoute() {
  const { product, sale, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SalesPage
      productId={product}
      saleId={sale}
      filters={filters}
      setFilters={(next) =>
        void navigate({ search: { product, sale, ...next }, replace: true })
      }
      closeCreate={() => void navigate({ search: filters, replace: true })}
    />
  );
}
