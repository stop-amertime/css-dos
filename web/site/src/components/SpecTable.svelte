<script>
  import { build } from '../lib/builder.svelte.js';
</script>

<table class="spec-table">
  <tbody>
    <tr><th>CPU</th><td>Intel 8088 &middot; 4.77&nbsp;MHz</td></tr>
    <tr><th>Memory</th><td>{build.specMemory}</td></tr>
    <tr><th>Video</th><td>{build.specVideo}</td></tr>
    <tr><th>Firmware + OS</th><td>{build.specPreset}</td></tr>
    <tr><th>Run</th><td class="dim">{build.specRun}</td></tr>
  </tbody>
</table>
