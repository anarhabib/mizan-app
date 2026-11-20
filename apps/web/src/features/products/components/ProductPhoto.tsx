import { useRef, useState } from "react";
import { Camera, ImagePlus, ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProductDetail } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import type { useUploadProductPhoto } from "../api/mutations";
import { photoAccept } from "../lib/photo";

export function ProductPhoto({
  product,
  upload,
  refresh,
}: {
  product: ProductDetail;
  upload: ReturnType<typeof useUploadProductPhoto>;
  refresh: () => void;
}) {
  const { t } = useTranslation(["products", "errors"]);
  const choose = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [failedUrl, setFailedUrl] = useState<string>();
  const error = upload.error?.code;

  function select(file?: File) {
    if (file && !upload.isPending) upload.mutate(file);
  }

  return (
    <section
      className="grid gap-3"
      aria-label={t("photo.title")}
      aria-busy={upload.isPending}
    >
      {product.photo && failedUrl !== product.photo.url ? (
        <img
          src={product.photo.url}
          alt={t("photo.alt", { name: product.name })}
          className="max-h-64 w-full rounded-lg border bg-muted object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(product.photo?.url)}
        />
      ) : (
        <div className="flex min-h-24 flex-wrap items-center justify-center gap-3 rounded-lg border border-dashed p-3 text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-4" />
          <span>{t(product.photo ? "photo.loadError" : "photo.empty")}</span>
          {product.photo && (
            <Button
              variant="outline"
              onClick={refresh}
              className="min-h-11 lg:min-h-9"
            >
              {t("photo.reload")}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          hidden
          type="file"
          accept={photoAccept}
          ref={choose}
          onChange={(event) => {
            select(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <input
          hidden
          type="file"
          accept={photoAccept}
          capture="environment"
          ref={camera}
          onChange={(event) => {
            select(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 lg:min-h-9"
          disabled={upload.isPending}
          onClick={() => choose.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          {t("photo.choose")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 lg:hidden"
          disabled={upload.isPending}
          onClick={() => camera.current?.click()}
        >
          <Camera aria-hidden="true" />
          {t("photo.camera")}
        </Button>
      </div>
      {upload.isPending && <p role="status">{t("photo.uploading")}</p>}
      {upload.isSuccess && <p role="status">{t("photo.saved")}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error === "PHOTO_TYPE"
            ? t("photo.invalidType")
            : error === "PHOTO_PROCESSING"
              ? t("photo.processingError")
              : error === "NETWORK_ERROR"
                ? t("photo.uncertain")
                : t(
                    error === "PHOTO_CONFLICT" ||
                      error === "PHOTO_UNAVAILABLE" ||
                      error === "ACCESS_DENIED" ||
                      error === "AUTH_UNAVAILABLE"
                      ? error
                      : "generic",
                    { ns: "errors" },
                  )}
        </p>
      )}
    </section>
  );
}
