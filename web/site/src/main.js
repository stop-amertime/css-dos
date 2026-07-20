import { mount } from 'svelte';
import './styles/global.css';
import App from './App.svelte';
import { inject } from '@vercel/analytics';
import posthog from 'posthog-js';

// The service worker (owns /_screen/framebuffer and cached cabinet bytes
// for the player tab) is registered by /shim/calcite-bridge-boot.js, loaded
// from index.html - it also spawns the bridge worker and sets
// window.__calciteBridge.

// Initialize Vercel Web Analytics
inject();

// PostHog (EU cloud) - funnels/paths over the same named events that
// lib/analytics.js sends to Vercel (it calls posthog.capture too).
// - The phc_ key is a PUBLISHABLE project key, safe in the bundle.
// - persistence 'memory' = cookieless: no banner needed; visitors
//   aren't stitched across visits, but within-session funnels (the
//   only journey this site has) work fully.
// - In prod the API goes through the same-origin /ingest proxy
//   (vercel.json rewrites) so ad-blockers don't eat the events; dev
//   talks to the EU cloud directly (no rewrite layer under Vite).
posthog.init('phc_BQRELKjcgVSHSSdhe9tik2jEUA2D547MtxVMqBuCeZHN', {
  api_host: import.meta.env.DEV ? 'https://eu.i.posthog.com' : location.origin + '/ingest',
  ui_host: 'https://eu.posthog.com',
  defaults: '2025-05-24', // SPA pageviews on history.pushState - how the router navigates
  persistence: 'memory',
});

export default mount(App, { target: document.getElementById('app') });
