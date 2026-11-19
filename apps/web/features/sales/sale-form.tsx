"use client";

import Link from "next/link";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  currencyMinorUnits,
  type ProductListItem,
  type ProductList,
  type SaleCreateInput,
} from "@mizan/contracts";
import { actionClass, Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Surface } from "../../components/ui/surface";
import { PageHeading } from "../../components/ui/page-heading";
import type { Locale } from "../language/messages";
import {
  productCopy,
  productHref,
  type ProductScope,
} from "../products/product-copy";
import { ProductIdentity, ProductLookup } from "./product-lookup";
import { submitSale } from "./sale-actions";
import { SaleConfirmation, type SaleReview } from "./sale-confirmation";
import { saleCopy, type SaleOptions } from "./sale-copy";
import { SettlementSummary } from "./settlement-summary";
import { previewSale, saleDecimal } from "./settlement";
import { selectClass, TradeInLines, type TradeDraft } from "./trade-in-lines";

export function SaleForm({
  locale,
  scope,
  options,
  currencyScales,
  initialProduct,
  initialStock,
  missingProduct,
}: {
  locale: Locale;
  scope: ProductScope;
  options: SaleOptions;
  currencyScales: Readonly<Record<string, number>>;
  initialProduct?: ProductListItem;
  initialStock?: ProductList;
  missingProduct?: boolean;
}) {
  const copy = saleCopy[locale];
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [unavailable, setUnavailable] = useState(
    missingProduct || initialProduct?.status === "SOLD",
  );
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState<TradeDraft[]>([]);
  const [tender, setTender] = useState(false);
  const [chosenCurrency, setChosenCurrency] = useState("");
  const [cash, setCash] = useState("");
  const [exchange, setExchange] = useState("");
  const [review, setReview] = useState<SaleReview | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draftCurrency, setDraftCurrency] = useState(options.currency);
  const [validation, setValidation] = useState(false);
  const [error, setError] = useState("");
  const [refreshOptions, setRefreshOptions] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const { currency } = options;
  const currencyChanged = draftCurrency !== currency;
  const cashCurrency = chosenCurrency || currency;
  const minorUnits = (code: string) =>
    currencyScales[code] ?? currencyMinorUnits(code);
  const scale = minorUnits(currency);
  let draft: Omit<SaleCreateInput, "productId"> | undefined;
  let preview: SaleReview["preview"] | undefined;
  let cashDue = false;

  try {
    const valuedLines = lines.map((line) => {
      const rate = options.rates.find((entry) => entry.purity === line.purity);
      if (!rate) throw new RangeError("Unavailable rate");
      return {
        purity: line.purity,
        rateId: rate.id,
        rate: rate.amountPerGram,
        weight: saleDecimal(line.weight, 3, 12),
        overrideAmount: line.overrideAmount.trim()
          ? saleDecimal(line.overrideAmount, scale, 16, true)
          : undefined,
      };
    });
    const saleAmount = saleDecimal(amount, scale, 16);
    const base = previewSale(
      currency,
      saleAmount,
      valuedLines,
      undefined,
      minorUnits,
    );
    cashDue = !base.balance.startsWith("-") && /[1-9]/.test(base.balance);
    const payment =
      tender && cashDue
        ? {
            currency: cashCurrency,
            amount: saleDecimal(cash, minorUnits(cashCurrency), 16),
            exchangeRate:
              cashCurrency !== currency
                ? saleDecimal(exchange, 8, 12)
                : undefined,
          }
        : undefined;
    preview = payment
      ? previewSale(currency, saleAmount, valuedLines, payment, minorUnits)
      : base;
    draft = {
      expectedCurrency: currency,
      saleAmount,
      tradeIns: valuedLines.map(
        ({ purity, rateId, weight, overrideAmount }) => ({
          purity,
          rateId,
          weight,
          overrideAmount,
        }),
      ),
      payment,
    };
  } catch {
    // Incomplete amounts are expected while editing.
  }

  function reviewSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidation(!draft || !product || !!unavailable);
    if (
      !draft ||
      !preview ||
      !product ||
      unavailable ||
      review ||
      currencyChanged ||
      inFlight.current
    )
      return;
    setError("");
    setReview({
      product,
      input: { ...draft, productId: product.id },
      preview,
      key: crypto.randomUUID(),
    });
    setReviewOpen(true);
  }

  function close() {
    if (inFlight.current) return;
    setReviewOpen(false);
    if (!uncertain) setReview(null);
    if (refreshOptions) {
      setRefreshOptions(false);
      router.refresh();
    }
  }

  async function confirm() {
    if (!review || inFlight.current || (error && !uncertain)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    let navigating = false;
    try {
      const response = await submitSale(scope, review.input, review.key);
      if (response.id) {
        navigating = true;
        router.replace(
          productHref("/sales/" + encodeURIComponent(response.id), scope),
        );
        return;
      }
      if (response.status === 401) {
        navigating = true;
        router.push("/sign-in");
        return;
      }
      const field = response.error?.field;
      if (response.status === 404 || field === "productId") {
        setUnavailable(true);
        setError(copy.unavailable);
      } else if (field === "currency" || field === "rateId") {
        setRefreshOptions(true);
        setError(copy.settingsChanged);
      } else {
        setError(copy.failed);
      }
      setUncertain(response.status >= 500);
    } catch {
      setError(copy.failed);
      setUncertain(true);
    } finally {
      if (!navigating) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section className="grid gap-4">
      <PageHeading
        title={copy.title}
        description={copy.startDescription}
        actions={
          <Link
            className={actionClass + " mizan-table-action"}
            href={productHref("/sales", scope)}
          >
            ← {copy.backToSales}
          </Link>
        }
      />
      {review && !reviewOpen && (
        <Surface className="grid gap-3 p-4">
          <p role="status">{copy.pending}</p>
          <Button className="w-fit" onClick={() => setReviewOpen(true)}>
            {copy.resume}
          </Button>
        </Surface>
      )}
      {currencyChanged && (
        <Surface className="grid gap-3 p-4">
          <p role="alert">
            {copy.currencyChanged} ({draftCurrency} → {currency})
          </p>
          <Button
            className="w-fit"
            onClick={() => {
              setDraftCurrency(currency);
              setExchange("");
              if (!chosenCurrency) setCash("");
            }}
          >
            {copy.useCurrency} {currency}
          </Button>
        </Surface>
      )}
      <fieldset
        disabled={(!!review && !reviewOpen) || currencyChanged}
        className="m-0 grid min-w-0 items-stretch gap-3 border-0 p-0 min-[1100px]:grid-cols-[minmax(0,1.73fr)_minmax(0,1fr)]"
      >
        <Surface className="grid min-w-0 content-start gap-4 p-4 sm:p-5">
          <ProductLookup
            locale={locale}
            scope={scope}
            initial={initialStock}
            onSelect={(item) => {
              setProduct(item);
              setUnavailable(false);
            }}
          />
        </Surface>
        <Surface className="min-w-0 p-4 sm:p-5">
          <form onSubmit={reviewSale} className="m-0 grid min-w-0 gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-xl tracking-tight">{copy.cart}</h2>
              <span className="rounded-full border border-mizan-edge bg-mizan-selected px-2 py-0.5 text-xs font-bold">
                {product && !unavailable ? 1 : 0}{" "}
                {locale === "az" ? "məhsul" : "item"}
              </span>
            </div>
            {product && !unavailable ? (
              <div className="rounded-xl border border-mizan-edge/50 bg-mizan-field p-3">
                <ProductIdentity locale={locale} product={product} />
              </div>
            ) : (
              <p className="m-0 grid min-h-24 place-items-center text-center text-xs text-mizan-muted">
                {copy.cartEmpty}
              </p>
            )}
            {unavailable && <p role="alert">{copy.unavailable}</p>}
            <div className="grid gap-4">
              <Field
                id="sale-amount"
                label={copy.amount + " (" + draftCurrency + ")"}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <TradeInLines
                locale={locale}
                options={options}
                lines={lines}
                onChange={setLines}
              />
              {cashDue && (
                <div className="grid gap-3">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tender}
                      onChange={(event) => setTender(event.target.checked)}
                    />
                    {copy.tender}
                  </label>
                  {tender && (
                    <>
                      <div className="grid gap-1.5">
                        <label
                          htmlFor="sale-cash-currency"
                          className="text-sm font-bold"
                        >
                          {productCopy[locale].currency}
                        </label>
                        <select
                          id="sale-cash-currency"
                          className={selectClass}
                          value={cashCurrency}
                          onChange={(event) => {
                            setChosenCurrency(event.target.value);
                            setCash("");
                            setExchange("");
                          }}
                        >
                          {Object.keys(currencyScales).map((code) => (
                            <option key={code}>{code}</option>
                          ))}
                        </select>
                      </div>
                      <Field
                        id="cash-received"
                        label={copy.cash + " (" + cashCurrency + ")"}
                        inputMode="decimal"
                        value={cash}
                        onChange={(event) => setCash(event.target.value)}
                      />
                      {cashCurrency !== currency && (
                        <Field
                          id="exchange-rate"
                          label={
                            copy.exchange +
                            " (" +
                            currency +
                            " / " +
                            cashCurrency +
                            ")"
                          }
                          inputMode="decimal"
                          value={exchange}
                          onChange={(event) => setExchange(event.target.value)}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-4 border-t border-mizan-edge/50 pt-4">
              {preview && draft && !currencyChanged && (
                <SettlementSummary
                  locale={locale}
                  currency={currency}
                  amount={draft.saleAmount}
                  payment={draft.payment}
                  {...preview}
                />
              )}
              {validation && (!draft || !product) && (
                <p role="alert">{!product ? copy.choose : copy.invalid}</p>
              )}
              <Button
                type="submit"
                className="mizan-page-action w-full"
                disabled={
                  !product || !!unavailable || (!!review && !reviewOpen)
                }
              >
                {copy.review}
              </Button>
            </div>
          </form>
        </Surface>
      </fieldset>
      <SaleConfirmation
        locale={locale}
        review={reviewOpen ? review : null}
        currency={review?.input.expectedCurrency ?? currency}
        busy={busy}
        uncertain={uncertain}
        error={error}
        close={close}
        confirm={() => void confirm()}
      />
    </section>
  );
}
