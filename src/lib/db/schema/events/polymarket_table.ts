import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// Polymarket compatible tables mapped for Drizzle
export const polymarket_events = pgTable('polymarket_events', {
  id: bigint({ mode: 'bigint' }).primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  icon_url: text(),
  rules: text(),
  status: text().notNull(),
  show_market_icons: boolean(),
  enable_neg_risk: boolean(),
  neg_risk_augmented: boolean(),
  neg_risk: boolean(),
  neg_risk_market_id: char({ length: 66 }),
  active_markets_count: integer(),
  total_markets_count: integer(),
  end_date: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const polymarket_markets = pgTable('polymarket_markets', {
  id: bigint({ mode: 'bigint' }).primaryKey(),
  event_id: bigint({ mode: 'bigint' }).notNull().references(() => polymarket_events.id),
  condition_id: text(),
  title: text(),
  slug: text().notNull(),
  short_title: text(),
  question: text(),
  market_rolus: text(),
  resolution_source: text(),
  resolution_source_url: text(),
  resolver: char({ length: 42 }),
  neg_risk: boolean(),
  neg_risk_other: boolean(),
  neg_risk_market_id: char({ length: 66 }),
  neg_risk_request_id: char({ length: 66 }),
  icon_url: text(),
  is_active: boolean(),
  is_closed: boolean(),
  volume_24h: numeric({ precision: 20, scale: 6 }),
  volume: numeric({ precision: 20, scale: 6 }),
  start_time: timestamp({ withTimezone: true }),
  end_time: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const polymarket_outcomes = pgTable('polymarket_outcomes', {
  token_id: text().primaryKey(),
  condition_id: char({ length: 66 }).notNull(),
  outcome_text: text().notNull(),
  outcome_index: smallint(),
  is_winning_outcome: boolean().default(false),
  created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const polymarket_event_tags = pgTable('polymarket_event_tags', {
  event_id: bigint({ mode: 'bigint' }).notNull().references(() => polymarket_events.id),
  tag_id: bigint({ mode: 'bigint' }).notNull(),
})
