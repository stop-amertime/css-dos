<script>
  // Generic EDIT-style checkbox. Two-way bound via bind:checked.
  let { checked = $bindable(), label, title } = $props();
</script>

<label class="check" {title}>
  <input type="checkbox" bind:checked />
  <span class="marker"></span><span>{@html label}</span>
</label>
