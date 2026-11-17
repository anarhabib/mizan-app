import { expect, test } from "vitest";
import { buildApp } from "../src/app.js";

test("reports API health at the versioned endpoint", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  } finally {
    await app.close();
  }
});
