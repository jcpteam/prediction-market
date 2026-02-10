import { cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { db } from "@/lib/drizzle";
import { runQuery } from "@/lib/db/utils/run-query";
import type { Event, QueryResult } from "@/types";
import { eq, inArray, ne, isNotNull, and, ilike, exists, sql, desc } from "drizzle-orm";
import axios from "axios";
import { OUTCOME_INDEX } from "@/lib/constants";
import { getSupabaseImageUrl } from "@/lib/supabase";
import {
  polymarket_events,
  polymarket_markets,
  polymarket_outcomes,
  polymarket_event_tags,
} from "@/lib/db/schema/events/polymarket_table";
import { tags } from "@/lib/db/schema/events/tables";
import { bookmarks } from "@/lib/db/schema/bookmarks/tables";

interface OutcomePrices {
  buy: number;
  sell: number;
}

interface PriceApiResponse {
  [key: string]: { BUY?: string; SELL?: string } | undefined;
}

const MAX_PRICE_BATCH = 500;

function isPrerenderAbortError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    digest?: string;
    name?: string;
    code?: string;
    message?: string;
  };

  if (record.digest === "HANGING_PROMISE_REJECTION") {
    return true;
  }

  if (record.name === "AbortError" || record.code === "UND_ERR_ABORTED") {
    return true;
  }

  if (
    typeof record.message === "string" &&
    record.message.includes("fetch() rejects when the prerender is complete")
  ) {
    return true;
  }

  return false;
}

function normalizeTradePrice(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}

async function fetchPriceBatch(
  endpoint: string,
  tokenIds: string[],
): Promise<{ data: PriceApiResponse | null; aborted: boolean }> {
  try {
    // Original fetch implementation:
    // const response = await fetch(endpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Accept': 'application/json',
    //   },
    //   body: JSON.stringify(tokenIds.map(tokenId => ({ token_id: tokenId }))),
    // })

    // axios implementation:
    const https = await import("https");
    const agent = new https.Agent({ family: 4, keepAlive: false });
    const response = await axios.post<PriceApiResponse>(
      endpoint,
      tokenIds.map((tokenId) => ({ token_id: tokenId })),
      {
        httpsAgent: agent,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        validateStatus: () => true, // Don't throw on any status code
      },
    );

    // Check response status (axios doesn't check ok by default)
    if (response.status >= 400) {
      return { data: null, aborted: false };
    }

    return { data: response.data as PriceApiResponse, aborted: false };
  } catch (error) {
    const aborted = isPrerenderAbortError(error);
    if (!aborted) {
      console.error("Failed to fetch outcome prices batch from CLOB.", error);
    }
    return { data: null, aborted };
  }
}

function applyPriceBatch(
  data: PriceApiResponse | null,
  priceMap: Map<string, OutcomePrices>,
  missingTokenIds: Set<string>,
) {
  if (!data) {
    return;
  }

  for (const [tokenId, priceBySide] of Object.entries(data ?? {})) {
    if (!priceBySide) {
      continue;
    }

    const parsedBuy =
      priceBySide.BUY != null ? Number(priceBySide.BUY) : undefined;
    const parsedSell =
      priceBySide.SELL != null ? Number(priceBySide.SELL) : undefined;
    const normalizedBuy =
      parsedBuy != null && Number.isFinite(parsedBuy) ? parsedBuy : undefined;
    const normalizedSell =
      parsedSell != null && Number.isFinite(parsedSell)
        ? parsedSell
        : undefined;

    if (normalizedBuy == null && normalizedSell == null) {
      continue;
    }

    priceMap.set(tokenId, {
      buy: normalizedSell ?? normalizedBuy ?? 0.5,
      sell: normalizedBuy ?? normalizedSell ?? 0.5,
    });
    missingTokenIds.delete(tokenId);
  }
}

async function fetchOutcomePrices(
  tokenIds: string[],
): Promise<Map<string, OutcomePrices>> {
  const uniqueTokenIds = Array.from(new Set(tokenIds.filter(Boolean)));

  if (uniqueTokenIds.length === 0) {
    return new Map();
  }

  const endpoint = `${process.env.CLOB_URL!}/prices`;
  const priceMap = new Map<string, OutcomePrices>();
  const missingTokenIds = new Set(uniqueTokenIds);
  let wasAborted = false;

  for (let i = 0; i < uniqueTokenIds.length; i += MAX_PRICE_BATCH) {
    const batch = uniqueTokenIds.slice(i, i + MAX_PRICE_BATCH);
    const batchResult = await fetchPriceBatch(endpoint, batch);
    if (batchResult.aborted) {
      wasAborted = true;
      break;
    }

    if (batchResult.data) {
      applyPriceBatch(batchResult.data, priceMap, missingTokenIds);
      continue;
    }

    const tokenResults = await Promise.allSettled(
      batch.map((tokenId) => fetchPriceBatch(endpoint, [tokenId])),
    );

    for (const result of tokenResults) {
      if (result.status === "fulfilled") {
        if (result.value.aborted) {
          wasAborted = true;
          break;
        }
        applyPriceBatch(result.value.data, priceMap, missingTokenIds);
      }
    }

    if (wasAborted) {
      break;
    }
  }

  for (const tokenId of missingTokenIds) {
    priceMap.set(tokenId, { buy: 0.5, sell: 0.5 });
  }

  return priceMap;
}

type PolymarketEventResult = typeof polymarket_events.$inferSelect & {
  polymarket_markets: (typeof polymarket_markets.$inferSelect & {
    outcomes?: (typeof polymarket_outcomes.$inferSelect)[];
  })[];
};

export function polymarketEventResource(
  event: PolymarketEventResult,
  priceMap: Map<string, OutcomePrices>,
): Event {
  const marketsWithDerivedValues = event.polymarket_markets.map(
    (market: any) => {
      const rawOutcomes = (market.outcomes || []) as Array<
        typeof polymarket_outcomes.$inferSelect
      >;
      const normalizedOutcomes = rawOutcomes.map((outcome) => {
        const outcomePrice = outcome.token_id
          ? priceMap.get(outcome.token_id)
          : undefined;
        const buyPrice = outcomePrice?.buy ?? 0.5;
        const sellPrice = outcomePrice?.sell ?? 0.5;

        return {
          ...outcome,
          outcome_index: Number(outcome.outcome_index || 0),
          payout_value: undefined,
          buy_price: buyPrice,
          sell_price: sellPrice,
        };
      });

      const primaryOutcome =
        normalizedOutcomes.find(
          (outcome) => outcome.outcome_index === OUTCOME_INDEX.YES,
        ) ?? normalizedOutcomes[0];
      const yesBuyPrice = primaryOutcome?.buy_price ?? 0.5;
      const yesSellPrice = primaryOutcome?.sell_price ?? yesBuyPrice;
      const yesMidPrice = (yesBuyPrice + yesSellPrice) / 2;
      const probability = yesMidPrice * 100;
      const normalizedCurrentVolume24h = Number(market.volume_24h || 0);
      const normalizedTotalVolume = Number(market.volume || 0);

      return {
        ...market,
        neg_risk: Boolean(market.neg_risk),
        neg_risk_other: Boolean(market.neg_risk_other),
        end_time: market.end_time?.toISOString?.() ?? null,
        question_id: market.condition_id || "",
        title: market.short_title || market.title,
        probability,
        price: yesMidPrice,
        volume: normalizedTotalVolume,
        volume_24h: normalizedCurrentVolume24h,
        outcomes: normalizedOutcomes,
        icon_url: getSupabaseImageUrl(market.icon_url),
        condition: null,
        is_resolved: Boolean(market.is_closed),
      };
    },
  );

  const totalRecentVolume = marketsWithDerivedValues.reduce(
    (sum: number, market: any) =>
      sum + (typeof market.volume_24h === "number" ? market.volume_24h : 0),
    0,
  );
  const isRecentlyUpdated =
    event.updated_at instanceof Date
      ? Date.now() - event.updated_at.getTime() < 1000 * 60 * 60 * 24 * 3
      : false;
  const isTrending = totalRecentVolume > 0 || isRecentlyUpdated;

  return {
    id: String(event.id || ""),
    slug: event.slug || "",
    title: event.title || "",
    creator: "",
    icon_url: getSupabaseImageUrl(event.icon_url),
    show_market_icons: event.show_market_icons ?? true,
    enable_neg_risk: Boolean(event.enable_neg_risk),
    neg_risk_augmented: Boolean(event.neg_risk_augmented),
    neg_risk: Boolean(event.neg_risk),
    neg_risk_market_id: event.neg_risk_market_id || undefined,
    status: (event.status ?? "active") as Event["status"],
    rules: event.rules || undefined,
    active_markets_count: Number(event.active_markets_count || 0),
    total_markets_count: Number(event.total_markets_count || 0),
    created_at: event.created_at?.toISOString() || new Date().toISOString(),
    updated_at: event.updated_at?.toISOString() || new Date().toISOString(),
    end_date: event.end_date?.toISOString() ?? null,
    resolved_at: null,
    volume: marketsWithDerivedValues.reduce(
      (sum: number, market: { volume: number }) => sum + (market.volume ?? 0),
      0,
    ),
    markets: marketsWithDerivedValues,
    tags: [],
    main_tag: "World",
    is_bookmarked: false,
    is_trending: isTrending,
  };
}

export const PolymarketEventRepository = {
  async fetchLastTradePrices(tokenIds: string[]): Promise<Map<string, number>> {
    const uniqueTokenIds = Array.from(new Set(tokenIds.filter(Boolean)));

    if (!uniqueTokenIds.length) {
      return new Map();
    }

    const endpoint = `${process.env.CLOB_URL!}/last-trades-prices`;
    const lastTradeMap = new Map<string, number>();

    try {
      const response = await axios.post<Array<{ token_id: string; price: string }>>(
        endpoint,
        uniqueTokenIds.map((tokenId) => ({ token_id: tokenId })),
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (response.status >= 400) {
        return lastTradeMap;
      }

      const payload = response.data;
      payload.forEach((entry) => {
        const normalized = normalizeTradePrice(entry?.price);
        if (normalized != null && entry?.token_id) {
          lastTradeMap.set(entry.token_id, normalized);
        }
      });
    } catch (error) {
      console.error("Failed to fetch last trades prices", error);
      return lastTradeMap;
    }

    return lastTradeMap;
  },

  async listEvents({
    tag = "trending",
    search = "",
    userId = "",
    bookmarked = false,
    status = "active",
    offset = 0,
  }: {
    tag: string;
    search?: string;
    userId?: string | undefined;
    bookmarked?: boolean;
    status?: Event["status"];
    offset?: number;
  }): Promise<QueryResult<Event[]>> {
    "use cache";
    cacheTag(cacheTags.events(userId));

    return await runQuery(async () => {
      const limit = 40;
      const validOffset = Number.isNaN(offset) || offset < 0 ? 0 : offset;

      // Build WHERE conditions
      const whereConditions: any[] = [eq(polymarket_events.status, status)];

      // Search by title - multiple search terms with AND logic
      if (search) {
        const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (searchTerms.length > 0) {
          const loweredTitle = sql<string>`LOWER(${polymarket_events.title})`;
          whereConditions.push(
            and(...searchTerms.map((term) => ilike(loweredTitle, `%${term}%`))),
          );
        }
      }

      // Filter by tag (except 'trending' and 'new')
      if (tag && tag !== "trending" && tag !== "new") {
        whereConditions.push(
          exists(
            db
              .select()
              .from(polymarket_event_tags)
              .innerJoin(tags, eq(polymarket_event_tags.tag_id, tags.id))
              .where(
                and(
                  eq(polymarket_event_tags.event_id, polymarket_events.id),
                  eq(tags.slug, tag),
                ),
              ),
          ),
        );
      }

      // Filter by bookmarked
      if (bookmarked && userId) {
        whereConditions.push(
          exists(
            db
              .select()
              .from(bookmarks)
              .where(
                and(
                  eq(bookmarks.event_id, polymarket_events.id),
                  eq(bookmarks.user_id, userId),
                ),
              ),
          ),
        );
      }

      const baseWhere = and(...whereConditions);

      // Determine ordering based on tag
      const orderBy = tag === "trending"
        ? desc(polymarket_events.created_at)
        : desc(polymarket_events.created_at);

      // Fetch events with pagination
      const eventsData = await db
        .select()
        .from(polymarket_events)
        .where(baseWhere)
        // .orderBy(orderBy)
        .limit(limit)
        .offset(validOffset);

      if (eventsData.length === 0) {
        return { data: [], error: null };
      }
      console.log("Fetched events:", eventsData.length)

      const eventIds = eventsData.map((e) => e.id);

      // Fetch markets for these events (single query)
      const markets = await db
        .select()
        .from(polymarket_markets)
        .where(
          and(
            inArray(polymarket_markets.event_id, eventIds),
            ne(polymarket_markets.condition_id, ""),
            isNotNull(polymarket_markets.condition_id),
          ),
        );

        console.log("Fetched markets:", markets.length)

      // Fetch outcomes for all markets (single query)
      const conditionIds = markets.map((m) => m.condition_id).filter(Boolean) as string[];
      let outcomes: (typeof polymarket_outcomes.$inferSelect)[] = [];
      if (conditionIds.length > 0) {
        outcomes = await db
          .select()
          .from(polymarket_outcomes)
          .where(inArray(polymarket_outcomes.condition_id, conditionIds));
      }

      console.log("Fetched outcomes:", outcomes.length)

      // Create a map for efficient market lookup
      const marketsByEventId = new Map();
      markets.forEach((market) => {
        if (!marketsByEventId.has(market.event_id)) {
          marketsByEventId.set(market.event_id, []);
        }
        marketsByEventId.get(market.event_id).push({
          ...market,
          outcomes: outcomes.filter((o) => o.condition_id === market.condition_id),
        });
      });

      console.log("Mapped markets to events");

      // Build events with relationships
      const eventsResult: PolymarketEventResult[] = eventsData
        .map((event) => ({
          ...event,
          polymarket_markets: marketsByEventId.get(event.id) || [],
        }))
        .filter((event) => event.polymarket_markets.length > 0);

      if (eventsResult.length === 0) {
        return { data: [], error: null };
      }

      console.log("Events with markets:", eventsResult.length)

      // Fetch prices for all outcomes
      const tokensForPricing = eventsResult.flatMap((event) =>
        event.polymarket_markets.flatMap((market) =>
          (market.outcomes || [])
            .map((outcome) => outcome.token_id)
            .filter(Boolean),
        ),
      );

      console.log("Fetching prices for tokens:", tokensForPricing.length)

      const priceMap = await fetchOutcomePrices(tokensForPricing);

      // Transform to Event objects
      const eventsWithMarkets = eventsResult.map((event) =>
        polymarketEventResource(event as PolymarketEventResult, priceMap),
      );

      return { data: eventsWithMarkets, error: null };
    });
  },
}; 
