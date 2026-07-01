import { mount } from 'svelte';
import './styles/global.css';
import App from './App.svelte';

// The cabinet-streaming service worker owns /_stream/fb (multipart JPEG →
// player <img>) and serves cached cabinet bytes to the player tab.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export default mount(App, { target: document.getElementById('app') });
