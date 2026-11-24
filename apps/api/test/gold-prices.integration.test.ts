import { randomUUID } from "node:crypto";
import type { DashboardGoldRates } from "@mizan/contracts";
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
        fullName: "Gold Pricing Test Owner",
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
        kind: "RETAIL_SELL",
        mode: "FIXED",
        value: "140",
        purity: 585,
      };
      const previewDraft = (body: object, instance = app) =>
        send("POST", settings + "/preview", owner, body, instance);
      const saveDraft = async (
        body: object,
        instance = app,
        confirmFixedDefault?: true,
      ) => {
        const preview = await previewDraft(body, instance);
        expect(preview.statusCode).toBe(200);
        const { expectedPriceId, quoteId, revision } = preview.json();
        return send(
          "POST",
          settings,
          owner,
          {
            ...body,
            expectedPriceId,
            quoteId,
            revision,
            confirmFixedDefault,
          },
          instance,
        );
      };
      const currentRate = async (
        purity: number,
        kind: string,
        instance = app,
      ) => {
        const { rates } = (
          await send("GET", settings, owner, undefined, instance)
        ).json();
        return rates
          .find((row: { purity: number }) => row.purity === purity)
          ?.prices.find((row: { kind: string }) => row.kind === kind);
      };
      const publicRates = async (user: string, instance = app) => {
        const response = await send(
          "GET",
          `${market}/rates`,
          user,
          undefined,
          instance,
        );
        expect(response.statusCode, response.body).toBe(200);
        return response.json<DashboardGoldRates>().rates;
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
      const selling = await saveDraft(fixed, disabled);
      expect(selling.statusCode).toBe(200);
      expect(selling.json()).toMatchObject({
        configuration: { mode: "FIXED", value: "140" },
      });
      expect(
        (await send("GET", otherSettings, owner, undefined, disabled)).json()
          .rules,
      ).toEqual([]);

      expect(await currentRate(585, "RETAIL_SELL", disabled)).toMatchObject({
        pricePerGram: { amount: "140", currency: "AZN" },
        source: "INDIVIDUAL",
      });
      expect(await publicRates(seller, disabled)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            purity: 585,
            commercial: expect.objectContaining({
              RETAIL_SELL: { amount: "140", currency: "AZN" },
            }),
            retailStatus: "CURRENT",
          }),
          expect.objectContaining({
            purity: 750,
            retailStatus: "UNAVAILABLE",
            commercial: expect.objectContaining({ RETAIL_SELL: null }),
          }),
        ]),
      );
      expect((await send("GET", `${market}/rates`, outsider)).statusCode).toBe(
        403,
      );
      expect(await currentRate(585, "SCRAP_BUY", disabled)).toMatchObject({
        pricePerGram: null,
        status: "UNAVAILABLE",
        source: null,
      });
      expect(
        (
          await previewDraft({ ...fixed, mode: "OFFSET", value: "0" }, disabled)
        ).json().code,
      ).toBe("GOLD_PRICE_UNAVAILABLE");

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
      };
      const preview = await send("POST", `${settings}/preview`, owner, draft);
      expect(preview.json()).toMatchObject({
        quoteId,
        rates: [{ pricePerGram: { amount: "94.45", currency: "AZN" } }],
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
            revision: preview.json().revision,
            expectedPriceId: selling.json().id,
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
      const buy = {
        ...draft,
        purity: null,
        kind: "SCRAP_BUY",
        mode: "PERCENTAGE",
        value: "-5",
      };
      const relativeBuy = await saveDraft(buy);
      expect(relativeBuy.statusCode).toBe(200);
      const scrapSell = {
        ...draft,
        kind: "SCRAP_SELL",
        purity: null,
        value: "-12",
      };
      expect((await saveDraft(scrapSell)).statusCode).toBe(200);
      expect(await currentRate(585, "SCRAP_SELL")).toMatchObject({
        pricePerGram: { amount: "87.45" },
        source: "DEFAULT",
        warnings: ["SCRAP_SPREAD"],
      });
      expect(await currentRate(585, "SCRAP_BUY")).toMatchObject({
        pricePerGram: { amount: "94.4775" },
        source: "DEFAULT",
      });
      const deviation = await previewDraft({ ...fixed, value: "300" });
      expect(deviation.json().rates).toMatchObject([
        { pricePerGram: { amount: "300" }, warnings: ["MARKET_DEVIATION"] },
      ]);
      const individual = { ...draft, kind: "SCRAP_BUY" };
      const { id: ruleId } = (await saveDraft(individual)).json();
      expect(typeof ruleId).toBe("string");

      const staleDefaultDraft = await previewDraft({ ...buy, value: "-7" });
      expect(
        staleDefaultDraft
          .json()
          .rates.map(({ purity }: { purity: number }) => purity),
      ).not.toContain(585);
      expect(
        (await send("POST", organization + "/purities", owner, { value: 610 }))
          .statusCode,
      ).toBe(200);
      expect(await currentRate(610, "SCRAP_BUY")).toMatchObject({
        source: "DEFAULT",
        pricePerGram: { amount: "98.515" },
      });
      const {
        revision: staleRevision,
        quoteId: staleQuote,
        expectedPriceId: stalePrice,
      } = staleDefaultDraft.json();
      expect(
        (
          await send("POST", settings, owner, {
            ...buy,
            value: "-7",
            revision: staleRevision,
            quoteId: staleQuote,
            expectedPriceId: stalePrice,
          })
        ).json().code,
      ).toBe("GOLD_PRICE_CONFLICT");

      const fixedDefault = { ...buy, mode: "FIXED", value: "80" };
      expect((await saveDraft(fixedDefault)).json().code).toBe(
        "INVALID_SETTINGS",
      );
      expect((await saveDraft(fixedDefault, app, true)).statusCode).toBe(200);
      expect(await currentRate(585, "SCRAP_BUY")).toMatchObject({
        source: "INDIVIDUAL",
        pricePerGram: { amount: "94.45" },
      });
      expect(await currentRate(610, "SCRAP_BUY")).toMatchObject({
        source: "DEFAULT",
        pricePerGram: { amount: "80" },
      });
      expect(
        (await send("GET", otherSettings))
          .json()
          .rates.find(({ purity }: { purity: number }) => purity === 585)
          .prices,
      ).toContainEqual(
        expect.objectContaining({ kind: "SCRAP_BUY", pricePerGram: null }),
      );
      expect(
        (
          await send(
            "POST",
            organization + "/purities/610/deactivate",
            owner,
            {},
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await previewDraft({ ...individual, purity: 610 })).json().code,
      ).toBe("PURITY_CONFLICT");
      expect(await currentRate(610, "SCRAP_BUY")).toBeUndefined();
      expect(
        (await publicRates(seller)).some(({ purity }) => purity === 610),
      ).toBe(false);
      expect(
        (
          await send(
            "POST",
            organization + "/purities/610/reactivate",
            owner,
            {},
          )
        ).statusCode,
      ).toBe(200);
      expect(await currentRate(610, "SCRAP_BUY")).toMatchObject({
        source: "DEFAULT",
      });
      for (const invalid of [
        { ...buy, value: "-100" },
        { ...buy, value: "NaN" },
        { ...buy, mode: "FIXED", value: "0" },
        { ...buy, mode: "OFFSET", value: "-200" },
        { ...scrapSell, mode: "FIXED", value: "-1" },
        { ...buy, currency: "USD" },
      ])
        expect((await previewDraft(invalid)).statusCode).toBe(400);

      const percentage = await send("POST", `${settings}/preview`, owner, {
        ...draft,
        mode: "PERCENTAGE",
        value: "+10",
      });
      expect(percentage.json()).toMatchObject({
        rates: [{ pricePerGram: { amount: "109.395" } }],
      });
      expect(
        (
          await send("POST", `${settings}/preview`, owner, {
            ...draft,
            mode: "PERCENTAGE",
            value: "-100",
          })
        ).json(),
      ).toMatchObject({ rates: [{ pricePerGram: { amount: "0" } }] });

      const intake = {
        code: randomUUID(),
        name: "Ring",
        category: "Ring",
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

      expect(
        (
          await saveDraft({
            ...draft,
            purity: 375,
            mode: "PERCENTAGE",
            value: "10",
          })
        ).statusCode,
      ).toBe(200);
      expect((await saveDraft({ ...draft, purity: 916 })).statusCode).toBe(200);
      const retailRates = await publicRates(owner);
      expect(await publicRates(seller)).toEqual(retailRates);
      expect(await publicRates(restricted)).toEqual(retailRates);
      expect(retailRates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            purity: 375,
            retailStatus: "CURRENT",
            commercial: expect.objectContaining({
              RETAIL_SELL: { amount: "70.125", currency: "AZN" },
            }),
          }),
          expect.objectContaining({
            purity: 916,
            retailStatus: "CURRENT",
            commercial: expect.objectContaining({
              RETAIL_SELL: { amount: "150.72", currency: "AZN" },
            }),
          }),
        ]),
      );

      const beforeRefresh = (await send("GET", settings + "/history")).json()
        .items;
      for (const user of [owner, seller, restricted]) {
        const options = await send("GET", `/sales/options?${query}`, user);
        expect(options.statusCode).toBe(200);
        expect(options.json().retailRates).toEqual(
          expect.arrayContaining([
            { purity: 585, amountPerGram: "140" },
            { purity: 375, amountPerGram: "70.125" },
            { purity: 916, amountPerGram: "150.72" },
          ]),
        );
      }
      await expireClaim();
      price = 6220.69536;
      effectiveAt = new Date(now.getTime() + 1);
      const refreshed = (await send("GET", market, seller)).json();
      expect(refreshed.quote.id).not.toBe(quoteId);
      expect(await currentRate(585, "SCRAP_BUY")).toMatchObject({
        pricePerGram: { amount: "193.9", currency: "AZN" },
      });
      expect(await currentRate(585, "RETAIL_SELL")).toMatchObject({
        pricePerGram: { amount: "140", currency: "AZN" },
      });
      expect(
        (
          await send("POST", settings, owner, {
            ...draft,
            expectedPriceId: selling.json().id,
            revision: preview.json().revision,
            quoteId,
          })
        ).json().code,
      ).toBe("GOLD_PRICE_CONFLICT");
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
      expect((await send("GET", `${settings}/history`)).json().items).toEqual(
        beforeRefresh,
      );
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
      const foreignRate = (await send("GET", "/sales/options?" + query, seller))
        .json()
        .rates.find(({ purity }: { purity: number }) => purity === 585);
      expect(
        (await send("GET", "/sales/options?" + query, seller)).json(),
      ).toMatchObject({
        currency: "USD",
        retailRates: expect.arrayContaining([
          { purity: 585, amountPerGram: "82.3529411764705882" },
        ]),
      });
      expect(foreignRate).toMatchObject({
        amountPerGram: "114.0588",
        rateExchangeRate: "1.7",
        marketQuoteId: refreshed.quote.id,
      });
      const trade = {
        purity: 585,
        weight: "1.005",
        rateId: ruleId,
        rateExchangeRate: "1.7",
        marketQuoteId: refreshed.quote.id,
      };
      const foreignPreview = await send(
        "POST",
        "/sales/preview?" + query,
        seller,
        { tradeIns: [trade], expectedCurrency: "USD" },
      );
      expect(foreignPreview.json()).toMatchObject({
        currency: "USD",
        tradeInTotal: "114.629094",
      });
      expect(
        (
          await send("POST", "/sales/preview?" + query, seller, {
            tradeIns: [{ ...trade, rateExchangeRate: "1.8" }],
          })
        ).json().code,
      ).toBe("SALE_CONFLICT");
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
      const savedForeignSale = await send("POST", `/sales?${query}`, seller, {
        productId: marketOnlyId,
        saleAmount: "225",
        expectedCurrency: "USD",
        customerReportingRate: "1.7",
        tradeIns: [trade],
      });
      expect(savedForeignSale.statusCode).toBe(201);
      expect(savedForeignSale.json()).toMatchObject({
        currency: "USD",
        saleAmount: "225",
        balance: "110.37",
        tradeIns: [
          {
            rateId: ruleId,
            marketQuoteId: refreshed.quote.id,
            rateExchangeRate: "1.7",
            appliedRate: "114.0588",
            acceptedValue: "114.629094",
          },
        ],
      });
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
      expect(await publicRates(seller)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            purity: 585,
            retailStatus: "CURRENT",
            commercial: expect.objectContaining({
              RETAIL_SELL: { amount: "140", currency: "AZN" },
            }),
          }),
          expect.objectContaining({
            purity: 375,
            retailStatus: "STALE",
            commercial: expect.objectContaining({ RETAIL_SELL: null }),
          }),
        ]),
      );
      expect(
        (await send("GET", "/sales/options?" + query, seller)).json().rates,
      ).toContainEqual({ purity: 585, id: null, amountPerGram: null });
      expect(await currentRate(585, "SCRAP_BUY")).toMatchObject({
        pricePerGram: null,
        status: "STALE",
        source: "INDIVIDUAL",
      });
      const manual = {
        purity: 585,
        weight: "1.05",
        rateId: null,
        overrideAmount: "85",
      };
      expect(
        (
          await send("POST", "/sales/preview?" + query, seller, {
            tradeIns: [{ ...manual, overrideAmount: undefined }],
          })
        ).json().code,
      ).toBe("GOLD_PRICE_UNAVAILABLE");
      const manualSale = await send("POST", "/sales?" + query, seller, {
        productId: unweighed.json().id,
        saleAmount: "200",
        tradeIns: [manual],
      });
      expect(manualSale.statusCode).toBe(201);
      expect(manualSale.json().tradeIns).toMatchObject([
        {
          rateId: null,
          appliedRate: null,
          calculatedValue: null,
          acceptedValue: "85",
          overridden: true,
        },
      ]);

      const reset = { kind: "SCRAP_BUY", purity: 585, reset: true };
      const pendingReset = (await previewDraft(reset)).json();
      const nextDefault = await saveDraft(
        { ...fixedDefault, value: "82" },
        app,
        true,
      );
      expect(nextDefault.statusCode).toBe(200);
      const { revision, expectedPriceId } = pendingReset;
      expect(
        (
          await send("POST", settings, owner, {
            ...reset,
            revision,
            expectedPriceId,
          })
        ).json().code,
      ).toBe("GOLD_PRICE_CONFLICT");
      const resetResult = await saveDraft(reset);
      expect(resetResult.statusCode).toBe(200);
      expect(await currentRate(585, "SCRAP_BUY")).toMatchObject({
        pricePerGram: { amount: "82" },
        status: "CURRENT",
        source: "DEFAULT",
      });
      expect(
        (await send("GET", settings + "/history")).json().items[0],
      ).toMatchObject({
        id: resetResult.json().id,
        actorId: owner,
        configuration: null,
        previous: { mode: "OFFSET", value: "-5" },
      });
      expect(
        (await send("GET", "/sales/" + sale.json().id + "?" + query)).json(),
      ).toEqual(sale.json());
      expect(
        await db.storeGoldPriceRule.findUnique({ where: { id: ruleId } }),
      ).not.toBeNull();
      expect(
        (await send("POST", `${settings}/preview`, owner, draft)).json().code,
      ).toBe("GOLD_PRICE_UNAVAILABLE");
      expect((await saveDraft({ ...fixed, value: "0" })).statusCode).toBe(200);
    } finally {
      vi.unstubAllGlobals();
      await Promise.all([app.close(), secondApp.close(), disabled.close()]);
    }
  },
  25_000,
);
