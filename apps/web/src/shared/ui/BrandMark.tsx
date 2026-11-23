import lightWordmark from "@/assets/branding/misqal-03-flat-ends-wordmark-light.svg";
import darkWordmark from "@/assets/branding/misqal-03-flat-ends-wordmark-dark.svg";
import lightIcon from "@/assets/branding/misqal-03-flat-ends-icon-light.svg";
import darkIcon from "@/assets/branding/misqal-03-flat-ends-icon-dark.svg";

export const brandName = "Misqal";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span role="img" aria-label={brandName} className="inline-flex shrink-0">
      <img
        src={compact ? lightIcon : lightWordmark}
        alt=""
        className={compact ? "size-7 dark:hidden" : "h-6 w-auto dark:hidden"}
      />
      <img
        src={compact ? darkIcon : darkWordmark}
        alt=""
        className={
          compact ? "hidden size-7 dark:block" : "hidden h-6 w-auto dark:block"
        }
      />
    </span>
  );
}
