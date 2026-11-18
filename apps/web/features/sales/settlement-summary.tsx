import { currencyMinorUnits, type SaleCreateInput } from "@mizan/contracts";
import type { Locale } from "../language/messages";
import { saleCopy } from "./sale-copy";

export function money(locale: Locale, amount: string, currency: string) {
  const [whole, rawFraction = ""] = amount.split(".");
  const fraction = rawFraction
    .replace(/0+$/, "")
    .padEnd(currencyMinorUnits(currency), "0");
  const localized = new Intl.NumberFormat(locale).format(BigInt(whole));
  const sign = whole === "-0" ? "-" : "";
  return (
    sign +
    localized +
    (fraction ? (locale === "az" ? "," : ".") + fraction : "") +
    " " +
    currency
  );
}

export function Rows({ values }: { values: Array<[string, string]> }) {
  return (
    <dl className="grid gap-2">
      {values.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-wrap justify-between gap-x-4 gap-y-1"
        >
          <dt>{label}</dt>
          <dd className="font-bold wrap-anywhere tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettlementSummary({
  locale,
  currency,
  amount,
  tradeInTotal,
  balance,
  converted,
  change,
  payment,
}: {
  locale: Locale;
  currency: string;
  amount: string;
  tradeInTotal: string;
  balance: string;
  converted: string;
  change: string;
  payment?: SaleCreateInput["payment"];
}) {
  const copy = saleCopy[locale];
  const show = (value: string) => money(locale, value, currency);
  const payout = balance.startsWith("-");
  const zero = !/[1-9]/.test(balance);
  return (
    <Rows
      values={[
        [copy.amount, show(amount)],
        [copy.total, show(tradeInTotal)],
        [
          payout ? copy.payout : zero ? copy.even : copy.due,
          show(balance.replace(/^-/, "")),
        ],
        ...(payment
          ? ([
              [copy.cash, money(locale, payment.amount, payment.currency)],
              ...(payment.exchangeRate
                ? [[copy.exchange, payment.exchangeRate]]
                : []),
              [copy.equivalent, show(converted)],
              [copy.change, show(change)],
            ] as Array<[string, string]>)
          : []),
      ]}
    />
  );
}
