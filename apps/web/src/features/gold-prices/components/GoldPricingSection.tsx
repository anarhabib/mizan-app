import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useEffect, useId, useRef, useState } from "react";
import {
  goldPriceKinds,
  goldPriceModes,
  type GoldEffectiveRate,
  type GoldPriceKind,
  type GoldPriceMode,
  type GoldPricingChange,
  type GoldPricingDraft,
  type GoldPricingSettings,
  type GoldRuleConfiguration,
  type StoreGoldPriceRule,
} from "@mizan/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmationContent } from "@/shared/ui/ConfirmationContent";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiError } from "@/shared/lib/api";
import { formatDateTime } from "@/shared/lib/format";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import {
  goldPricingPreviewQuery,
  goldPricingQuery,
  goldRuleHistoryQuery,
  useChangeGoldPrice,
} from "../api/queries";

type Scope = Parameters<typeof goldPricingQuery>[0];
type Selection = { kind: GoldPriceKind; purity: number | null };
type RuleFormValues = { mode: GoldPriceMode | "FOLLOW"; value: string };

function pricingError(
  error: ApiError,
  fallback: "settingsUnavailable" | "previewFailed" | "saveFailed",
) {
  switch (error.code) {
    case "GOLD_PRICE_CONFLICT":
      return "conflict";
    case "GOLD_PRICE_UNAVAILABLE":
      return "marketRequired";
    case "PURITY_CONFLICT":
      return "purityConflict";
    case "INVALID_SETTINGS":
      return "invalidValue";
    case "ACCESS_DENIED":
      return "accessDenied";
    default:
      return fallback;
  }
}

export function GoldPricingSection({
  scope,
  affectedKeys,
}: {
  scope: Scope;
  affectedKeys: (kind: GoldPriceKind) => readonly (readonly unknown[])[];
}) {
  const { t } = useTranslation("gold-prices");
  const heading = useId();
  const rulesTab = useRef<HTMLButtonElement>(null);
  const query = useQuery(goldPricingQuery(scope));
  const mutation = useChangeGoldPrice(scope, affectedKeys);
  const [view, setView] = useState("current");
  const [selection, select] = useState<Selection>({
    kind: "RETAIL_SELL",
    purity: null,
  });
  const data = query.data;
  const purities = data?.references.map(({ purity }) => purity) ?? [];
  const activeSelection =
    selection.purity !== null && !purities.includes(selection.purity)
      ? { ...selection, purity: null }
      : selection;
  const current = data?.rules.find(
    (rule) =>
      rule.kind === activeSelection.kind &&
      rule.purity === activeSelection.purity,
  );
  function edit(next: Selection) {
    select(next);
    mutation.reset();
  }
  async function save(body: GoldPricingChange) {
    try {
      await mutation.mutateAsync(body);
      toast.success(t("saved"));
      return true;
    } catch {
      return false;
    }
  }
  return (
    <section
      aria-labelledby={heading}
      className="grid min-w-0 gap-4 rounded-lg border bg-card p-4"
    >
      <h2 id={heading} className="font-heading text-base font-semibold">
        {t("title")}
      </h2>
      <Tabs value={view} onValueChange={setView} className="grid min-w-0 gap-4">
        <TabsList
          aria-label={t("title")}
          variant="line"
          className="grid h-auto w-full grid-cols-3 border-b group-data-horizontal/tabs:h-auto"
        >
          {(["current", "rules", "history"] as const).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              ref={tab === "rules" ? rulesTab : undefined}
              className="min-h-11 min-w-0 px-1 py-2 text-center wrap-anywhere whitespace-normal after:bg-brand-accent motion-reduce:transition-none motion-reduce:after:transition-none"
            >
              {t(tab)}
            </TabsTrigger>
          ))}
        </TabsList>
        {(["current", "rules"] as const).map((tab) => (
          <TabsContent
            key={tab}
            value={tab}
            className="grid min-w-0 gap-4 data-inactive:hidden"
          >
            {query.isPending && <ListSkeleton rows={3} />}
            {query.isError && (
              <PricingError
                error={query.error}
                fallback="settingsUnavailable"
                busy={query.isFetching}
                retry={() => void query.refetch()}
              />
            )}
            {data && tab === "current" && (
              <CurrentRates
                data={data}
                busy={mutation.isPending}
                edit={(next) => {
                  edit(next);
                  setView("rules");
                  rulesTab.current?.focus();
                }}
              />
            )}
            {data && tab === "rules" && (
              <>
                <RuleScope
                  selection={activeSelection}
                  purities={purities}
                  busy={mutation.isPending}
                  select={edit}
                />
                <RuleEditor
                  key={JSON.stringify(activeSelection)}
                  scope={scope}
                  selection={activeSelection}
                  current={current}
                  settingsRevision={JSON.stringify([
                    purities,
                    data.quote?.id,
                    data.stale,
                    data.rules.map(({ id }) => id),
                  ])}
                  busy={mutation.isPending || query.isError}
                  saving={mutation.isPending}
                  error={mutation.error}
                  save={save}
                />
              </>
            )}
          </TabsContent>
        ))}
        <TabsContent value="history">
          <PricingHistory scope={scope} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function PricingError({
  error,
  fallback,
  busy,
  retry,
}: {
  error: ApiError;
  fallback: "settingsUnavailable" | "previewFailed";
  busy: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation("gold-prices");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-destructive">
        {t(pricingError(error, fallback))}
      </p>
      <Button variant="outline" type="button" disabled={busy} onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
}

function CurrentRates({
  data,
  busy,
  edit,
}: {
  data: GoldPricingSettings;
  busy: boolean;
  edit: (selection: Selection) => void;
}) {
  const { t, i18n } = useTranslation("gold-prices");
  const columns = ["purity", "reference", ...goldPriceKinds] as const;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {data.quote
          ? t("lastUpdate", {
              date: formatDateTime(
                data.quote.retrievedAt,
                i18n.resolvedLanguage,
              ),
            })
          : t("unavailable")}
        {data.quote && data.stale && <> · {t("stale")}</>}
      </p>
      {!data.rates.length ? (
        <p className="text-muted-foreground">{t("noPurities")}</p>
      ) : (
        <Table role="table" className="w-full table-fixed text-sm">
          <TableHeader role="rowgroup" className="sr-only md:not-sr-only">
            <TableRow role="row" className="border-b text-left">
              {columns.map((column) => (
                <TableHead
                  key={column}
                  scope="col"
                  role="columnheader"
                  className="h-auto px-2 pb-2 font-medium wrap-anywhere whitespace-normal first:w-16"
                >
                  {t(column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody role="rowgroup" className="divide-y">
            {data.rates.map(({ purity, prices }, index) => {
              const reference = data.references[index];
              return (
                <TableRow
                  key={purity}
                  role="row"
                  className="grid grid-cols-2 gap-2 border-0 py-3 hover:bg-transparent md:table-row"
                >
                  <TableHead
                    scope="row"
                    role="rowheader"
                    className="col-span-2 h-auto px-0 text-left font-semibold tabular-nums md:px-2 md:py-3 md:align-top"
                  >
                    {purity}
                  </TableHead>
                  <TableCell
                    role="cell"
                    className="min-w-0 p-0 wrap-anywhere whitespace-normal md:px-2 md:py-3 md:align-top"
                  >
                    <span className="block text-xs text-muted-foreground md:hidden">
                      {t("reference")}
                    </span>
                    {reference?.pricePerGram ? (
                      <MoneyText value={reference.pricePerGram} />
                    ) : (
                      t("notSet")
                    )}
                  </TableCell>
                  {prices.map((price) => (
                    <TableCell
                      key={price.kind}
                      role="cell"
                      className="min-w-0 p-0 whitespace-normal md:px-2 md:py-1 md:align-top"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        aria-label={t("editRate", {
                          kind: t(price.kind),
                          purity,
                        })}
                        onClick={() => edit({ kind: price.kind, purity })}
                        className="h-auto min-h-11 w-full justify-between gap-1 px-1 text-left whitespace-normal md:min-h-9"
                      >
                        <span className="min-w-0 wrap-anywhere">
                          <span className="block text-xs text-muted-foreground md:hidden">
                            {t(price.kind)}
                          </span>
                          <RateValue price={price} />
                        </span>
                        <Pencil
                          aria-hidden="true"
                          className="size-3 shrink-0 text-muted-foreground"
                        />
                      </Button>
                      <Warnings warnings={price.warnings} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function RateValue({ price }: { price: GoldEffectiveRate }) {
  const { t } = useTranslation("gold-prices");
  return (
    <>
      {price.pricePerGram ? (
        <MoneyText value={price.pricePerGram} />
      ) : (
        t(price.status === "STALE" ? "staleRate" : "notSet")
      )}
      {price.source && (
        <span className="block text-xs font-normal text-muted-foreground">
          {price.source === "MARKET" ? t("automatic") : t(price.source)}
          {price.source !== "MARKET" && (
            <> · {t(price.mode === "FIXED" ? "manual" : "automatic")}</>
          )}
        </span>
      )}
    </>
  );
}

function Warnings({ warnings }: { warnings: GoldEffectiveRate["warnings"] }) {
  const { t } = useTranslation("gold-prices");
  return warnings.length ? (
    <ul className="text-xs wrap-anywhere text-warning-foreground">
      {warnings.map((warning) => (
        <li key={warning}>{t(warning)}</li>
      ))}
    </ul>
  ) : null;
}

function RuleScope({
  selection,
  purities,
  busy,
  select,
}: {
  selection: Selection;
  purities: number[];
  busy: boolean;
  select: (selection: Selection) => void;
}) {
  const { t } = useTranslation("gold-prices");
  const id = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={id + "-kind"}>{t("priceType")}</Label>
        <OptionSelect
          id={id + "-kind"}
          value={selection.kind}
          disabled={busy}
          options={goldPriceKinds.map((kind) => ({
            value: kind,
            label: t(kind),
          }))}
          onChange={(kind) =>
            select({ ...selection, kind: kind as GoldPriceKind })
          }
        />
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={id + "-scope"}>{t("scope")}</Label>
        <OptionSelect
          id={id + "-scope"}
          value={selection.purity === null ? "default" : "individual"}
          disabled={busy}
          options={[
            { value: "default", label: t("allPurities") },
            ...(purities.length
              ? [{ value: "individual", label: t("specificPurity") }]
              : []),
          ]}
          onChange={(value) =>
            select({
              ...selection,
              purity:
                value === "individual"
                  ? (selection.purity ?? purities[0])
                  : null,
            })
          }
        />
      </div>
      {selection.purity !== null && (
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={id + "-purity"}>{t("purity")}</Label>
          <OptionSelect
            id={id + "-purity"}
            value={String(selection.purity)}
            disabled={busy}
            options={purities.map((purity) => ({
              value: String(purity),
              label: String(purity),
            }))}
            onChange={(purity) =>
              select({ ...selection, purity: Number(purity) })
            }
          />
        </div>
      )}
    </div>
  );
}

function RuleEditor({
  scope,
  selection,
  current,
  settingsRevision,
  busy,
  saving,
  error,
  save,
}: {
  scope: Scope;
  selection: Selection;
  current?: StoreGoldPriceRule;
  settingsRevision: string;
  busy: boolean;
  saving: boolean;
  error: ApiError | null;
  save: (body: GoldPricingChange) => Promise<boolean>;
}) {
  const { t } = useTranslation("gold-prices");
  const id = useId();
  const saved = current?.configuration;
  const form = useForm<RuleFormValues>({
    defaultValues: {
      mode:
        !saved || (saved.mode !== "FIXED" && saved.value === "0")
          ? "FOLLOW"
          : saved.mode,
      value: saved?.value ?? "",
    },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const raw = useWatch({ control: form.control, name: "value" });
  const value = mode === "FOLLOW" ? "0" : raw.trim().replace(",", ".");
  const [debounced, setDebounced] = useState(value);
  const [dialog, setDialog] = useState<"fixed" | "reset" | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 300);
    return () => clearTimeout(timer);
  }, [value]);
  const draft: GoldPricingDraft | undefined =
    dialog === "reset"
      ? { ...selection, reset: true }
      : value && value === debounced
        ? { ...selection, mode: mode === "FOLLOW" ? "PERCENTAGE" : mode, value }
        : undefined;
  const preview = useQuery(
    goldPricingPreviewQuery(scope, draft, settingsRevision),
  );
  const result =
    preview.isError || preview.isFetching ? undefined : preview.data;
  const errors = error && (
    <p role="alert" className="text-destructive">
      {t(pricingError(error, "saveFailed"))}
    </p>
  );
  async function submit(confirmed?: true) {
    if (!draft || !result || busy) return;
    const { expectedPriceId, revision, quoteId } = result;
    if (
      await save({
        ...draft,
        expectedPriceId,
        revision,
        quoteId,
        confirmFixedDefault: confirmed,
      })
    ) {
      if ("reset" in draft) form.reset({ mode: "FOLLOW", value: "" });
      setDialog(null);
    }
  }
  const previewContent = (
    <>
      {draft && preview.isFetching && (
        <p role="status" className="text-muted-foreground">
          {t("loadingPreview")}
        </p>
      )}
      {preview.isError && (
        <PricingError
          error={preview.error}
          fallback="previewFailed"
          busy={preview.isFetching}
          retry={() => void preview.refetch()}
        />
      )}
      {result && (
        <div className="grid gap-2">
          <p className="font-medium">
            {t(selection.purity === null ? "affected" : "preview")}
          </p>
          {!result.rates.length && (
            <p className="text-muted-foreground">{t("noAffected")}</p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.rates.map((price) => (
              <li
                key={price.purity}
                className="min-w-0 rounded-md border px-3 py-2 wrap-anywhere"
              >
                {selection.purity === null && (
                  <span className="mr-2 tabular-nums">{price.purity}</span>
                )}
                <RateValue price={price} />
                <Warnings warnings={price.warnings} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
  return (
    <>
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit(() => {
          if (selection.purity === null && mode === "FIXED") setDialog("fixed");
          else return submit();
        })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor={id + "-method"}>{t("mode")}</Label>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <OptionSelect
                  id={id + "-method"}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  disabled={busy}
                  options={(["FOLLOW", ...goldPriceModes] as const).map(
                    (method) => ({ value: method, label: t(method) }),
                  )}
                />
              )}
            />
          </div>
          {mode !== "FOLLOW" && (
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={id + "-value"}>
                {t(mode === "PERCENTAGE" ? "percentValue" : "aznValue")}
              </Label>
              <Input
                id={id + "-value"}
                inputMode="decimal"
                autoComplete="off"
                disabled={busy}
                className="min-h-11 tabular-nums lg:min-h-9"
                aria-invalid={preview.error?.code === "INVALID_SETTINGS"}
                {...form.register("value")}
              />
            </div>
          )}
        </div>
        {dialog !== "reset" && previewContent}
        {!dialog && errors}
        <div className="flex flex-wrap gap-2">
          <PendingButton
            pending={form.formState.isSubmitting || saving}
            type="submit"
            className="min-h-11 lg:min-h-9"
            disabled={busy || !result}
          >
            {t("savePrice")}
          </PendingButton>
          {current && selection.purity !== null && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 lg:min-h-9"
              disabled={busy}
              onClick={() => setDialog("reset")}
            >
              {t("resetOverride")}
            </Button>
          )}
        </div>
      </form>
      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        {dialog && (
          <ConfirmationContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById(id + "-method")?.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <AlertDialogTitle className="font-heading text-base font-semibold">
              {t(dialog === "reset" ? "resetOverride" : "confirmFixedTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t(dialog === "reset" ? "confirmReset" : "confirmFixed")}
            </AlertDialogDescription>
            {dialog === "reset" && previewContent}
            {errors}
            <div className="flex flex-wrap justify-end gap-2">
              <AlertDialogCancel asChild>
                <Button
                  variant="outline"
                  disabled={busy}
                  className="min-h-11 lg:min-h-9"
                >
                  {t("cancel")}
                </Button>
              </AlertDialogCancel>
              <PendingButton
                pending={saving}
                className="min-h-11 lg:min-h-9"
                disabled={busy || !result}
                onClick={() =>
                  void submit(dialog === "fixed" ? true : undefined)
                }
              >
                {t("confirm")}
              </PendingButton>
            </div>
          </ConfirmationContent>
        )}
      </AlertDialog>
    </>
  );
}

function PricingHistory({ scope }: { scope: Scope }) {
  const { t, i18n } = useTranslation("gold-prices");
  const query = useInfiniteQuery(goldRuleHistoryQuery(scope));
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="grid gap-3">
      {query.isPending && <ListSkeleton rows={3} />}
      {query.isError && (
        <PricingError
          error={query.error}
          fallback="settingsUnavailable"
          busy={query.isFetching}
          retry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && !items.length && (
        <p className="text-muted-foreground">{t("noHistory")}</p>
      )}
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="grid gap-2 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-medium">
                {t(item.kind)} ·{" "}
                {item.purity === null
                  ? t("DEFAULT")
                  : t("purityScope", { purity: item.purity })}
              </p>
              <time
                className="text-muted-foreground"
                dateTime={item.effectiveAt}
              >
                {formatDateTime(item.effectiveAt, i18n.resolvedLanguage)}
              </time>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("previous")}</dt>
                <dd>
                  <Configuration value={item.previous} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("newConfiguration")}
                </dt>
                <dd>
                  <Configuration value={item.configuration} reset />
                </dd>
              </div>
            </dl>
            <p className="text-xs wrap-anywhere text-muted-foreground">
              {t("actor", { actor: item.actorId })}
            </p>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="outline"
          className="min-h-11 justify-self-start lg:min-h-9"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("more")}
        </Button>
      )}
    </div>
  );
}

function Configuration({
  value,
  reset = false,
}: {
  value: GoldRuleConfiguration | null;
  reset?: boolean;
}) {
  const { t } = useTranslation("gold-prices");
  if (!value) return t(reset ? "overrideReset" : "notSet");
  if (value.mode !== "FIXED" && value.value === "0") return t("FOLLOW");
  return (
    <span className="wrap-anywhere">
      {t(value.mode)} ·{" "}
      {value.mode === "PERCENTAGE" ? (
        t("percent", { value: value.value })
      ) : (
        <>
          <MoneyText value={{ amount: value.value, currency: "AZN" }} />{" "}
          {t("perGram")}
        </>
      )}
    </span>
  );
}
