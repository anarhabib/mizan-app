import { useState } from "react";
import type { CustomerContact } from "@mizan/contracts";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CustomerForm, CustomerSearch } from "@/features/customers";
import type { SaleScope } from "../api/queries";

export function SaleCustomerPicker({
  scope,
  close,
  select,
}: {
  scope: SaleScope;
  close: () => void;
  select: (customer: CustomerContact) => void;
}) {
  const { t } = useTranslation("customers");
  const [creating, setCreating] = useState(false);
  return (
    <section className="grid gap-4">
      <h3 className="font-medium">{t(creating ? "create" : "select")}</h3>
      {creating ? (
        <CustomerForm
          scope={scope}
          close={() => setCreating(false)}
          saved={select}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 lg:min-h-9"
              onClick={close}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="min-h-11 lg:min-h-9"
              onClick={() => setCreating(true)}
            >
              <Plus aria-hidden="true" />
              {t("create")}
            </Button>
          </div>
          <CustomerSearch
            scope={scope}
            render={(customer) => (
              <button
                type="button"
                onClick={() => select(customer)}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9"
              >
                <span className="font-medium wrap-anywhere">
                  {customer.name}
                </span>
                <span className="text-muted-foreground wrap-anywhere">
                  {customer.phone}
                </span>
              </button>
            )}
          />
        </>
      )}
    </section>
  );
}
