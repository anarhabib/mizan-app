"use client";

import { Circle, Gem } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductDetail } from "@mizan/contracts";
import { Button } from "../../components/ui/button";
import type { Locale } from "../language/messages";
import { confirmProductPhoto, startProductPhoto } from "./product-actions";
import { productCopy, type ProductScope } from "./product-copy";

const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoSize = 5 * 1024 * 1024;

export function ProductPhoto({
  locale,
  product,
  scope,
}: {
  locale: Locale;
  product: ProductDetail;
  scope: ProductScope;
}) {
  const copy = productCopy[locale];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [brokenUrl, setBrokenUrl] = useState<string>();
  const [pending, setPending] = useState(false);
  const attempt = useRef<{ uploadId: string }>(undefined);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const savedUrl = product.photo?.url;
  const url = file ? preview : savedUrl === brokenUrl ? undefined : savedUrl;
  const Fallback = /ring|üzük|qolbaq|bracelet/i.test(product.category)
    ? Circle
    : Gem;

  function select(next?: File) {
    setFile(next);
    setPreview(undefined);
    setFailed(false);
    attempt.current = undefined;
    if (
      next &&
      (!photoTypes.includes(next.type) ||
        !next.size ||
        next.size > maxPhotoSize)
    ) {
      setFile(undefined);
      setFailed(true);
      if (input.current) input.current.value = "";
    }
    if (!next && input.current) input.current.value = "";
  }

  async function upload() {
    if (!file || pending) return;
    setFailed(false);
    setPending(true);
    try {
      if (!attempt.current) {
        const signed = await startProductPhoto(scope, product.id);
        if (!signed) throw new Error();
        const result = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
          signal: AbortSignal.timeout(30000),
        });
        if (!result.ok) throw new Error();
        attempt.current = signed;
      }
      if (
        !(await confirmProductPhoto(
          scope,
          product.id,
          attempt.current.uploadId,
        ))
      ) {
        throw new Error();
      }
      select();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-3" aria-busy={pending}>
      <div className="flex h-[clamp(126px,32vw,174px)] items-center justify-center rounded-xl bg-mizan-selected sm:h-[clamp(138px,28vh,216px)]">
        {url ? (
          // Signed private URLs are fetched directly and expire.
          <img
            src={url}
            alt={product.name}
            className="h-full w-full object-contain"
            onError={() => (file ? setPreview(undefined) : setBrokenUrl(url))}
          />
        ) : (
          <span role="img" aria-label={copy.noPhoto}>
            <Fallback size={48} aria-hidden />
          </span>
        )}
      </div>
      {!product.photo && (
        <label className="grid gap-2 text-sm font-bold">
          {copy.photo}
          <input
            ref={input}
            type="file"
            accept={photoTypes.join(",")}
            disabled={pending}
            onChange={(event) => select(event.currentTarget.files?.[0])}
          />
        </label>
      )}
      {file && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={upload} disabled={pending}>
            {pending ? copy.saving : copy.upload}
          </Button>
          <Button
            variant="secondary"
            onClick={() => select()}
            disabled={pending}
          >
            {copy.cancel}
          </Button>
        </div>
      )}
      {failed && <p role="alert">{copy.photoFailed}</p>}
    </section>
  );
}
