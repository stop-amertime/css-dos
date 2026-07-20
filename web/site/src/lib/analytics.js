// Custom Vercel Web Analytics events. Pageviews are handled by the
// inject() call in main.js; these are the named funnel events layered
// on top (landing, first Next, Why-page fork, file-map navigation, FAQ
// opens, cart picks). Wrapped so a blocked or failed beacon can never
// break navigation. Where the interesting dimension is a small fixed
// set (file-map section, FAQ id, cart id) it's encoded in the event
// NAME - the free Vercel tier can't filter on event properties.
import { track as vercelTrack } from '@vercel/analytics';

export function track(name) {
  try { vercelTrack(name); } catch { /* ad-blocked or offline - fine */ }
}
