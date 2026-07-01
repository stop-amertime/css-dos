<script>
  // Generic EDIT-style radio group. options: [{ value, label }].
  // Two-way bound via bind:value; optional onchange(value) callback fires
  // after the binding updates.
  let { name, options, value = $bindable(), inline = true, onchange } = $props();
</script>

<div class="radio-group" class:inline>
  {#each options as opt (opt.value)}
    <label class="radio">
      <input type="radio" {name} value={opt.value} bind:group={value}
             onchange={() => onchange?.(opt.value)} />
      <span class="marker"></span><span>{@html opt.label}</span>
    </label>
  {/each}
</div>
