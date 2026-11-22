import { randomUUID } from "node:crypto";
import { createDatabase } from "@mizan/database";
import { afterAll, expect, test, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { goldRefreshMs } from "../src/modules/gold-prices/gold-market.service.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local gold pricing database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "synchronizes shared quotes, isolates store rules and snapshots the trade-in price",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = randomUUID();
    const seller = randomUUID();
    const outsider = randomUUID();
    const restricted = randomUUID();
    const identities = new Set<string>([owner, seller, outsider]);
    const now = new Date();
    await db.goldMarketCache.deleteMany({ where: { source: "GOLD_API" } });
    const rates = {
      effectiveDate: new Date(now.getTime() - 86_400_000),
      attemptedAt: now,
      retrievedAt: now,
      usd: "1.7",
      eur: "1.9",
      try: "0.04",
    };
    await db.officialExchangeRateSnapshot.upsert({
      where: { source: "CBAR" },
      create: { source: "CBAR", ...rates },
      update: rates,
    });

    let price = 3110.34768;
    let effectiveAt = now;
    const upstream = vi.fn().mockImplementation(async (input: string) => {
      expect(input).toBe("https://api.gold-api.com/price/XAU");
      return Response.json({
        symbol: "XAU",
        currency: "USD",
        price,
        updatedAt: effectiveAt.toISOString(),
      });
    });
    vi.stubGlobal("fetch", upstream);
    const options = {
      access: {
        db,
        verifyToken: async (token: string) =>
          token === restricted
            ? { userId: owner, sessionId: restricted }
            : identities.has(token)
              ? { userId: token }
              : null,
      },
      onboardingDb: db,
      settingsDb: db,
      exchangeRatesDb: db.officialExchangeRateSnapshot,
      products: { db },
      salesDb: db,
    };
    const app = await buildApp(options);
    const secondApp = await buildApp(options);
    const disabled = await buildApp({ ...options, goldMarketEnabled: false });
    const send = (
      method: "GET" | "POST",
      path: string,
      user: string = owner,
      payload?: object,
      instance = app,
    ) =>
      instance.inject({
        method,
        url: `/api/v1${path}`,
        headers: {
          authorization: `Bearer ${user}`,
          "idempotency-key": randomUUID(),
        },
        payload,
      });
    const expireClaim = () =>
      db.goldMarketCache.update({
        where: { source: "GOLD_API" },
        data: { attemptedAt: new Date(Date.now() - goldRefreshMs - 1) },
      });
    try {
      const onboarding = await send("POST", "/onboarding", owner, {
        organizationName: "Gold pricing fixture",
        storeName: "Test store",
        defaultCurrency: "AZN",
      });
      expect(onboarding.statusCode).toBe(200);
      const { organizationId, storeId } = onboarding.json();
      const organization = `/organizations/${organizationId}`;
      const market = `${organization}/stores/${storeId}/gold-prices`;
      const settings = `${market}/settings`;
      const query = new URLSearchParams({ organizationId, storeId }).toString();
      await db.user.create({ data: { id: seller } });
      await db.organizationMembership.create({
        data: { organizationId, userId: seller, role: "SALESPERSON" },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId, userId: seller },
      });
      await db.salespersonDisplaySession.create({
        data: { sessionId: restricted, userId: owner },
      });
      const other = await db.store.create({
        data: { organizationId, name: "Second store" },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId: other.id, userId: owner },
      });
      const otherSettings = `${organization}/stores/${other.id}/gold-prices/settings`;
      const fixed = {
        kind: "SELL",
        mode: "FIXED",
        value: "140",
        purity: 585,
        expectedPriceId: null,
      };
      expect((await send("GET", market, outsider)).statusCode).toBe(403);
      expect((await send("GET", otherSettings, seller)).statusCode).toBe(403);
      for (const user of [seller, restricted]) {
        expect((await send("GET", settings, user)).statusCode).toBe(403);
        expect((await send("POST", settings, user, fixed)).statusCode).toBe(
          403,
        );
      }
      expect(upstream).not.toHaveBeenCalled();
      expect(
        (await send("GET", settings, owner, undefined, disabled)).json(),
      ).toMatchObject({ quote: null, stale: true });
      const selling = await send("POST", settings, owner, fixed, disabled);
      expect(selling.statusCode).toBe(200);
      expect(selling.json()).toMatchObject({
        mode: "FIXED",
        pricePerGram: { amount: "140", currency: "AZN" },
      });
      expect(
        (await send("GET", otherSettings, owner, undefined, disabled)).json()
          .rules,
      ).toEqual([]);

      const concurrent = await Promise.all([
        send("GET", market, seller),
        send("GET", market, seller, undefined, secondApp),
      ]);
      expect(concurrent.every(({ statusCode }) => statusCode === 200)).toBe(
        true,
      );
      expect(upstream).toHaveBeenCalledOnce();
      const live = (await send("GET", market, seller)).json();
      expect(live).toMatchObject({
        stale: false,
        quote: {
          source: "GOLD_API",
          effectiveAt: now.toISOString(),
          usdAzn: "1.7",
          pricePerGram: { amount: "170.00", currency: "AZN" },
        },
      });
      expect(live).not.toHaveProperty("rules");
      const quoteId = live.quote.id;
      const draft = {
        ...fixed,
        mode: "OFFSET",
        value: "-5",
        expectedPriceId: selling.json().id,
      };
      const preview = await send("POST", `${settings}/preview`, owner, draft);
      expect(preview.json()).toMatchObject({
        quoteId,
        pricePerGram: { amount: "94.45", currency: "AZN" },
      });
      for (const value of ["-100", "1.00001"]) {
        expect(
          (
            await send("POST", `${settings}/preview`, owner, {
              ...draft,
              value,
            })
          ).statusCode,
        ).toBe(400);
      }
      expect(
        (
          await send("POST", settings, owner, {
            ...draft,
            quoteId: randomUUID(),
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await send("POST", settings, owner, {
            ...draft,
            kind: "BUY",
            quoteId,
          })
        ).statusCode,
      ).toBe(400);
      const { id: ruleId } = await db.storeGoldPriceRule.create({
        data: {
          organizationId,
          storeId,
          actorId: owner,
          kind: "BUY",
          mode: "OFFSET",
          purity: 585,
          currency: "AZN",
          amountPerGram: "-5",
        },
      });
      const percentage = await send("POST", `${settings}/preview`, owner, {
        ...draft,
        mode: "PERCENTAGE",
        value: "10",
      });
      expect(percentage.json()).toMatchObject({
        pricePerGram: { amount: "109.395" },
      });
      expect(
        (
          await send("POST", `${settings}/preview`, owner, {
            ...draft,
            mode: "PERCENTAGE",
            value: "-100",
          })
        ).json(),
      ).toMatchObject({ pricePerGram: { amount: "0" } });
      expect(
        (
          await send("POST", `${organization}/rates`, owner, {
            purity: 585,
            currency: "AZN",
            amountPerGram: "85",
          })
        ).statusCode,
      ).toBe(200);

      const intake = {
        code: randomUUID(),
        name: "Ring",
        category: "Jewellery",
        purity: 585,
        weight: "2",
        acquisitionCostPerGram: { amount: "30", currency: "AZN" },
      };
      expect(
        (
          await send("POST", `/products?${query}`, owner, {
            ...intake,
            netGoldWeight: "2.1",
          })
        ).json().field,
      ).toBe("netGoldWeight");
      const unweighed = await send("POST", `/products?${query}`, owner, intake);
      const unweighedDetail = (
        await send("GET", `/products/${unweighed.json().id}?${query}`, seller)
      ).json();
      expect(unweighedDetail).not.toHaveProperty("estimatedMaterialValue");
      expect(unweighedDetail).not.toHaveProperty("estimatedSellingValue");
      const product = await send("POST", `/products?${query}`, owner, {
        ...intake,
        code: randomUUID(),
        netGoldWeight: "1.5",
      });
      expect(product.statusCode).toBe(201);
      const productId = product.json().id;
      const currentProduct = () =>
        send("GET", `/products/${productId}?${query}`, seller);
      const detail = (await currentProduct()).json();
      expect(detail).toMatchObject({
        netGoldWeight: "1.500",
        estimatedMaterialValue: { amount: "149.18", currency: "AZN" },
        estimatedSellingValue: { amount: "210.00", currency: "AZN" },
      });
      expect(detail).not.toHaveProperty("acquisitionCost");
      const body = {
        productId,
        saleAmount: "200",
        tradeIns: [
          {
            purity: 585,
            weight: "1",
            rateId: ruleId,
            marketQuoteId: quoteId,
            overrideAmount: "90",
          },
        ],
      };
      expect(
        (await send("GET", `/sales/options?${query}`, seller)).json().rates,
      ).toContainEqual({
        id: ruleId,
        purity: 585,
        amountPerGram: "94.45",
        marketQuoteId: quoteId,
      });
      expect(
        (
          await send("POST", `/sales?${query}`, owner, {
            ...body,
            tradeIns: [{ ...body.tradeIns[0], marketQuoteId: randomUUID() }],
          })
        ).statusCode,
      ).toBe(409);
      const sale = await send("POST", `/sales?${query}`, owner, body);
      expect(sale.statusCode).toBe(201);
      expect(sale.json()).toMatchObject({
        saleAmount: "200",
        tradeIns: [
          { appliedRate: "94.45", acceptedValue: "90", marketQuoteId: quoteId },
        ],
      });

      await expireClaim();
      price = 6220.69536;
      effectiveAt = new Date(now.getTime() + 1);
      const refreshed = (await send("GET", market, seller)).json();
      expect(refreshed.quote.id).not.toBe(quoteId);
      expect((await send("GET", settings)).json().rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: ruleId,
            pricePerGram: { amount: "193.9", currency: "AZN" },
          }),
          expect.objectContaining({
            id: selling.json().id,
            pricePerGram: { amount: "140", currency: "AZN" },
          }),
        ]),
      );
      const history = (await send("GET", `${market}/history`, seller)).json();
      expect(history.items.map(({ id }: { id: string }) => id)).toEqual(
        expect.arrayContaining([quoteId, refreshed.quote.id]),
      );
      const day = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Baku",
      }).format(now);
      const range = (
        await send(
          "GET",
          `${market}/history?from=${day}&through=${day}`,
          seller,
        )
      ).json();
      expect(range.items.map(({ id }: { id: string }) => id)).toContain(
        quoteId,
      );
      expect(
        (await send("GET", `${market}/history?from=2026-02-30`, seller))
          .statusCode,
      ).toBe(400);
      expect(
        (await send("GET", `${settings}/history`)).json().items,
      ).toHaveLength(2);
      const receipt = await send("GET", `/sales/${sale.json().id}?${query}`);
      expect(receipt.json()).toEqual(sale.json());

      const currenciesPath = `${organization}/settings/currencies`;
      const currencies = {
        defaultCurrency: "USD",
        paymentCurrencies: ["USD", "EUR"],
      };
      expect(
        (await send("POST", currenciesPath, seller, currencies)).statusCode,
      ).toBe(403);
      expect(
        (
          await send("POST", currenciesPath, owner, {
            ...currencies,
            paymentCurrencies: ["EUR"],
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await send("POST", currenciesPath, owner, currencies)).json(),
      ).toEqual(currencies);
      const workspace = (
        await send("GET", `${organization}/stores/${storeId}/access`, seller)
      ).json();
      expect(workspace.settings).toMatchObject(currencies);
      const marketOnly = await send("POST", `/products?${query}`, owner, {
        ...intake,
        code: randomUUID(),
        purity: 750,
        netGoldWeight: "1.5",
      });
      expect(marketOnly.statusCode).toBe(201);
      const marketOnlyId = marketOnly.json().id;
      expect(
        (
          await send("GET", `/products/${marketOnlyId}?${query}`, seller)
        ).json(),
      ).toMatchObject({
        estimatedSellingValue: { amount: "225.00", currency: "USD" },
      });
      const currencySale = await send("POST", `/sales?${query}`, owner, {
        productId: marketOnlyId,
        saleAmount: "225",
        expectedCurrency: "USD",
        customerReportingRate: "1.7",
        payments: [
          {
            method: "CASH",
            currency: "TRY",
            amount: "1",
            exchangeRate: "0.04",
          },
        ],
      });
      expect(currencySale.statusCode).toBe(400);
      expect(currencySale.json().field).toBe("payments.0.currency");
      expect(
        (await send("GET", `/sales/${sale.json().id}?${query}`)).json(),
      ).toEqual(sale.json());
      expect(
        (
          await send("POST", currenciesPath, owner, {
            defaultCurrency: "AZN",
            paymentCurrencies: ["AZN"],
          })
        ).statusCode,
      ).toBe(200);

      await expireClaim();
      upstream
        .mockRejectedValueOnce(new Error("Provider unavailable"))
        .mockRejectedValueOnce(new Error("Provider still unavailable"));
      expect((await send("GET", market, seller)).json()).toMatchObject({
        stale: true,
        quote: refreshed.quote,
      });
      expect(
        (await send("GET", `/sales/options?${query}`, seller)).json().rates,
      ).toEqual([
        expect.objectContaining({ purity: 585, amountPerGram: "85" }),
      ]);
      expect(
        (await send("POST", `${settings}/preview`, owner, draft)).json().code,
      ).toBe("GOLD_PRICE_UNAVAILABLE");
      expect(
        (
          await send("POST", settings, owner, {
            ...fixed,
            value: "0",
            expectedPriceId: selling.json().id,
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      vi.unstubAllGlobals();
      await Promise.all([app.close(), secondApp.close(), disabled.close()]);
    }
  },
  25_000,
);
