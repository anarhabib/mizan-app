import { describe, expect, it } from "vitest";
import { photoDimensions, prepareProductPhoto } from "./photo";

describe("product photo preparation", () => {
  it("bounds either orientation without stretching or upscaling", () => {
    expect(photoDimensions(4000, 2250)).toEqual({ width: 1600, height: 900 });
    expect(photoDimensions(2250, 4000)).toEqual({ width: 900, height: 1600 });
    expect(photoDimensions(400, 300)).toEqual({ width: 400, height: 300 });
    expect(photoDimensions(1, 4000)).toEqual({ width: 1, height: 1600 });
  });

  it("rejects unsupported images before attempting to decode them", async () => {
    const file = new File(["image"], "photo.gif", { type: "image/gif" });
    await expect(prepareProductPhoto(file)).rejects.toMatchObject({
      code: "PHOTO_TYPE",
    });
  });
});
