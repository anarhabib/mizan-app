import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  parseMoney,
  salePaymentMethods,
  type SaleRefundInput,
  type SaleResult,
  type SaleReturnInput,
  type SaleReturnQuote,
  type SaleReturnRecord,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductPanel } from "@/features/products";
import { apiRequest, ApiError } from "@/shared/lib/api";
import { submitFinancialAttempt } from "@/shared/lib/financial-attempt";
import { MoneyText } from "@/shared/ui/MoneyText";
import { PendingButton } from "@/shared/ui/PendingButton";
import { invalidateReturnEffects, previewSaleReturn } from "../api/returns";
import { salePath, type SaleScope } from "../api/queries";

export type SaleReturnAction = { sale: SaleResult; refund?: SaleReturnRecord };

type Values = {
  items: { selected: boolean; resellable: boolean }[];
  reason: string;
  returnDate: string;
  debtCanceled: string;
  refundNow: boolean;
  refundDate: string;
  amount: string;
  method: SaleRefundInput["method"];
};

type Review =
  | { input: SaleReturnInput; quote: SaleReturnQuote }
  | { input: SaleRefundInput };
type ReturnError =
  "uncertain" | "invalid" | "tradeIn" | "conflict" | "balance" | "failed";
const bakuDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" });

export function SaleReturnPanel({
  scope,
  actorId,
  action,
  opener,
  close,
}: {
  scope: SaleScope;
  actorId: string;
  action: SaleReturnAction;
  opener: HTMLElement;
  close: () => void;
}) {
  const { t } = useTranslation("sales");
  const client = useQueryClient();
  const id = useId();
  const { sale, refund } = action;
  const currency = sale.currency;
  const eligible = sale.items.filter((item) => !item.returned);
  const today = bakuDate.format(new Date());
  const earliest =
    refund?.returnDate ??
    [
      bakuDate.format(new Date(sale.createdAt)),
      ...sale.payments.map(({ createdAt }) =>
        bakuDate.format(new Date(createdAt)),
      ),
      ...(sale.returns?.map(({ returnDate }) => returnDate) ?? []),
    ]
      .sort()
      .at(-1)!;
  const form = useForm<Values>({
    defaultValues: {
      items: eligible.map(() => ({ selected: false, resellable: false })),
      reason: "",
      returnDate: today,
      debtCanceled: "",
      refundNow: !!refund,
      refundDate: today,
      amount: "",
      method: "CASH",
    },
  });
  const fields = useWatch({ control: form.control });
  const [review, setReview] = useState<Review>();
  const [allocation, setAllocation] = useState<SaleReturnQuote>();
  const [error, setError] = useState<ReturnError>();
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const ready = review && (!("quote" in review) || !!review.quote.confirmation);
  const preview = useMutation({
    retry: false,
    mutationFn: (input: SaleReturnInput) =>
      previewSaleReturn(scope, sale.id, input),
  });
  const write = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (input: object) =>
      submitFinancialAttempt(
        [
          actorId,
          scope.organizationId,
          scope.storeId,
          sale.id,
          refund?.id,
          "returns",
        ].join("/"),
        input,
        async ({ body, key }) => {
          const result = await apiRequest<{ id: string }>(
            salePath(
              scope,
              refund
                ? `/${sale.id}/returns/${refund.id}/refunds`
                : `/${sale.id}/returns`,
            ),
            {
              method: "POST",
              body,
              headers: { "Idempotency-Key": key },
              signal: AbortSignal.timeout(30_000),
            },
          );
          if (!result?.id)
            throw new ApiError(
              201,
              "INVALID_RESPONSE",
              "Missing return result",
            );
        },
      ),
    onSuccess: () => invalidateReturnEffects(client, scope, sale),
  });
  const pending =
    form.formState.isSubmitting || preview.isPending || write.isPending;
  const money = (amount: string) => (
    <MoneyText exact value={{ amount, currency }} />
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    try {
      await form.handleSubmit(async (values) => {
        setError(undefined);
        try {
          if (ready) {
            await write.mutateAsync(
              "quote" in review
                ? { ...review.input, confirmation: review.quote.confirmation }
                : review.input,
            );
            toast.success(t(refund ? "returns.refundSaved" : "returns.saved"));
            close();
            return;
          }
          const refundInput = values.refundNow
            ? {
                amount: parseMoney({
                  amount: values.amount.trim().replace(",", "."),
                  currency,
                }).amount,
                refundDate: values.refundDate,
                method: values.method,
              }
            : undefined;
          if (refund && refundInput) {
            setReview({ input: refundInput });
            return;
          }
          const input: SaleReturnInput = {
            reason: values.reason,
            returnDate: values.returnDate,
            items: eligible.flatMap(({ product }, index) =>
              values.items[index].selected
                ? [
                    {
                      productId: product.id,
                      resellable: values.items[index].resellable,
                    },
                  ]
                : [],
            ),
            debtCanceled:
              values.debtCanceled.trim().replace(",", ".") || undefined,
            refund: refundInput,
          };
          const quote = await preview.mutateAsync(input);
          setAllocation(quote);
          setReview({ input, quote });
        } catch (failure) {
          if (failure instanceof ApiError) {
            const unknown =
              !!ready &&
              (failure.isNetwork ||
                failure.status === 408 ||
                failure.status >= 500 ||
                failure.code === "INVALID_RESPONSE");
            setUncertain(unknown);
            if (!unknown) {
              setReview(undefined);
            }
            setError(
              unknown
                ? "uncertain"
                : ((
                    {
                      INVALID_RETURN: "invalid",
                      RETURN_TRADE_IN: "tradeIn",
                      RETURN_CONFLICT: "conflict",
                      REFUND_EXCEEDS_BALANCE: "balance",
                    } as Record<string, ReturnError>
                  )[failure.code] ?? "failed"),
            );
          } else {
            setError(failure instanceof RangeError ? "invalid" : "failed");
          }
        }
      })(event);
    } finally {
      locked.current = false;
    }
  }

  const actions = (
    <div className="flex flex-wrap justify-end gap-2">
      {ready && !uncertain && (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setReview(undefined);
          }}
        >
          {t("returns.edit")}
        </Button>
      )}
      <PendingButton
        type="submit"
        form={id}
        pending={pending}
        disabled={pending}
        className="min-h-11 lg:min-h-9"
      >
        {t(
          uncertain
            ? "returns.retry"
            : ready
              ? "returns.confirm"
              : "returns.review",
        )}
      </PendingButton>
    </div>
  );

  return (
    <ProductPanel
      title={t(refund ? "returns.refund" : "returns.title")}
      close={close}
      opener={opener}
      busy={pending || uncertain}
      mobileFooter={actions}
    >
      <form id={id} onSubmit={submit} className="grid min-w-0 gap-4">
        {refund && (
          <p>
            {t("returns.refundLimit")} {money(refund.refundLimit)}
          </p>
        )}
        {!ready && (
          <fieldset disabled={pending} className="grid min-w-0 gap-4">
            {!refund && (
              <>
                <div className="grid gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t("returns.collected")} {money(sale.paidAmount)}
                    {" · "}
                    {t("fields.outstandingDebt")} {money(sale.outstandingDebt)}
                  </p>
                  {sale.payments.map((payment) => (
                    <p
                      key={payment.id}
                      className="text-xs text-muted-foreground"
                    >
                      {payment.method
                        ? t(`methods.${payment.method}`)
                        : t(`paymentKind.${payment.kind}`)}
                      {" · "}
                      <MoneyText value={payment} />
                    </p>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 justify-self-start lg:min-h-9"
                    onClick={() => {
                      eligible.forEach((_, index) =>
                        form.setValue(`items.${index}.selected`, true),
                      );
                      setAllocation(undefined);
                      form.setValue("debtCanceled", "");
                      form.setValue("refundNow", false);
                    }}
                  >
                    {t("returns.selectAll")}
                  </Button>
                  {eligible.map(({ product, saleAmount }, index) => (
                    <div
                      key={product.id}
                      className="grid gap-2 rounded-md border p-3"
                    >
                      <Label className="min-h-10 min-w-0 gap-3">
                        <Controller
                          name={`items.${index}.selected`}
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox
                              name={field.name}
                              ref={field.ref}
                              checked={field.value}
                              onCheckedChange={(value) => {
                                field.onChange(value === true);
                                setAllocation(undefined);
                                form.setValue("debtCanceled", "");
                                form.setValue("refundNow", false);
                              }}
                            />
                          )}
                        />
                        <span className="wrap-anywhere">
                          {product.name} · {product.code} · {money(saleAmount)}
                        </span>
                      </Label>
                      {fields.items?.[index]?.selected && (
                        <Label className="min-h-10 gap-3">
                          <Controller
                            name={`items.${index}.resellable`}
                            control={form.control}
                            render={({ field }) => (
                              <Checkbox
                                name={field.name}
                                ref={field.ref}
                                checked={field.value}
                                onCheckedChange={(value) =>
                                  field.onChange(value === true)
                                }
                              />
                            )}
                          />
                          {t("returns.resellable")}
                        </Label>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${id}-return-date`}>
                    {t("returns.returnDate")}
                  </Label>
                  <Input
                    id={`${id}-return-date`}
                    type="date"
                    min={earliest}
                    max={today}
                    required
                    {...form.register("returnDate")}
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${id}-reason`}>{t("returns.reason")}</Label>
                  <Textarea
                    id={`${id}-reason`}
                    maxLength={600}
                    required
                    {...form.register("reason")}
                  />
                </div>
                {allocation &&
                  allocation.minDebtCanceled !== allocation.maxDebtCanceled && (
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor={`${id}-debt`}>
                        {t("returns.debtCanceled")}
                      </Label>
                      <p
                        id={`${id}-debt-range`}
                        className="text-sm text-muted-foreground"
                      >
                        {t("returns.allocation")}{" "}
                        {money(allocation.minDebtCanceled)} –{" "}
                        {money(allocation.maxDebtCanceled)}
                      </p>
                      <Input
                        id={`${id}-debt`}
                        required
                        aria-describedby={`${id}-debt-range`}
                        inputMode="decimal"
                        {...form.register("debtCanceled")}
                      />
                    </div>
                  )}
                {allocation?.refundLimit && allocation.refundLimit !== "0" && (
                  <Label className="min-h-10 gap-3">
                    <Controller
                      name="refundNow"
                      control={form.control}
                      render={({ field }) => (
                        <Checkbox
                          name={field.name}
                          ref={field.ref}
                          checked={field.value}
                          onCheckedChange={(value) =>
                            field.onChange(value === true)
                          }
                        />
                      )}
                    />
                    {t("returns.refundNow")}
                  </Label>
                )}
              </>
            )}
            {fields.refundNow && (
              <>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${id}-amount`}>
                    {t("returns.refundAmount")} ({currency})
                  </Label>
                  <Input
                    id={`${id}-amount`}
                    inputMode="decimal"
                    required
                    {...form.register("amount")}
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${id}-refund-date`}>
                    {t("returns.refundDate")}
                  </Label>
                  <Input
                    id={`${id}-refund-date`}
                    type="date"
                    min={refund ? earliest : fields.returnDate}
                    max={today}
                    required
                    {...form.register("refundDate")}
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor={`${id}-method`}>
                    {t("fields.paymentMethod")}
                  </Label>
                  <Controller
                    name="method"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={pending}
                      >
                        <SelectTrigger className="w-full" id={`${id}-method`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {salePaymentMethods.map((method) => (
                            <SelectItem key={method} value={method}>
                              {t(`methods.${method}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </>
            )}
          </fieldset>
        )}
        {ready &&
          ("quote" in review ? (
            <div className="grid gap-3 rounded-md border p-3">
              <p className="font-medium">{t("returns.summary")}</p>
              <p className="wrap-anywhere">
                <time dateTime={review.input.returnDate}>
                  {review.input.returnDate}
                </time>{" "}
                · {review.input.reason}
              </p>
              <ul className="grid gap-2">
                {review.input.items.map(({ productId, resellable }) => {
                  const product = eligible.find(
                    (item) => item.product.id === productId,
                  )?.product;
                  return (
                    <li key={productId} className="wrap-anywhere">
                      {product?.name} · {product?.code} ·{" "}
                      {t(resellable ? "returns.stock" : "returns.unavailable")}
                    </li>
                  );
                })}
              </ul>
              <dl className="grid grid-cols-2 gap-2">
                {(
                  [
                    "returnedValue",
                    "debtCanceled",
                    "remainingDebt",
                    "refundAmount",
                    "remainingRefundable",
                    "refundLimit",
                  ] as const
                ).map((key) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t(`returns.${key}`)}
                    </dt>
                    <dd>{money(review.quote[key] ?? "0")}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {t("returns.remainingItems", {
                  count: review.quote.remainingProductIds.length,
                })}
              </p>
              {review.quote.remainingProductIds.length > 0 && (
                <ul className="text-sm text-muted-foreground">
                  {eligible
                    .filter(({ product }) =>
                      review.quote.remainingProductIds.includes(product.id),
                    )
                    .map(({ product }) => (
                      <li className="wrap-anywhere" key={product.id}>
                        {product.name} · {product.code}
                      </li>
                    ))}
                </ul>
              )}
              {review.input.refund ? (
                <p>
                  {t(`methods.${review.input.refund.method}`)} ·{" "}
                  {review.input.refund.refundDate}
                </p>
              ) : (
                review.quote.refundLimit !== "0" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || uncertain}
                    className="justify-self-start"
                    onClick={() => {
                      form.setValue("refundNow", true);
                      setReview(undefined);
                    }}
                  >
                    {t("returns.refundNow")}
                  </Button>
                )
              )}
            </div>
          ) : (
            <p className="rounded-md border p-3">
              {t("returns.refundAmount")} {money(review.input.amount)}
              {" · "}
              {t(`methods.${review.input.method}`)}
              {" · "}
              {review.input.refundDate}
            </p>
          ))}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(`returns.errors.${error}`)}
          </p>
        )}
        <div className="hidden lg:block">{actions}</div>
      </form>
    </ProductPanel>
  );
}
