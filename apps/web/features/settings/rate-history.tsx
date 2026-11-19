import type { OldGoldRate } from "@mizan/contracts";
import { History } from "lucide-react";
import { money } from "../../lib/format-money";
import type { Locale } from "../language/messages";
import { settingsCopy } from "./settings-copy";
import { SettingsSection } from "./settings-section";

export function RateHistory({
  locale,
  rates,
}: {
  locale: Locale;
  rates: OldGoldRate[];
}) {
  const copy = settingsCopy[locale];
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  return (
    <SettingsSection
      title={copy.history}
      icon={<History aria-hidden="true" size={18} />}
    >
      {rates.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <ul>
          {rates.map((rate) => (
            <li
              key={rate.id}
              className="grid min-w-0 gap-1 rounded-xl border border-solid border-mizan-edge bg-mizan-field p-3"
            >
              <strong className="wrap-anywhere tabular-nums">
                {rate.purity} ‰ ·{" "}
                {money(locale, rate.amountPerGram, rate.currency)}
              </strong>
              <span className="text-sm text-mizan-muted">
                {rate.current ? copy.current : copy.historical} ·{" "}
                <time dateTime={rate.effectiveAt}>
                  {date.format(new Date(rate.effectiveAt))}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
