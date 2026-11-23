import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useId, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ProductStatus } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import {
  productFacetsQuery,
  type ProductFilters as Filters,
  type ProductScope,
} from "../api/queries";

type FacetFilters = Omit<Filters, "q">;
const all = "all";
const categoryPrefix = "category:";
const statuses = ["IN_STOCK", "SOLD", "SOLD_ON_CREDIT"] as const;

export function ProductFilters({
  scope,
  filters,
  setFilters,
  children,
}: {
  scope: ProductScope;
  filters: FacetFilters;
  setFilters: (filters: FacetFilters) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("products");
  const id = useId();
  const facets = useQuery(productFacetsQuery(scope));
  const categories = new Set(facets.data?.categories);
  const purities = new Set(facets.data?.purities);
  if (filters.category !== undefined) categories.add(filters.category);
  if (filters.purity !== undefined) purities.add(filters.purity);
  const any = { value: all, label: t("all") };

  return (
    <>
      <div
        className="flex min-w-0 items-end gap-3 overflow-x-auto p-1"
        role="group"
        aria-label={t("filters")}
      >
        {children}
        <div className="grid w-40 shrink-0 gap-2">
          <Label htmlFor={`${id}-status`}>{t("fields.status")}</Label>
          <OptionSelect
            id={`${id}-status`}
            value={filters.credit ? "SOLD_ON_CREDIT" : (filters.status ?? all)}
            onChange={(value) =>
              setFilters({
                ...filters,
                status:
                  value === all
                    ? undefined
                    : value === "SOLD_ON_CREDIT"
                      ? "SOLD"
                      : (value as ProductStatus),
                credit: value === "SOLD_ON_CREDIT" ? true : undefined,
              })
            }
            options={[
              any,
              ...statuses.map((value) => ({
                value,
                label: t(`status.${value}`),
              })),
            ]}
          />
        </div>
        {facets.isPending ? (
          <div className="w-72 shrink-0">
            <ListSkeleton rows={1} />
          </div>
        ) : (
          <>
            <div className="grid w-36 shrink-0 gap-2 lg:w-44">
              <Label htmlFor={`${id}-category`}>{t("fields.category")}</Label>
              <OptionSelect
                id={`${id}-category`}
                value={
                  filters.category === undefined
                    ? all
                    : categoryPrefix + filters.category
                }
                onChange={(value) =>
                  setFilters({
                    ...filters,
                    category:
                      value === all
                        ? undefined
                        : value.slice(categoryPrefix.length),
                  })
                }
                options={[
                  any,
                  ...Array.from(categories, (category) => ({
                    value: categoryPrefix + category,
                    label: category,
                  })),
                ]}
              />
            </div>
            <div className="grid w-22 shrink-0 gap-2 lg:w-24">
              <Label htmlFor={`${id}-purity`}>{t("fields.purity")}</Label>
              <OptionSelect
                id={`${id}-purity`}
                value={filters.purity?.toString() ?? all}
                onChange={(value) =>
                  setFilters({
                    ...filters,
                    purity: value === all ? undefined : Number(value),
                  })
                }
                options={[
                  any,
                  ...Array.from(purities, (purity) => ({
                    value: String(purity),
                    label: String(purity),
                  })),
                ]}
              />
            </div>
          </>
        )}
        {Object.values(filters).some((value) => value !== undefined) && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 lg:min-h-9"
            onClick={() => setFilters({})}
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>
      {facets.isError && (
        <div className="mt-2">
          <ErrorState
            error={facets.error}
            retry={() => void facets.refetch()}
            pending={facets.isFetching}
          />
        </div>
      )}
    </>
  );
}
