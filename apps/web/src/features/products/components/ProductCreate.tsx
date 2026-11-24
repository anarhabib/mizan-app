import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import {
  isSupplierCurrency,
  maxPurchaseItems,
  parseProductRegistration,
  productRegistrationSources,
  supplierPaymentMethods,
  type ProductCreateInput,
  type ProductRegistrationInput,
  type ProductRegistrationSource,
  type SupplierOption,
  type SupplierPaymentMethod,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/features/workspace";
import {
  PurchaseStatus,
  SupplierPicker,
  formatPayable,
  todayInBaku,
  useFinancialAttempt,
} from "@/features/suppliers";
import { ApiError } from "@/shared/lib/api";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { PendingButton } from "@/shared/ui/PendingButton";
import { WeightText } from "@/shared/ui/WeightText";
import {
  uploadPreparedProductPhoto,
  useRegisterProducts,
} from "../api/mutations";
import { productOptionsQuery, type ProductScope } from "../api/queries";
import type { ProductFormValues } from "../lib/form";
import { prepareProductPhoto } from "../lib/photo";
import { previewRegistration, type ProductPreview } from "../lib/registration";
import { ProductPanel } from "./ProductPanel";
import { productDefaults, useProductCategories } from "./ProductForm";
import {
  ProductRegistrationRow,
  type RowHandle,
} from "./ProductRegistrationRow";

type Row = { id: string; defaults: ProductFormValues };
type Photo = { id: string; code: string; jpeg: Blob; uploadId?: string };

export function ProductCreate({
  scope,
  currency,
  opener,
  close,
  created,
}: {
  scope: ProductScope;
  currency: string;
  opener: HTMLElement;
  close: () => void;
  created: (product: { id: string }) => void;
}) {
  const { t, i18n } = useTranslation([
    "products",
    "suppliers",
    "errors",
    "sales",
  ]);
  const mobile = useIsMobile();
  const formId = useId();
  const { canManageAsOwner } = useWorkspace();
  const options = useQuery(productOptionsQuery(scope));
  const categories = useProductCategories(scope);
  const registration = useRegisterProducts(scope);
  const attempt = useFinancialAttempt<ProductRegistrationInput>(
    scope,
    "product-registration",
  );
  const [bulk, setBulk] = useState(false);
  const [source, setSource] = useState<ProductRegistrationSource>("OTHER");
  const [supplier, setSupplier] = useState<SupplierOption>();
  const [historicalSupplier, setHistoricalSupplier] =
    useState<SupplierOption>();
  const [purchaseDate, setPurchaseDate] = useState(todayInBaku);
  const [purchaseCurrency, setPurchaseCurrency] = useState(currency);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [method, setMethod] = useState<SupplierPaymentMethod>();
  const [defaults, setDefaults] = useState(() => productDefaults(currency));
  const [rows, setRows] = useState<Row[]>(() => [
    { id: crypto.randomUUID(), defaults },
  ]);
  const [editingRow, setEditingRow] = useState(rows[0].id);
  const [previews, setPreviews] = useState<Record<string, ProductPreview>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string }>();
  const [photoResult, setPhotoResult] = useState<{
    pending: Photo[];
    saved: number;
  }>();
  const lock = useRef(false);
  const handles = useRef(new Map<string, RowHandle>());
  const prepared = useRef(new WeakMap<File, Blob>());
  const purchasing = canManageAsOwner && source === "SUPPLIER_PURCHASE";
  const selectedCurrency = purchasing
    ? purchaseCurrency.trim().toUpperCase()
    : undefined;
  const activeRows = bulk ? rows : rows.slice(0, 1);
  const payment = initialPayment.trim();
  const hasPayment = payment !== "" && !/^0(?:\.0{1,4})?$/.test(payment);
  const summary = previewRegistration(
    activeRows.map(({ id }) => previews[id]),
    selectedCurrency,
    payment,
  );
  const locale = i18n.resolvedLanguage ?? "az";
  const onPreview = useCallback((id: string, preview: ProductPreview) => {
    setPreviews((current) => ({ ...current, [id]: preview }));
  }, []);

  function revealRow(id: string) {
    setEditingRow(id);
    requestAnimationFrame(() => {
      const header = document.getElementById(`registration-row-${id}`);
      header?.focus({ preventScroll: true });
      header?.scrollIntoView({ block: "nearest" });
    });
  }

  function addRow(values: ProductFormValues) {
    if (rows.length >= maxPurchaseItems) return;
    const id = crypto.randomUUID();
    if (mobile) revealRow(id);
    else handles.current.forEach((row) => row.collapse());
    setRows((current) => [...current, { id, defaults: values }]);
  }

  function removeRow(id: string) {
    const remainingRows = rows.filter((row) => row.id !== id);
    if (editingRow === id) setEditingRow(remainingRows[0].id);
    setRows(remainingRows);
    setPreviews((current) => {
      const remaining = { ...current };
      delete remaining[id];
      return remaining;
    });
    setError(undefined);
  }

  function applyDefaults(draft: ProductFormValues) {
    setDefaults({
      ...productDefaults(currency),
      categoryId: draft.categoryId,
      purity: draft.purity,
      metalType: draft.metalType,
      acquisitionMode: draft.acquisitionMode,
      acquisitionCostPerGram: { ...draft.acquisitionCostPerGram },
      acquisitionCost: {
        amount: "",
        currency: draft.acquisitionCost?.currency ?? currency,
      },
      fixedSellingPrice: {
        amount: "",
        currency: draft.fixedSellingPrice?.currency ?? currency,
      },
    });
    toast.success(t("registration.defaultsSaved"));
  }

  async function attachPhotos(photos: Photo[]) {
    const failed: Photo[] = [];
    for (const photo of photos) {
      try {
        await uploadPreparedProductPhoto(scope, photo.id, photo.jpeg, photo);
      } catch {
        failed.push(photo);
      }
    }
    return failed;
  }

  function finish(ids: string[]) {
    toast.success(
      ids.length === 1
        ? t("created")
        : t("registration.savedMany", { count: ids.length }),
    );
    if (ids.length === 1) created({ id: ids[0] });
    else close();
  }

  function showError(error: ApiError, rowHandles: (RowHandle | undefined)[]) {
    const row = /^products\.(\d+)\.(.+)$/.exec(error.field ?? "");
    if (row) {
      if (mobile && bulk && activeRows[+row[1]])
        revealRow(activeRows[+row[1]].id);
      rowHandles[+row[1]]?.showError(
        new ApiError(
          error.status,
          error.code,
          error.message,
          row[2],
          error.isNetwork,
        ),
      );
      setError({ message: t("registration.rowErrors") });
      return;
    }
    const field = error.field;
    const message =
      error.isNetwork || error.status === 408 || error.status >= 500
        ? t("registration.retrySame")
        : error.code === "SUPPLIER_OVERPAYMENT"
          ? t("registration.overpayment")
          : error.code === "INVALID_PRODUCT" && field
            ? t(`registration.errors.${field.replaceAll(".", "_")}`, {
                defaultValue: t("registration.checkFields"),
              })
            : t(error.code, {
                ns: "errors",
                defaultValue: t("registration.checkFields"),
              });
    setError({ field, message });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || photoResult) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    const rowHandles = activeRows.map(({ id }) => handles.current.get(id));
    try {
      if (purchasing && !isSupplierCurrency(selectedCurrency)) {
        showError(
          new ApiError(400, "INVALID_PRODUCT", "", "purchase.currency"),
          rowHandles,
        );
        return;
      }
      const items = await Promise.all(rowHandles.map((row) => row?.validate()));
      if (
        !items.every((item): item is ProductCreateInput => item !== undefined)
      ) {
        if (mobile && bulk)
          revealRow(activeRows[items.findIndex((item) => !item)].id);
        setError({ message: t("registration.rowErrors") });
        return;
      }
      const codes = new Set<string>();
      const duplicate = items.findIndex(({ code }) => {
        if (codes.has(code)) return true;
        codes.add(code);
        return false;
      });
      if (duplicate !== -1) {
        showError(
          new ApiError(
            409,
            "PRODUCT_CODE_CONFLICT",
            "",
            `products.${duplicate}.code`,
          ),
          rowHandles,
        );
        return;
      }
      if (purchasing && hasPayment && !method) {
        showError(
          new ApiError(400, "INVALID_PRODUCT", "", "initialPayment.method"),
          rowHandles,
        );
        return;
      }
      const body: ProductRegistrationInput = purchasing
        ? {
            source: "SUPPLIER_PURCHASE",
            products: items,
            purchase: {
              supplierId: supplier?.id ?? "",
              purchaseDate,
              currency: selectedCurrency ?? "",
              documentNumber: reference,
              note,
            },
            ...(hasPayment &&
              method && {
                initialPayment: {
                  amount: payment,
                  currency: selectedCurrency ?? "",
                  method,
                },
              }),
          }
        : {
            source: source === "OPENING_STOCK" ? source : "OTHER",
            products: items,
            ...(canManageAsOwner &&
              historicalSupplier && {
                historicalSupplierId: historicalSupplier.id,
              }),
          };
      const parsed = parseProductRegistration(body);
      if ("field" in parsed) {
        showError(
          new ApiError(400, "INVALID_PRODUCT", "", parsed.field),
          rowHandles,
        );
        return;
      }
      if (summary.overpayment) {
        showError(
          new ApiError(
            409,
            "SUPPLIER_OVERPAYMENT",
            "",
            "initialPayment.amount",
          ),
          rowHandles,
        );
        return;
      }

      const photos: { index: number; jpeg: Blob }[] = [];
      let invalidPhotos = false;
      for (const [index, row] of rowHandles.entries()) {
        const file = row?.photo();
        if (!file) continue;
        try {
          const jpeg =
            prepared.current.get(file) ?? (await prepareProductPhoto(file));
          prepared.current.set(file, jpeg);
          photos.push({ index, jpeg });
        } catch {
          invalidPhotos = true;
          row?.showError(t("registration.invalidPhoto"));
        }
      }
      if (invalidPhotos) {
        setError({ message: t("registration.rowErrors") });
        return;
      }
      const { productIds } = await attempt(body, registration.mutateAsync);
      const pending = await attachPhotos(
        photos.map(({ index, jpeg }) => ({
          id: productIds[index],
          code: items[index].code,
          jpeg,
        })),
      );
      if (pending.length) {
        setPhotoResult({ pending, saved: productIds.length });
        toast.success(
          t("registration.savedMany", { count: productIds.length }),
        );
      } else {
        finish(productIds);
      }
    } catch (error) {
      if (error instanceof ApiError) showError(error, rowHandles);
      else setError({ message: t("registration.retrySame") });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function retryPhotos() {
    if (!photoResult || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const pending = await attachPhotos(photoResult.pending);
      setPhotoResult({ ...photoResult, pending });
      if (!pending.length) toast.success(t("registration.photosSaved"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const errorFor = (field: string) => error?.field === field;
  const paymentText = (value: typeof summary.paid) =>
    value ? formatPayable(value, locale) : "—";
  const inputClass = "min-h-11 lg:min-h-9";
  const totals = (bulk || purchasing) && (
    <dl className="grid max-h-[24dvh] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1 overflow-auto text-sm tabular-nums">
      {bulk && (
        <>
          <dt>{t("registration.productCount")}</dt>
          <dd>{activeRows.length}</dd>
          <dt>{t("fields.weight")}</dt>
          <dd>{summary.gross ? <WeightText value={summary.gross} /> : "—"}</dd>
          {summary.net && (
            <>
              <dt>
                {t("registration.netWeightCount", {
                  count: summary.netCount,
                })}
              </dt>
              <dd>
                <WeightText value={summary.net} />
              </dd>
            </>
          )}
        </>
      )}
      <dt>
        {t(
          purchasing ? "registration.purchaseTotal" : "fields.acquisitionCost",
        )}
      </dt>
      <dd className="wrap-anywhere">
        {summary.acquisition.length
          ? summary.acquisition.map((value) => (
              <div key={value.currency}>{formatPayable(value, locale)}</div>
            ))
          : "—"}
      </dd>
      {purchasing && (
        <>
          <dt>{t("registration.paid")}</dt>
          <dd>{paymentText(summary.paid)}</dd>
          <dt>{t("registration.outstanding")}</dt>
          <dd>{paymentText(summary.outstanding)}</dd>
          <dt>{t("registration.paymentStatus")}</dt>
          <dd>
            {summary.status ? <PurchaseStatus value={summary.status} /> : "—"}
          </dd>
        </>
      )}
    </dl>
  );
  const actions = (
    <>
      {(error || summary.overpayment) && (
        <p role="alert" className="text-destructive">
          {error?.message ?? t("registration.overpayment")}
        </p>
      )}
      <div className={mobile && bulk ? "grid grid-cols-2 gap-2" : "grid"}>
        {mobile && bulk && (
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-11 whitespace-normal"
            disabled={busy || rows.length >= maxPurchaseItems}
            onClick={() => addRow(defaults)}
          >
            <Plus aria-hidden="true" /> {t("registration.addRow")}
          </Button>
        )}
        <PendingButton
          type="submit"
          form={formId}
          pending={busy}
          disabled={!categories.data?.some(({ isActive }) => isActive)}
          className={inputClass}
        >
          {busy ? t("saving") : t("save")}
        </PendingButton>
      </div>
    </>
  );
  const mobileFooter = mobile &&
    !photoResult &&
    options.isSuccess &&
    options.data.purities.length > 0 && (
      <>
        {totals && (
          <details className="min-w-0">
            <summary className="min-h-8 cursor-pointer content-center text-sm font-medium">
              <span className="tabular-nums">
                {bulk &&
                  t("registration.summaryCount", { count: activeRows.length })}
                {bulk && summary.gross && (
                  <>
                    {" "}
                    · <WeightText value={summary.gross} />
                  </>
                )}
                {bulk && " · "}
                {summary.acquisition.length === 1
                  ? formatPayable(summary.acquisition[0], locale)
                  : t(
                      purchasing
                        ? "registration.purchaseTotal"
                        : "fields.acquisitionCost",
                    )}
              </span>
            </summary>
            {totals}
          </details>
        )}
        {actions}
      </>
    );
  return (
    <ProductPanel
      title={t("create")}
      opener={opener}
      close={close}
      busy={busy}
      mobileFooter={mobileFooter}
    >
      {photoResult ? (
        <div className="grid gap-3">
          <p role="status">
            {t("registration.savedMany", { count: photoResult.saved })}
          </p>
          {photoResult.pending.length > 0 && (
            <>
              <p role="alert" className="text-destructive">
                {t("registration.photosPending")}
              </p>
              <ul className="grid gap-2">
                {photoResult.pending.map(({ id, code }) => (
                  <li key={id}>
                    <Link
                      to="/products"
                      search={{ product: id }}
                      onClick={close}
                      className="wrap-anywhere underline"
                    >
                      {code}
                    </Link>
                  </li>
                ))}
              </ul>
              <PendingButton pending={busy} onClick={() => void retryPhotos()}>
                {t("registration.retryPhotos")}
              </PendingButton>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={close}
          >
            {t("close")}
          </Button>
        </div>
      ) : options.isPending ? (
        <ListSkeleton rows={3} />
      ) : options.isError ? (
        <ErrorState
          error={options.error}
          retry={() => void options.refetch()}
          pending={options.isFetching}
        />
      ) : options.data.purities.length === 0 ? (
        <EmptyState title={t("noPurities")} description={t("noPuritiesHint")} />
      ) : (
        <form
          id={formId}
          className="grid min-w-0 gap-4"
          onSubmit={(event) => void submit(event)}
          onChange={() => {
            if (error) setError(undefined);
          }}
          aria-busy={busy}
          noValidate
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="registration-mode">
                {t("registration.mode")}
              </Label>
              <OptionSelect
                id="registration-mode"
                value={bulk ? "bulk" : "single"}
                disabled={busy}
                onChange={(value) => {
                  setBulk(value === "bulk");
                  setError(undefined);
                }}
                options={[
                  { value: "single", label: t("registration.single") },
                  { value: "bulk", label: t("registration.bulk") },
                ]}
              />
            </div>
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="registration-source">
                {t("registration.source")}
              </Label>
              <OptionSelect
                id="registration-source"
                value={source}
                disabled={busy}
                onChange={(value) => {
                  setSource(value as ProductRegistrationSource);
                  setError(undefined);
                }}
                options={productRegistrationSources
                  .filter(
                    (value) =>
                      canManageAsOwner || value !== "SUPPLIER_PURCHASE",
                  )
                  .map((value) => ({
                    value,
                    label: t(`registration.sources.${value}`),
                  }))}
              />
            </div>
          </div>
          {purchasing ? (
            <fieldset
              className="grid min-w-0 gap-3 border-y py-3"
              disabled={busy}
            >
              <SupplierPicker
                scope={scope}
                value={supplier}
                onChange={setSupplier}
                disabled={busy}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="registration-date">
                    {t("purchaseDate", { ns: "suppliers" })}
                  </Label>
                  <Input
                    id="registration-date"
                    type="date"
                    className={inputClass}
                    value={purchaseDate}
                    aria-invalid={errorFor("purchase.purchaseDate")}
                    onChange={(event) => setPurchaseDate(event.target.value)}
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="registration-currency">
                    {t("registration.purchaseCurrency")}
                  </Label>
                  <Input
                    id="registration-currency"
                    maxLength={3}
                    autoCapitalize="characters"
                    className={inputClass}
                    value={purchaseCurrency}
                    aria-invalid={errorFor("purchase.currency")}
                    onChange={(event) =>
                      setPurchaseCurrency(event.target.value.toUpperCase())
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="registration-reference">
                  {t("registration.reference")}
                </Label>
                <Input
                  id="registration-reference"
                  maxLength={120}
                  className={inputClass}
                  value={reference}
                  aria-invalid={errorFor("purchase.documentNumber")}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="registration-note">
                  {t("registration.purchaseNote")}
                </Label>
                <Textarea
                  id="registration-note"
                  rows={2}
                  maxLength={1000}
                  value={note}
                  aria-invalid={errorFor("purchase.note")}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="registration-payment">
                  {t("registration.initialPayment")}
                </Label>
                <Input
                  id="registration-payment"
                  inputMode="decimal"
                  maxLength={25}
                  className={inputClass}
                  value={initialPayment}
                  aria-invalid={
                    errorFor("initialPayment.amount") || summary.overpayment
                  }
                  onChange={(event) => setInitialPayment(event.target.value)}
                />
              </div>
              {hasPayment && (
                <div className="grid gap-2">
                  <Label htmlFor="registration-method">
                    {t("method", { ns: "suppliers" })}
                  </Label>
                  <OptionSelect
                    id="registration-method"
                    disabled={busy}
                    value={method ?? ""}
                    invalid={errorFor("initialPayment.method")}
                    onChange={(value) =>
                      setMethod(value as SupplierPaymentMethod)
                    }
                    options={supplierPaymentMethods.map((value) => ({
                      value,
                      label: t(`methods.${value}`, { ns: "sales" }),
                    }))}
                  />
                </div>
              )}
            </fieldset>
          ) : (
            canManageAsOwner && (
              <div className="grid gap-2 border-b pb-3">
                <SupplierPicker
                  scope={scope}
                  value={historicalSupplier}
                  onChange={setHistoricalSupplier}
                  onlyActive={false}
                  disabled={busy}
                  label={t("registration.historicalSupplierOptional")}
                />
                {historicalSupplier && (
                  <p className="text-muted-foreground">
                    {t("registration.historicalHint")}
                  </p>
                )}
              </div>
            )
          )}
          {rows.map(({ id, defaults }, index) => (
            <div key={id} hidden={!bulk && index !== 0} className="min-w-0">
              <ProductRegistrationRow
                mobileOpen={mobile && bulk ? editingRow === id : undefined}
                onMobileToggle={() =>
                  setEditingRow((current) => (current === id ? "" : id))
                }
                rowId={id}
                number={index + 1}
                defaults={defaults}
                bulk={bulk}
                busy={busy}
                sharedCurrency={selectedCurrency}
                categories={categories}
                purities={options.data.purities}
                ref={(handle) => {
                  if (handle) handles.current.set(id, handle);
                  else handles.current.delete(id);
                }}
                onPreview={onPreview}
                onDuplicate={(draft) => addRow({ ...draft, code: "" })}
                canAdd={rows.length < maxPurchaseItems}
                canRemove={rows.length > 1}
                onUseDefaults={applyDefaults}
                onRemove={() => removeRow(id)}
              />
            </div>
          ))}
          {bulk && !mobile && (
            <Button
              type="button"
              variant="outline"
              className={inputClass}
              disabled={busy || rows.length >= maxPurchaseItems}
              onClick={() => addRow(defaults)}
            >
              <Plus aria-hidden="true" /> {t("registration.addRow")}
            </Button>
          )}
          {!mobile && (
            <div className="sticky bottom-0 z-[1] grid gap-2 rounded-t-md border bg-background p-3">
              {totals}
              {actions}
            </div>
          )}
        </form>
      )}
    </ProductPanel>
  );
}
