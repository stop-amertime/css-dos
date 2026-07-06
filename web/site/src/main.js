import { mount } from 'svelte';
import './styles/global.css';
import App from './App.svelte';

// The service worker (owns /_screen/framebuffer and cached cabinet bytes
// for the player tab) is registered by /shim/calcite-bridge-boot.js, loaded
// from index.html — it also spawns the bridge worker and sets
// window.__calciteBridge.

export default mount(App, { target: document.getElementById('app') });
