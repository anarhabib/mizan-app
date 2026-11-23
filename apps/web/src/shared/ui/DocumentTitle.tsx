import { useEffect } from "react";
import { brandName } from "./BrandMark";

export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | ${brandName}`;
  }, [title]);
  return null;
}
