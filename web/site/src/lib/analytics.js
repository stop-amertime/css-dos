// Custom analytics events, sent to BOTH backends (each initialised in
// main.js): Vercel Web Analytics (simple counters on the hosting
// dashboard) and PostHog (funnels/paths over the same events).
// Pageviews are handled by the two inits; these are the named funnel
// events layered on top (landing, first Next, Why-page fork, file-map
// navigation, FAQ opens, cart picks). Wrapped so a blocked or failed
// beacon can never break navigation. Where the interesting dimension
// is a small fixed set (file-map section, FAQ id, cart id) it's
// encoded in the event NAME - the free Vercel tier can't filter on
// event properties, and shared names keep the two dashboards
// comparable.
import { track as vercelTrack } from '@vercel/analytics';
import posthog from 'posthog-js';

export function track(name) {
  try { vercelTrack(name); } catch { /* ad-blocked or offline - fine */ }
  try { posthog.capture(name); } catch { /* same */ }
}
