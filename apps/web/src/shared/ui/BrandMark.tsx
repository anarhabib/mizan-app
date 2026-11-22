import lightWordmark from "@/assets/branding/misqal-03-flat-ends-wordmark-light.svg";
import darkWordmark from "@/assets/branding/misqal-03-flat-ends-wordmark-dark.svg";

export function BrandMark() {
  return (
    <span role="img" aria-label="misqal" className="inline-flex items-center">
      <img
        src={lightWordmark}
        alt=""
        aria-hidden="true"
        className="block h-6 w-auto dark:hidden"
      />
      <img
        src={darkWordmark}
        alt=""
        aria-hidden="true"
        className="hidden h-6 w-auto dark:block"
      />
    </span>
  );
}
