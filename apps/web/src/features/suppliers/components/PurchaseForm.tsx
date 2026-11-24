import { useId, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  isSupplierCurrency,
  maxPurchaseItems,
  parsePurchaseInput,
  type ProductListItem,
  type PurchaseInput,
  type PurchaseItemInput,
  type PurchaseReceipt,
  type SupplierOption,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ProductForm,
  ProductPanel,
  productListQuery,
  productOptionsQuery,
  refreshPurchaseProducts,
} from "@/features/products";
import { ApiError } from "@/shared/lib/api";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PendingButton } from "@/shared/ui/PendingButton";
import { useRegisterPurchase, type SupplierScope } from "../api/queries";
import { todayInBaku } from "../lib/financial";
import { useFinancialAttempt } from "../lib/useFinancialAttempt";
import { controlClass, TextFilter, WriteError } from "./ledger";
import { SupplierPicker, useSupplierSearch } from "./SupplierPicker";

type Fields = Pick<
  PurchaseInput,
  "currency" | "purchaseDate" | "documentNumber" | "note"
>;
type Line = {
  key: string;
  code: string;
  name: string;
  item: PurchaseItemInput;
};

export function PurchaseForm({
  scope,
  defaultCurrency,
  initialSupplier,
  opener,
  close,
  saved,
}: {
  scope: SupplierScope;
  defaultCurrency: string;
  initialSupplier?: SupplierOption;
  opener: HTMLElement;
  close: () => void;
  saved: (result: PurchaseReceipt) => void;
}) {
  const { t } = useTranslation("suppliers");
  const id = useId();
  const [supplier, setSupplier] = useState(initialSupplier);
  const [items, setItems] = useState<Line[]>([]);
  const [itemMode, setItemMode] = useState<"new" | "existing">();
  const [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState<string>();
  const client = useQueryClient();
  const form = useForm<Fields>({
    defaultValues: {
      currency: defaultCurrency,
      purchaseDate: todayInBaku(),
      documentNumber: "",
      note: "",
    },
  });
  const currency = useWatch({ control: form.control, name: "currency" });
  const mutation = useRegisterPurchase(scope);
  const send = useFinancialAttempt<PurchaseInput>(scope, "purchase");
  const busy = mutation.isPending || form.formState.isSubmitting;
  const editsLocked = busy || Boolean(itemMode);

  function add(line: Line) {
    if (
      items.length >= maxPurchaseItems ||
      items.some((item) => item.key === line.key || item.code === line.code)
    )
      return false;
    setItems([...items, line]);
    setItemMode(undefined);
    setError(undefined);
    setInvalid(undefined);
    return true;
  }

  const submit = form.handleSubmit(async (fields) => {
    if (itemMode || mutation.isPending) return;
    setError(undefined);
    setInvalid(undefined);
    const body = {
      ...fields,
      supplierId: supplier?.id ?? "",
      items: items.map(({ item }) => item),
    };
    const parsed = parsePurchaseInput(body);
    if ("field" in parsed) {
      setInvalid(parsed.field);
      return;
    }
    try {
      const receipt = await send(body, mutation.mutateAsync);
      void refreshPurchaseProducts(client, scope, receipt.productIds);
      toast.success(t("purchaseSaved"));
      saved(receipt);
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setInvalid(cause.field);
    }
  });

  const lineIndex = invalid?.match(/^items\.(\d+)/)?.[1];
  const line = lineIndex === undefined ? undefined : items[Number(lineIndex)];

  return (
    <ProductPanel
      title={t("registerPurchase")}
      opener={opener}
      close={close}
      busy={busy}
    >
      <section className="grid gap-4">
        <form id={id} noValidate onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <SupplierPicker
                scope={scope}
                value={supplier}
                onChange={setSupplier}
                disabled={editsLocked}
              />
            </div>
            {(
              [
                ["purchaseDate", "date", undefined],
                ["documentNumber", "text", 120],
                ["currency", "text", 3],
              ] as const
            ).map(([field, type, maxLength]) => (
              <div className="grid min-w-0 gap-2" key={field}>
                <Label htmlFor={id + field}>{t(field)}</Label>
                <Input
                  id={id + field}
                  type={type}
                  className={controlClass}
                  maxLength={maxLength}
                  aria-invalid={invalid === field}
                  readOnly={
                    editsLocked || (field === "currency" && items.length > 0)
                  }
                  {...form.register(
                    field,
                    field === "currency"
                      ? {
                          setValueAs: (value: string) =>
                            value.trim().toUpperCase(),
                        }
                      : undefined,
                  )}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={id + "note"}>{t("fields.note")}</Label>
            <Textarea
              id={id + "note"}
              maxLength={1000}
              readOnly={editsLocked}
              {...form.register("note")}
            />
          </div>
        </form>
        <div className="grid gap-3 border-t pt-4">
          <h2 className="font-medium">
            {t("products")}{" "}
            <span className="text-muted-foreground">({items.length})</span>
          </h2>
          {items.length > 0 && (
            <ul className="divide-y">
              {items.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="min-w-0 wrap-anywhere">
                    <strong>{line.code}</strong> · {line.name}{" "}
                    <span className="text-muted-foreground">
                      (
                      {t(
                        "product" in line.item ? "newProduct" : "linkedProduct",
                      )}
                      )
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={editsLocked}
                    className={controlClass}
                    aria-label={t("removeProduct", { code: line.code })}
                    onClick={() =>
                      setItems(items.filter(({ key }) => key !== line.key))
                    }
                  >
                    {t("remove")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!itemMode && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                className={controlClass}
                disabled={
                  busy ||
                  !isSupplierCurrency(currency) ||
                  items.length >= maxPurchaseItems
                }
                onClick={() => setItemMode("new")}
              >
                {t("addNewProduct")}
              </Button>
              <Button
                variant="outline"
                type="button"
                className={controlClass}
                disabled={
                  busy ||
                  !isSupplierCurrency(currency) ||
                  items.length >= maxPurchaseItems
                }
                onClick={() => setItemMode("existing")}
              >
                {t("attachProduct")}
              </Button>
            </div>
          )}
          {itemMode === "new" && (
            <NewItem
              scope={scope}
              currency={currency}
              add={add}
              close={() => setItemMode(undefined)}
            />
          )}
          {itemMode === "existing" && (
            <ExistingItem
              scope={scope}
              currency={currency}
              items={items}
              select={(product) =>
                add({
                  key: product.id,
                  code: product.code,
                  name: product.name,
                  item: { productId: product.id },
                })
              }
              close={() => setItemMode(undefined)}
            />
          )}
        </div>
        {invalid && (
          <p role="alert" className="text-destructive">
            {line
              ? t("invalidLine", { code: line.code })
              : t(
                  invalid === "supplierId"
                    ? "chooseSupplier"
                    : invalid === "purchaseDate"
                      ? "invalidPurchaseDate"
                      : invalid === "currency"
                        ? "invalidCurrency"
                        : invalid === "items"
                          ? "addItemsFirst"
                          : "purchaseError",
                )}
          </p>
        )}
        <WriteError error={error} replayable />
        <PendingButton
          type="submit"
          form={id}
          pending={busy}
          disabled={Boolean(itemMode)}
          className={controlClass}
        >
          {t("registerPurchase")}
        </PendingButton>
      </section>
    </ProductPanel>
  );
}

function NewItem({
  scope,
  currency,
  add,
  close,
}: Pick<Parameters<typeof PurchaseForm>[0], "scope" | "close"> & {
  currency: string;
  add: (line: Line) => boolean;
}) {
  const { t } = useTranslation("suppliers");
  const options = useQuery(productOptionsQuery(scope));
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  return (
    <div className="grid max-w-lg gap-3 border-t pt-3">
      <h3 className="font-medium">{t("addNewProduct")}</h3>
      {options.isPending && <ListSkeleton rows={3} />}
      {options.isError && (
        <ErrorState
          error={options.error}
          retry={() => void options.refetch()}
          pending={options.isFetching}
        />
      )}
      {options.data && (
        <ProductForm
          scope={scope}
          currency={currency}
          purities={options.data.purities}
          pending={false}
          onSubmittingChange={setSubmitting}
          acquisitionCurrencyLocked
          submitLabel={t("addToPurchase")}
          save={async (product) => {
            setDuplicate(
              !add({
                key: product.code,
                code: product.code,
                name: product.name,
                item: { product },
              }),
            );
          }}
        />
      )}
      {duplicate && (
        <p role="alert" className="text-destructive">
          {t("productAlreadyAdded")}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={submitting}
        className={`w-fit ${controlClass}`}
        onClick={close}
      >
        {t("cancel")}
      </Button>
    </div>
  );
}

function ExistingItem({
  scope,
  currency,
  items,
  select,
  close,
}: {
  scope: SupplierScope;
  currency: string;
  items: Line[];
  select: (item: ProductListItem) => void;
  close: () => void;
}) {
  const { t } = useTranslation("suppliers");
  const [search, setSearch] = useState("");
  const q = useSupplierSearch(search);
  const query = useInfiniteQuery(
    productListQuery(scope, {
      q,
      unpurchased: true,
      purchaseCurrency: currency,
    }),
  );
  const products = query.isPlaceholderData
    ? []
    : (query.data?.pages
        .flatMap((page) => page.items)
        .filter(
          (product) => !items.some((line) => line.code === product.code),
        ) ?? []);
  return (
    <div className="grid max-w-lg gap-3 border-t pt-3">
      <TextFilter label={t("searchProducts")} value={search} set={setSearch} />
      {query.isPending && <ListSkeleton rows={3} />}
      {query.isError && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      )}
      {!query.isFetching && !query.isError && !products.length && (
        <p role="status" className="text-muted-foreground">
          {t("noAvailableProducts")}
        </p>
      )}
      <ul className="max-h-52 overflow-y-auto">
        {products.map((product) => (
          <li key={product.id}>
            <Button
              type="button"
              variant="ghost"
              className={`h-auto w-full justify-start whitespace-normal text-left wrap-anywhere ${controlClass}`}
              onClick={() => select(product)}
            >
              {product.code} · {product.name}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {query.hasNextPage && (
          <PendingButton
            type="button"
            pending={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            className={controlClass}
          >
            {t("loadMore")}
          </PendingButton>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={close}
          className={controlClass}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
