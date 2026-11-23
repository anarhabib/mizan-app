import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
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
  const [source, setSource] = useState<"file" | "camera">("file");
  const error = upload.error?.code;

  function select(source: "file" | "camera", file?: File) {
    if (file && !upload.isPending) {
      setSource(source);
      upload.mutate(file, { onSuccess: () => toast.success(t("photo.saved")) });
    }
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
        <Empty className="min-h-24 gap-2 rounded-lg border p-3">
          <EmptyHeader>
            <ImageOff aria-hidden="true" className="size-4" />
            <EmptyDescription>
              {t(product.photo ? "photo.loadError" : "photo.empty")}
            </EmptyDescription>
          </EmptyHeader>
          {product.photo && (
            <Button
              variant="outline"
              onClick={refresh}
              className="min-h-11 lg:min-h-9"
            >
              {t("photo.reload")}
            </Button>
          )}
        </Empty>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          hidden
          type="file"
          accept={photoAccept}
          ref={choose}
          onChange={(event) => {
            select("file", event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <Input
          hidden
          type="file"
          accept={photoAccept}
          capture="environment"
          ref={camera}
          onChange={(event) => {
            select("camera", event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <PendingButton
          pending={upload.isPending && source === "file"}
          type="button"
          variant="outline"
          className="min-h-11 lg:min-h-9"
          disabled={upload.isPending}
          onClick={() => choose.current?.click()}
        >
          {!(upload.isPending && source === "file") && (
            <ImagePlus aria-hidden="true" />
          )}
          {t("photo.choose")}
        </PendingButton>
        <PendingButton
          pending={upload.isPending && source === "camera"}
          type="button"
          variant="outline"
          className="min-h-11 lg:hidden"
          disabled={upload.isPending}
          onClick={() => camera.current?.click()}
        >
          {!(upload.isPending && source === "camera") && (
            <Camera aria-hidden="true" />
          )}
          {t("photo.camera")}
        </PendingButton>
      </div>
      {upload.isPending && <p role="status">{t("photo.uploading")}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
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
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
