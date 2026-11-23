import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProductStatus } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import {
  productFacetsQuery,
  type ProductFilters as Filters,
  type ProductScope,
} from "../api/queries";
import { ProductPanel } from "./ProductPanel";

type FacetFilters = Omit<Filters, "q">;
const all = "all";
const categoryPrefix = "category:";
const statuses = ["IN_STOCK", "SOLD"] as const;

export function ProductFilters({
  scope,
  filters,
  setFilters,
}: {
  scope: ProductScope;
  filters: FacetFilters;
  setFilters: (filters: FacetFilters) => void;
}) {
  const { t } = useTranslation("products");
  const mobile = useIsMobile();
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const active = Object.values(filters).some((value) => value !== undefined);

  if (!mobile)
    return (
      <FilterFields scope={scope} filters={filters} setFilters={setFilters} />
    );
  return (
    <>
      <Button
        type="button"
        variant={active ? "secondary" : "outline"}
        className="min-h-11 shrink-0"
        onClick={(event) => setOpener(event.currentTarget)}
      >
        <SlidersHorizontal aria-hidden="true" />
        {t("filters")}
      </Button>
      {opener && (
        <ProductPanel
          title={t("filters")}
          close={() => setOpener(null)}
          opener={opener}
        >
          <FilterFields
            scope={scope}
            filters={filters}
            setFilters={setFilters}
          />
          <Button
            type="button"
            className="mt-4 min-h-11 w-full"
            onClick={() => setOpener(null)}
          >
            {t("showResults")}
          </Button>
        </ProductPanel>
      )}
    </>
  );
}

function FilterFields({
  scope,
  filters,
  setFilters,
}: {
  scope: ProductScope;
  filters: FacetFilters;
  setFilters: (filters: FacetFilters) => void;
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
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-status`}>{t("fields.status")}</Label>
        <OptionSelect
          id={`${id}-status`}
          value={filters.status ?? all}
          onChange={(value) =>
            setFilters({
              ...filters,
              status: value === all ? undefined : (value as ProductStatus),
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
        <div className="lg:col-span-2">
          <ListSkeleton rows={1} />
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-2">
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
          <div className="grid gap-2">
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
      {facets.isError && (
        <div className="lg:col-span-3">
          <ErrorState
            error={facets.error}
            retry={() => void facets.refetch()}
            pending={facets.isFetching}
          />
        </div>
      )}
    </div>
  );
}
