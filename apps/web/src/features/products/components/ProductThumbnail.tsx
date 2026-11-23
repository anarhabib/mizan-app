import { useState } from "react";
import { ImageIcon } from "lucide-react";

export function ProductThumbnail({ src }: { src?: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground"
    >
      {src && src !== failedSrc ? (
        <img
          src={src}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </span>
  );
}
