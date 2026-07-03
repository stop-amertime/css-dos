<script>
  // Memory: reading it — the 44 MB readMem function and the exhibit.
  // Copy recycled from the retired "Where's the computer?" page;
  // facts from CABINET-ANATOMY.md §10.
  import Foldable from '../Foldable.svelte';
  import FetchLadder from '../FetchLadder.svelte';
</script>

<p>
  Reading sounds like the easy half &mdash; nothing changes, you just
  look at a value. It isn&rsquo;t. Every memory cell is its own
  variable; an address is just a number; and CSS gives no way to get
  from the number to the variable. The very first thing a CPU does
  every tick &mdash; fetch the byte its instruction pointer points at
  &mdash; is already impossible to write directly:
</p>

<FetchLadder />

<Foldable>
  {#snippet summary()}What the million arms actually contain{/snippet}
  <p>Three kinds of arm, depending on the address:</p>
  <ul class="anatomy-list">
    <li>
      <b>RAM</b> &mdash; extract the right byte from its packed
      two-byte cell (the pairs of <code>mod</code> /
      <code>round</code> lines in the exhibit above).
    </li>
    <li>
      <b>BIOS ROM</b> &mdash; read-only, so each byte is baked in as a
      literal constant. Zero bytes are omitted entirely.
    </li>
    <li>
      <b>The disk window</b> &mdash; 512 addresses that read through to
      the disk (see the disk story).
    </li>
  </ul>
  <p>
    And two special addresses are wired straight to the live keyboard
    value, so the BIOS keyboard service reads real keypresses through
    the same function as everything else.
  </p>
</Foldable>
