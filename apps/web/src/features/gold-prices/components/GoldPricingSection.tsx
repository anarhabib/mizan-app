import { useEffect, useId, useState } from "react";
import {
  goldPriceModes,
  type GoldPriceKind,
  type GoldPriceMode,
  type GoldPricingChange,
  type StoreGoldPrice,
} from "@mizan/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyText } from "@/shared/ui/MoneyText";
import {
  goldPricingPreviewQuery,
  goldPricingQuery,
  useChangeGoldPrice,
} from "../api/queries";

type Scope = Parameters<typeof goldPricingQuery>[0];
const selectStyle =
  "h-11 w-full rounded-md border border-control-border bg-control px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9";

export function GoldPricingSection({
  scope,
  affectedKeys,
}: {
  scope: Scope;
  affectedKeys: (kind: GoldPriceKind) => readonly (readonly unknown[])[];
}) {
  const { t } = useTranslation("gold-prices");
  const heading = useId();
  const purityId = useId();
  const query = useQuery(goldPricingQuery(scope));
  const client = useQueryClient();
  const mutation = useChangeGoldPrice(scope);
  const [selected, setSelected] = useState<number>();
  const kind = "SELL";
  const data = query.data;
  const reference =
    data?.references.find(({ purity }) => purity === selected) ??
    data?.references[0];
  const current = data?.rules.find(
    (rule) => rule.kind === kind && rule.purity === reference?.purity,
  );
  const activePrice = current
    ? current.pricePerGram
    : data?.stale
      ? null
      : reference?.pricePerGram;
  async function save(body: GoldPricingChange) {
    try {
      await mutation.mutateAsync(body);
      await Promise.all(
        affectedKeys(body.kind).map((queryKey) =>
          client.invalidateQueries({ queryKey, exact: true }),
        ),
      );
    } catch {
      // The mutation state renders the error beside the form.
    }
  }
  return (
    <section
      aria-labelledby={heading}
      className="grid gap-4 rounded-lg border bg-card p-4"
    >
      <h2 id={heading} className="font-heading text-base font-semibold">
        {t("sellingRulesTitle")}
      </h2>
      {query.isPending && <p role="status">{t("loading")}</p>}
      {query.isError && (
        <div className="grid justify-items-start gap-2">
          <p role="alert" className="text-destructive">
            {t("settingsUnavailable")}
          </p>
          <Button
            variant="outline"
            className="min-h-11 lg:min-h-9"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {data && !reference && (
        <p className="text-muted-foreground">{t("noPurities")}</p>
      )}
      {data && reference && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="grid gap-2">
              <Label htmlFor={purityId}>{t("purity")}</Label>
              <select
                id={purityId}
                className={selectStyle}
                value={reference.purity}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setSelected(Number(event.target.value));
                  mutation.reset();
                }}
              >
                {data.references.map(({ purity }) => (
                  <option value={purity} key={purity}>
                    {purity}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-y py-3">
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">
                {t("currentPrice")}
              </dt>
              <dd className="font-medium break-words">
                {activePrice ? (
                  <>
                    <MoneyText value={activePrice} /> {t("perGram")}
                  </>
                ) : (
                  t("unavailable")
                )}
              </dd>
              {!current && (
                <dd className="text-xs text-muted-foreground">
                  {t("marketDefault")}
                </dd>
              )}
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">
                {t("reference")}
              </dt>
              <dd className="font-medium break-words">
                {reference.pricePerGram ? (
                  <>
                    <MoneyText value={reference.pricePerGram} /> {t("perGram")}
                  </>
                ) : (
                  t("unavailable")
                )}
              </dd>
              {reference.pricePerGram && data.stale && (
                <dd className="text-xs text-muted-foreground">{t("stale")}</dd>
              )}
            </div>
          </dl>
          <PriceRuleForm
            key={`${kind}/${reference.purity}/${current?.id ?? ""}`}
            scope={scope}
            kind={kind}
            purity={reference.purity}
            current={current}
            quoteId={data.stale ? undefined : data.quote?.id}
            busy={mutation.isPending || query.isError}
            save={save}
          />
        </>
      )}
      {mutation.isError && (
        <p role="alert" className="text-destructive">
          {t(
            mutation.error.status === 409
              ? "conflict"
              : mutation.error.status === 403
                ? "accessDenied"
                : "saveFailed",
          )}
        </p>
      )}
      {mutation.isSuccess && <p role="status">{t("saved")}</p>}
    </section>
  );
}

function PriceRuleForm({
  scope,
  kind,
  purity,
  current,
  quoteId,
  busy,
  save,
}: {
  scope: Scope;
  kind: GoldPriceKind;
  purity: number;
  current: StoreGoldPrice | undefined;
  quoteId: string | undefined;
  busy: boolean;
  save: (body: GoldPricingChange) => Promise<void>;
}) {
  const { t } = useTranslation("gold-prices");
  const modeId = useId();
  const valueId = useId();
  const form = useForm<{ mode: GoldPriceMode; value: string }>({
    defaultValues: {
      mode: current?.mode ?? "FIXED",
      value: current?.value ?? "",
    },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const value = useWatch({ control: form.control, name: "value" })
    .trim()
    .replace(",", ".");
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  const canPreview = Boolean(
    value && value === debounced && (mode === "FIXED" || quoteId),
  );
  const preview = useQuery(
    goldPricingPreviewQuery(
      scope,
      canPreview ? { kind, purity, mode, value } : undefined,
      mode === "FIXED" ? undefined : quoteId,
    ),
  );
  const result = preview.isError ? undefined : preview.data;
  const invalid = preview.isError && preview.error.status === 400;
  return (
    <form
      onSubmit={form.handleSubmit(async () => {
        if (result && !busy)
          await save({
            kind,
            purity,
            mode,
            value,
            expectedPriceId: current?.id ?? null,
            ...(result.quoteId && { quoteId: result.quoteId }),
          });
      })}
    >
      <fieldset
        className="grid gap-3"
        disabled={busy || form.formState.isSubmitting}
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
          <div className="grid gap-2">
            <Label htmlFor={modeId}>{t("mode")}</Label>
            <select
              id={modeId}
              className={selectStyle}
              {...form.register("mode")}
            >
              {goldPriceModes.map((option) => (
                <option value={option} key={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={valueId}>
              {t(mode === "PERCENTAGE" ? "percentValue" : "aznValue")}
            </Label>
            <Input
              id={valueId}
              inputMode={mode === "FIXED" ? "decimal" : "text"}
              autoComplete="off"
              className="min-h-11 tabular-nums lg:min-h-9"
              aria-invalid={invalid}
              aria-describedby={invalid ? `${valueId}-error` : undefined}
              {...form.register("value")}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            className="min-h-11 lg:min-h-9"
            disabled={!result}
          >
            {t("savePrice")}
          </Button>
          {result && (
            <p role="status">
              {t("preview")} <MoneyText value={result.pricePerGram} />{" "}
              {t("perGram")}
            </p>
          )}
        </div>
        {mode !== "FIXED" && !quoteId && (
          <p role="status" className="text-muted-foreground">
            {t("marketRequired")}
          </p>
        )}
        {preview.isError && (
          <p id={`${valueId}-error`} role="alert" className="text-destructive">
            {t(invalid ? "invalidValue" : "previewFailed")}
          </p>
        )}
      </fieldset>
    </form>
  );
}
