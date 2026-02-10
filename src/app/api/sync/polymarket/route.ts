import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth-cron";
import axios from "axios";
import { supabaseAdmin } from "@/lib/supabase";

const POLYMARKET_EVENT_URL = "https://gamma-api.polymarket.com/events";
const PAGE_LIMIT = 50;

// Fetch and process events using offset-based pagination with streaming
async function fetchAndProcessPolymarketEvents(
  pageHandler: (pageEvents: any[]) => Promise<void>
): Promise<number> {
  const https = await import("https");
  const agent = new https.Agent({ family: 4, keepAlive: false });

  let offset = 0;
  let totalProcessed = 0;
  let pageCount = 0;

  console.log("Starting to fetch and process Polymarket events (streaming)...");

  while (true) {
    pageCount++;
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_LIMIT));
    params.set('offset', String(offset));
    params.set('active', 'true');
    params.set('closed', 'false');

    const url = `${POLYMARKET_EVENT_URL}?${params.toString()}`;
    console.log(`Fetching page ${pageCount}: offset=${offset}, limit=${PAGE_LIMIT}`);

    try {
      const axiosResp = await axios.get(url, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'prediction-market-axios/1.0',
        },
        validateStatus: (status) => status >= 200 && status < 300,
      });

      const data = axiosResp.data;

      // Check if we got valid data
      if (!data || !Array.isArray(data)) {
        console.log(`Page ${pageCount}: No valid data received, stopping`);
        break;
      }

      if (data.length === 0) {
        console.log(`Page ${pageCount}: Empty response, all data fetched`);
        break;
      }

      console.log(`Page ${pageCount}: Processing ${data.length} events...`);

      // Process this page immediately (stream to DB)
      await pageHandler(data);

      totalProcessed += data.length;
      console.log(`Page ${pageCount}: Successfully processed ${data.length} events (total: ${totalProcessed})`);

      // If we got less than the limit, we've reached the end
      if (data.length < PAGE_LIMIT) {
        console.log(`Page ${pageCount}: Received less than limit (${data.length} < ${PAGE_LIMIT}), reached end`);
        break;
      }

      // Move to next offset
      offset += PAGE_LIMIT;

    } catch (e: any) {
      console.error(`Failed to fetch page ${pageCount} (offset=${offset}):`, e?.code, e?.message);
      throw e;
    }
  }

  console.log(`Completed: ${totalProcessed} total events processed across ${pageCount} pages`);
  return totalProcessed;
}

const getEventStatus = (rawEvent: {
  active?: boolean | null;
  closed?: boolean | null;
  archived?: boolean | null;
}): string => {
  // 直接指定返回string
  const isArchived = Boolean(rawEvent.archived);
  const isClosed = Boolean(rawEvent.closed);
  const isActive = Boolean(rawEvent.active);

  if (isArchived) return "archived";
  if (isClosed) return "resolved";
  if (isActive) return "active";
  return "draft";
};

async function upsertPolymarketEvent(polymarketEvents: any) {
  // Batch collection arrays
  const eventsToUpsert: any[] = [];
  const marketsToUpsert: any[] = [];
  const outcomesToUpsert: any[] = [];
  const tagsToUpsert: any[] = [];

  // Collect all data
  for (const rawEvent of polymarketEvents) {
    // Collect event
    eventsToUpsert.push({
      id: rawEvent.id,
      slug: rawEvent.slug,
      title: rawEvent.title,
      icon_url: rawEvent.icon,
      rules: rawEvent.description,
      status: getEventStatus(rawEvent),
      show_market_icons: rawEvent.showMarketImages,
      enable_neg_risk: rawEvent.enableNegRisk,
      neg_risk_augmented: rawEvent.negRiskAugmented,
      neg_risk: rawEvent.negRisk,
      neg_risk_market_id: rawEvent.negRiskMarketID,
      end_date: rawEvent.endDate,
      created_at: rawEvent.createdAt,
      updated_at: rawEvent.updatedAt,
    });

    // Collect markets and related data
    if (rawEvent.markets && Array.isArray(rawEvent.markets)) {
      for (const rawMarket of rawEvent.markets) {
        marketsToUpsert.push({
          id: rawMarket.id,
          event_id: rawEvent.id,
          condition_id: rawMarket.conditionId,
          title: rawMarket.question,
          slug: rawMarket.slug,
          short_title: null,
          question: rawMarket.question,
          market_rolus: rawMarket.description,
          resolution_source: rawMarket.resolutionSource,
          resolution_source_url: null,
          resolver: null,
          neg_risk: rawMarket.negRisk,
          neg_risk_other: rawMarket.negRiskOther,
          neg_risk_market_id: rawMarket.negRiskMarketID,
          neg_risk_request_id: rawMarket.negRiskRequestID,
          icon_url: rawMarket.icon,
          is_active: rawMarket.active,
          is_closed: rawMarket.closed,
          volume_24h: rawMarket.volume24hr,
          volume: rawMarket.volume,
          start_time: rawMarket.startDate,
          end_time: rawMarket.endDate,
          created_at: rawMarket.createdAt,
          updated_at: rawMarket.updatedAt,
        });

        // Parse and collect outcomes
        let clobTokenIds: string[] = [];
        try {
          clobTokenIds = JSON.parse(rawMarket.clobTokenIds || "[]");
          clobTokenIds = clobTokenIds.filter((id) => typeof id === "string");
        } catch (e) {
          console.warn(
            `市场 ${rawMarket.id} 的 clobTokenIds 解析失败，使用空数组。原始数据:`,
            rawMarket.clobTokenIds,
          );
          clobTokenIds = [];
        }

        let outcomes: string[] = [];
        try {
          outcomes = JSON.parse(rawMarket.outcomes || "[]");
          outcomes = outcomes.filter((outcome) => typeof outcome === "string");
        } catch (e) {
          outcomes = [];
        }

        if (clobTokenIds.length === outcomes.length && clobTokenIds.length > 0) {
          for (let i = 0; i < clobTokenIds.length; i++) {
            outcomesToUpsert.push({
              token_id: clobTokenIds[i],
              condition_id: rawMarket.conditionId,
              outcome_text: outcomes[i],
              outcome_index: null,
              created_at: rawMarket.createdAt,
              updated_at: rawMarket.updatedAt,
            });
          }
        } else {
          console.warn(
            `市场 ${rawMarket.id} 的 clobTokenIds 和 outcomes 数量不匹配，或其中一个为空。clobTokenIds: ${clobTokenIds.length}, outcomes: ${outcomes.length}`,
          );
        }
      }

      // Collect tags
      if (rawEvent.tags && Array.isArray(rawEvent.tags)) {
        for (const tag of rawEvent.tags) {
          tagsToUpsert.push({
            event_id: rawEvent.id,
            tag_id: tag.id,
          });
        }
      }
    }
  }

  // Batch upsert all data
  try {
    if (eventsToUpsert.length > 0) {
      const { error: eventsError } = await supabaseAdmin
        .from("polymarket_events")
        .upsert(eventsToUpsert, {
          onConflict: "id",
        });

      if (eventsError) {
        console.error("Failed to batch upsert events:", eventsError);
      } else {
        console.log(`Successfully upserted ${eventsToUpsert.length} events`);
      }
    }

    if (marketsToUpsert.length > 0) {
      const { error: marketsError } = await supabaseAdmin
        .from("polymarket_markets")
        .upsert(marketsToUpsert, {
          onConflict: "id",
        });

      if (marketsError) {
        console.error("Failed to batch upsert markets:", marketsError);
      } else {
        console.log(`Successfully upserted ${marketsToUpsert.length} markets`);
      }
    }

    if (outcomesToUpsert.length > 0) {
      const { error: outcomesError } = await supabaseAdmin
        .from("polymarket_outcomes")
        .upsert(outcomesToUpsert, {
          onConflict: "token_id",
        });

      if (outcomesError) {
        console.error("Failed to batch upsert outcomes:", outcomesError);
      } else {
        console.log(`Successfully upserted ${outcomesToUpsert.length} outcomes`);
      }
    }

    if (tagsToUpsert.length > 0) {
      const { error: tagsError } = await supabaseAdmin
        .from("polymarket_event_tags")
        .upsert(tagsToUpsert);

      if (tagsError) {
        console.error("Failed to batch upsert tags:", tagsError);
      } else {
        console.log(`Successfully upserted ${tagsToUpsert.length} tags`);
      }
    }
  } catch (error) {
    console.error("Batch upsert operation failed:", error);
    throw error;
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }
  console.log("Starting Polymarket events sync...");

  try {
    // Stream-process events: fetch page by page and upsert immediately
    const totalEvents = await fetchAndProcessPolymarketEvents(
      async (pageEvents: any[]) => {
        // Process this page's events and upsert immediately (no memory accumulation)
        await upsertPolymarketEvent(pageEvents);
      }
    );

    if (totalEvents === 0) {
      return NextResponse.json(
        { error: "Failed to fetch polymarket events or no events found" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { data: "Success", totalEvents },
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to fetch Polymarket events inside GET handler:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}