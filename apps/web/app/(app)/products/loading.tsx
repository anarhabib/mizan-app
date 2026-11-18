import { currentLocale } from "../../../features/language/preference";
import { productCopy } from "../../../features/products/product-copy";

export default async function LoadingProducts() {
  return <p role="status">{productCopy[await currentLocale()].loading}</p>;
}
