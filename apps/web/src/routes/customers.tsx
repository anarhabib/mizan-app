import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/features/customers";

export const Route = createFileRoute("/customers")({
  validateSearch: (search: Record<string, unknown>): { customer?: string } => ({
    customer:
      typeof search.customer === "string" && search.customer
        ? search.customer
        : undefined,
  }),
  component: CustomerRoute,
});

function CustomerRoute() {
  const { customer } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CustomersPage
      id={customer}
      closeLinkedCustomer={() => void navigate({ search: {}, replace: true })}
    />
  );
}
