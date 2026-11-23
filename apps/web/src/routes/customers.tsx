import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/features/customers";

export const Route = createFileRoute("/customers")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { customer?: string; create?: boolean; outstanding?: boolean } => ({
    customer:
      typeof search.customer === "string" && search.customer
        ? search.customer
        : undefined,
    create: search.create === true ? true : undefined,
    outstanding: search.outstanding === true ? true : undefined,
  }),
  component: CustomerRoute,
});

function CustomerRoute() {
  const { customer, create, outstanding } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CustomersPage
      id={customer}
      create={create}
      outstanding={outstanding}
      closeLinkedCustomer={() =>
        void navigate({ search: { outstanding }, replace: true })
      }
    />
  );
}
