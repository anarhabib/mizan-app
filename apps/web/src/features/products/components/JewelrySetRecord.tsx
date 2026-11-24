import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  acquisitionComponents,
  categoryLabel,
  type JewelrySetProduct,
  type JewelrySetTotals,
  type MoneyInput,
} from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { formatDecimal } from "@/shared/lib/format";
import { WeightText } from "@/shared/ui/WeightText";
import { PurityText } from "@/shared/ui/PurityText";
import { ProductStatusBadge } from "./ProductList";

export function SetAvailability({
  totals,
}: {
  totals: Pick<JewelrySetTotals, "unavailableCount">;
}) {
  const { t } = useTranslation("products");
  return (
    <Badge variant={totals.unavailableCount ? "warning" : "success"}>
      {t(totals.unavailableCount ? "sets.unavailable" : "sets.available")}
    </Badge>
  );
}

function RecordedMoney({ value }: { value: MoneyInput }) {
  const { i18n } = useTranslation();
  return (
    <span className="tabular-nums">
      {formatDecimal(value.amount, i18n.resolvedLanguage ?? "az")}{" "}
      {value.currency}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 wrap-anywhere">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export function SetTotals({ totals }: { totals: JewelrySetTotals }) {
  const { t } = useTranslation("products");
  return (
    <section className="grid gap-2 rounded-lg border bg-muted p-3">
      <h3 className="font-semibold">{t("sets.totals")}</h3>
      <dl className="grid grid-cols-2 gap-3">
        <Fact label={t("sets.items")}>{totals.itemCount}</Fact>
        <Fact label={t("sets.grossWeight")}>
          <WeightText value={totals.grossWeight} />
        </Fact>
        <Fact label={t("sets.netWeight")}>
          {totals.netGoldWeight ? (
            <WeightText value={totals.netGoldWeight} />
          ) : (
            t("sets.netWeightMissing")
          )}
        </Fact>
        {totals.acquisitionValues && (
          <Fact label={t("sets.acquisitionValues")}>
            {totals.acquisitionValues.map((value) => (
              <span key={value.currency} className="block">
                <RecordedMoney value={value} />
              </span>
            ))}
          </Fact>
        )}
      </dl>
    </section>
  );
}

export function SetProduct({
  product,
  link,
}: {
  product: JewelrySetProduct;
  link?: boolean;
}) {
  const { t, i18n } = useTranslation("products");
  const name = `${product.code} · ${product.name}`;
  const category = product.productCategory
    ? categoryLabel(product.productCategory, i18n.resolvedLanguage)
    : product.category;
  const cost = product.acquisitionCost;
  const rate = product.acquisitionCostPerGram;
  return (
    <div className="min-w-0 space-y-1 wrap-anywhere">
      {link ? (
        <Link
          to="/products"
          search={{ product: product.id }}
          className="inline-flex min-h-11 items-center rounded-sm font-medium underline underline-offset-4 lg:min-h-9"
        >
          {name}
        </Link>
      ) : (
        <p className="font-medium">{name}</p>
      )}
      <p className="text-sm text-muted-foreground">
        {category} · <PurityText value={product.purity} />
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {t("sets.grossWeight")} <WeightText value={product.weight} />
        </span>
        {product.netGoldWeight && (
          <span>
            {t("sets.netWeight")} <WeightText value={product.netGoldWeight} />
          </span>
        )}
        <ProductStatusBadge status={product.status} />
      </div>
      {cost && (
        <p>
          {t("sets.acquisitionCost")} <RecordedMoney value={cost} />
        </p>
      )}
      {rate && (
        <p>
          {t("sets.acquisitionRate")} <RecordedMoney value={rate} />
        </p>
      )}
      {cost &&
        acquisitionComponents.map((key) => {
          const amount = product.acquisitionBreakdown?.[key];
          return (
            amount && (
              <p key={key}>
                {t(`jewelry.components.${key}`)}{" "}
                <RecordedMoney value={{ currency: cost.currency, amount }} />
              </p>
            )
          );
        })}
    </div>
  );
}
