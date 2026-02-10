import { relations } from 'drizzle-orm'
import {
  polymarket_events,
  polymarket_markets,
  polymarket_outcomes,
  polymarket_event_tags,
} from './polymarket_table'

export const polymarketEventsRelations = relations(polymarket_events, ({ many }) => ({
  polymarket_markets: many(polymarket_markets),
  polymarket_event_tags: many(polymarket_event_tags),
}))

export const polymarketMarketsRelations = relations(polymarket_markets, ({ one }) => ({
  polymarket_event: one(polymarket_events, {
    fields: [polymarket_markets.event_id],
    references: [polymarket_events.id],
  }),
}))

export const polymarketOutcomesRelations = relations(polymarket_outcomes, ({}) => ({}))

export const polymarketEventTagsRelations = relations(polymarket_event_tags, ({ one }) => ({
  event: one(polymarket_events, {
    fields: [polymarket_event_tags.event_id],
    references: [polymarket_events.id],
  }),
}))
