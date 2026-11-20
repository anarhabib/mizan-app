import { ApiError } from "@/shared/lib/api";

export const photoAccept = "image/jpeg,image/png,image/webp";
const allowedTypes = photoAccept.split(",");
const maxBytes = 5 * 1024 * 1024;

export function photoDimensions(width: number, height: number) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareProductPhoto(file: File) {
  if (!allowedTypes.includes(file.type)) {
    throw new ApiError(0, "PHOTO_TYPE", "Unsupported image type");
  }

  try {
    const source = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      const { width, height } = photoDimensions(source.width, source.height);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);

      for (const quality of [0.86, 0.7, 0.5]) {
        const jpeg = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (jpeg?.type === "image/jpeg" && jpeg.size < maxBytes) return jpeg;
      }
      throw new Error("JPEG encoding failed");
    } finally {
      source.close();
    }
  } catch {
    throw new ApiError(0, "PHOTO_PROCESSING", "Could not prepare the image");
  }
}
