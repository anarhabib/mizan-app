import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import type { Locale } from "../language/messages";
import { productCopy } from "../products/product-copy";
import { ProductIdentity } from "./product-lookup";
import { saleCopy } from "./sale-copy";
import { money, Rows, SettlementSummary } from "./settlement-summary";
import type { ProductListItem, SaleCreateInput } from "@mizan/contracts";
import type { previewSale } from "./settlement";

export type SaleReview = {
  product: ProductListItem;
  input: SaleCreateInput;
  preview: ReturnType<typeof previewSale>;
  key: string;
};

export function SaleConfirmation({
  locale,
  review,
  currency,
  busy,
  uncertain,
  error,
  close,
  confirm,
}: {
  locale: Locale;
  review: SaleReview | null;
  currency: string;
  busy: boolean;
  uncertain: boolean;
  error: string;
  close: () => void;
  confirm: () => void;
}) {
  const copy = saleCopy[locale];
  return (
    <Dialog
      open={!!review}
      title={copy.review}
      closeLabel={copy.back}
      onClose={close}
      closeDisabled={busy}
    >
      {review && (
        <div className="grid gap-4" aria-busy={busy}>
          <ProductIdentity locale={locale} product={review.product} />
          <SettlementSummary
            locale={locale}
            currency={currency}
            amount={review.input.saleAmount}
            payment={review.input.payment}
            {...review.preview}
          />
          {!!review.input.tradeIns?.length && (
            <section className="grid gap-3">
              <h3 className="font-bold">{copy.trade}</h3>
              {review.input.tradeIns.map((line, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-mizan-edge p-3"
                >
                  <Rows
                    values={[
                      [productCopy[locale].purity, String(line.purity)],
                      [
                        copy.calculated,
                        money(
                          locale,
                          review.preview.calculated[index],
                          currency,
                        ),
                      ],
                      ...(line.overrideAmount === undefined
                        ? []
                        : [
                            [
                              copy.accepted + " · " + copy.overrideApplied,
                              money(locale, line.overrideAmount, currency),
                            ] as [string, string],
                          ]),
                    ]}
                  />
                </div>
              ))}
            </section>
          )}
          <p>{copy.warning}</p>
          {error && <p role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={close}>
              {copy.back}
            </Button>
            <Button
              disabled={busy || (!!error && !uncertain)}
              onClick={confirm}
            >
              {busy ? copy.saving : uncertain ? copy.retry : copy.confirm}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
