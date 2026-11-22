import { createDatabase } from "@mizan/database";
import { buildApp } from "./app.js";
import {
  createSupabaseVerifier,
  createVerifiedEmailLookup,
} from "./plugins/auth.js";
import { createInvitationSender } from "./modules/memberships/invitation-mail.js";
import { createProductPhotoStorage } from "./modules/products/product.storage.js";

const port = Number(process.env.PORT ?? "3001");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if ((!databaseUrl || !supabaseUrl) && (databaseUrl || supabaseUrl || apiKey)) {
  throw new Error(
    "Set both DATABASE_URL and SUPABASE_URL to enable protected API routes",
  );
}
const issuer = supabaseUrl ? new URL("/auth/v1", supabaseUrl).href : undefined;
const verifyToken = issuer
  ? createSupabaseVerifier({ issuer, apiKey })
  : undefined;
const db = databaseUrl ? createDatabase(databaseUrl) : undefined;
const access = db && verifyToken ? { db, verifyToken } : undefined;

const goldPriceProvider = process.env.MIZAN_GOLD_PRICE_PROVIDER || "gold-api";
if (goldPriceProvider !== "gold-api" && goldPriceProvider !== "off") {
  throw new Error("MIZAN_GOLD_PRICE_PROVIDER must be gold-api or off");
}
const goldPriceSync = process.env.MIZAN_GOLD_PRICE_SYNC || "interval";
if (goldPriceSync !== "interval" && goldPriceSync !== "on-demand")
  throw new Error("MIZAN_GOLD_PRICE_SYNC must be interval or on-demand");

const memberships =
  db && issuer
    ? {
        db,
        verifiedEmail: createVerifiedEmailLookup(issuer, apiKey),
        sendInvitation: createInvitationSender(process.env),
      }
    : undefined;
const app = await buildApp({
  logger: true,
  access,
  onboardingDb: db,
  memberships,
  settingsDb: db,
  salesDb: db,
  exchangeRatesDb: db?.officialExchangeRateSnapshot,
  goldMarketEnabled: goldPriceProvider === "gold-api",
  goldPriceSync,
  products: db
    ? {
        db,
        storage:
          supabaseUrl && storageKey
            ? createProductPhotoStorage(supabaseUrl, storageKey)
            : undefined,
      }
    : undefined,
});
if (db) app.addHook("onClose", async () => db.$disconnect());

try {
  await app.listen({ host: "127.0.0.1", port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
