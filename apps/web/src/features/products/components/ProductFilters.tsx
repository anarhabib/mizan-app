import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useId, type ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { categoryLabel, type ProductStatus } from "@mizan/contracts";
import { categoryQuery } from "@/features/product-categories";
import { useWorkspace } from "@/features/workspace";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
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
const statuses = [
  "IN_STOCK",
  "IN_REPAIR",
  "UNAVAILABLE",
  "SOLD",
  "SOLD_ON_CREDIT",
] as const;

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
  const { t, i18n } = useTranslation("products");
  const id = useId();
  const mobile = useIsMobile();
  const facets = useQuery(productFacetsQuery(scope));
  const { canManageAsOwner } = useWorkspace();
  const categories = useQuery(
    categoryQuery(scope.organizationId, canManageAsOwner),
  );
  const purities = new Set(facets.data?.purities);
  if (filters.purity !== undefined) purities.add(filters.purity);
  const any = { value: all, label: t("all") };

  const fields = (
    <>
      <div className="grid min-w-0 gap-2 lg:w-40 lg:shrink-0">
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
      {categories.isPending ? (
        <div className="lg:w-44 lg:shrink-0">
          <ListSkeleton rows={1} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-2 lg:w-44 lg:shrink-0">
          <Label htmlFor={`${id}-category`}>{t("fields.category")}</Label>
          <OptionSelect
            id={`${id}-category`}
            value={filters.categoryId ?? all}
            onChange={(value) =>
              setFilters({
                ...filters,
                category: undefined,
                categoryId: value === all ? undefined : value,
              })
            }
            disabled={!categories.data?.length}
            options={[
              any,
              ...(categories.data ?? []).map((category) => ({
                value: category.id,
                label: categoryLabel(category, i18n.resolvedLanguage),
              })),
            ]}
          />
        </div>
      )}
      {facets.isPending ? (
        <div className="lg:w-24 lg:shrink-0">
          <ListSkeleton rows={1} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-2 lg:w-24 lg:shrink-0">
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
      )}
      <div className="grid min-w-0 gap-2 lg:w-44 lg:shrink-0">
        <Label htmlFor={`${id}-gemstones`}>{t("jewelry.gemstones")}</Label>
        <OptionSelect
          id={`${id}-gemstones`}
          value={filters.gemstones ?? all}
          onChange={(value) =>
            setFilters({
              ...filters,
              gemstones:
                value === "recorded" || value === "none" ? value : undefined,
            })
          }
          options={[
            any,
            { value: "recorded", label: t("jewelry.filterRecorded") },
            { value: "none", label: t("jewelry.filterNone") },
          ]}
        />
      </div>
      {Object.values(filters).some((value) => value !== undefined) && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 shrink-0 justify-self-start lg:min-h-9"
          onClick={() => setFilters({})}
        >
          {t("clearFilters")}
        </Button>
      )}
    </>
  );
  const facetError = facets.isError && (
    <ErrorState
      error={facets.error}
      retry={() => void facets.refetch()}
      pending={facets.isFetching}
    />
  );
  const categoryError = categories.isError && !categories.data && (
    <ErrorState
      error={categories.error}
      retry={() => void categories.refetch()}
      pending={categories.isFetching}
    />
  );

  return (
    <>
      <div className="flex min-w-0 items-end gap-3 p-1 lg:overflow-x-auto">
        {children}
        {mobile ? (
          <Drawer autoFocus>
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0"
              >
                <ListFilter aria-hidden="true" />
                {t("filters")}
              </Button>
            </DrawerTrigger>
            <DrawerContent
              aria-describedby={undefined}
              className="data-[vaul-drawer-direction=bottom]:max-h-[85dvh]"
            >
              <DrawerHeader className="flex-row items-center justify-between gap-3">
                <DrawerTitle>{t("filters")}</DrawerTitle>
                <DrawerClose asChild>
                  <Button type="button" variant="ghost" className="min-h-11">
                    {t("close")}
                  </Button>
                </DrawerClose>
              </DrawerHeader>
              <div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {fields}
                {facetError}
                {categoryError}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <div
            className="flex shrink-0 items-end gap-3"
            role="group"
            aria-label={t("filters")}
          >
            {fields}
          </div>
        )}
      </div>
      {!mobile && facets.isError && <div className="mt-2">{facetError}</div>}
      {!mobile && categoryError && <div className="mt-2">{categoryError}</div>}
    </>
  );
}
