<script>
  import '../styles/_fragments/build.css';
  import { nav } from '../lib/router.svelte.js';
  import { build } from '../lib/builder.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';
  import CartGrid from '../components/CartGrid.svelte';
  import CustomPanel from '../components/CustomPanel.svelte';
  import Foldable from '../components/Foldable.svelte';
  import RadioGroup from '../components/RadioGroup.svelte';
  import CheckRow from '../components/CheckRow.svelte';
  import SpecTable from '../components/SpecTable.svelte';
  import BuildProgress from '../components/BuildProgress.svelte';
  import ResultFloppy from '../components/ResultFloppy.svelte';
  import SourceViewer from '../components/SourceViewer.svelte';

  build.loadServerCarts();

  const PRESETS = [
    { value: 'dos-corduroy', label: 'Corduroy + DOS' },
    { value: 'dos-muslin', label: 'Muslin + DOS' },
    { value: 'hack', label: 'hack (.com direct, no BIOS, no DOS)' },
  ];
  const MEMORY = [
    { value: '', label: 'Auto-fit' }, { value: '128K', label: '128K' },
    { value: '256K', label: '256K' }, { value: '512K', label: '512K' },
    { value: '640K', label: '640K (full PC)' },
  ];
  const BOOT_MODES = [
    { value: 'program', label: 'The program' },
    { value: 'shell', label: 'DOS shell (<code>COMMAND.COM</code>)' },
  ];
  const SUBDOTS = [{ label: 'Pick a program' }, { label: 'Configure & build' }, { label: 'Cabinet ready' }];

  let { strip, wizNav } = $props();

  let hint = $derived(
    build.busy ? 'Building…'
    : build.done ? 'Done. Next: choose how to play.'
    : build.hasSource ? 'Ready to build.'
    : 'Pick a program first.'
  );

  // Reveal + jump to the result sub-page when a build finishes.
  $effect(() => { if (build.done) nav.buildSub = 3; });

  const customSelected = $derived(build.selectedId === 'custom');
</script>

{#snippet subhead()}
  <StepDots
    variant="sub"
    items={build.done ? SUBDOTS : SUBDOTS.slice(0, 2)}
    current={nav.buildSub}
    onjump={(n) => (nav.buildSub = n)}
  />
{/snippet}

<Wizard {strip} {subhead} nav={wizNav}>
{#if nav.buildSub === 1}
  <div class="subpage">
    <div class="build-intro">
      <h1>Build the <code>.css</code> file</h1>
      <p>
        CSS can&rsquo;t read files, so the entire computer &mdash; and your
        program &mdash; has to be baked into one stylesheet. This page builds
        that file for you, because:
      </p>
      <ol class="build-why">
        <li>Downloading 300&nbsp;MB of CSS text for every program would be annoying.</li>
        <li>It lets you build a cabinet from your <b>own</b> program.
          <span class="dim small">(Any DOS program should at least run &mdash; but
          no guarantees on compatibility.)</span></li>
      </ol>
    </div>
    <CartGrid />
    {#if customSelected}<CustomPanel />{/if}
  </div>
{:else if nav.buildSub === 2}
  <div class="subpage">
    <div class="machine-row">
      <div class="machine-photo">
        <img src="/assets/IBM-PC.jpg" alt="IBM 5150 PC" />
        <div class="machine-photo-caption">IBM&nbsp;5150 &middot; 1981</div>
      </div>
      <div class="machine-specs">
        <SpecTable />

        <Foldable class="advanced">
          {#snippet summary()}<span class="hot">A</span>dvanced configuration{/snippet}
          <div class="row">
            <label>Preset:</label>
            <RadioGroup name="preset" options={PRESETS} bind:value={build.options.preset} />
          </div>
          {#if build.isDos}
            <div class="row">
              <label>Memory:</label>
              <RadioGroup name="memory" options={MEMORY} bind:value={build.options.memory} />
            </div>
            <div class="row">
              <label>Video:</label>
              <CheckRow bind:checked={build.options.textVga} label="Text (B8000)" />
              <CheckRow bind:checked={build.options.gfx} label="Mode 13h (A0000)" />
              <CheckRow bind:checked={build.options.cgaGfx} label="CGA 0x04 (B8000)" />
            </div>
          {/if}
          <div class="row">
            <CheckRow
              bind:checked={build.options.eagerCompile}
              label="Compile in background after build"
              title="When on, the cabinet starts parsing/compiling in the background as soon as it's built. When off (default), compile is deferred until you open the player."
            />
          </div>
        </Foldable>

        {#if build.isDos}
          <div class="row boot-mode-row">
            <label>Boot into:</label>
            <RadioGroup
              name="boot-mode"
              options={BOOT_MODES}
              value={build.options.bootMode}
              onchange={(m) => build.setBootMode(m)}
            />
          </div>
        {/if}

        <div class="row build-row">
          <button class="btn primary big" disabled={!build.canBuild} onclick={() => build.runBuild()}>
            <span class="hot">B</span>uild cabinet
          </button>
          <span class="dim small">{hint}</span>
        </div>

        {#if build.busy || build.done}<BuildProgress />{/if}
      </div>
    </div>
  </div>
{:else}
  <div class="subpage">
    <ResultFloppy />
    {#if build.cabinetBlob}<SourceViewer blob={build.cabinetBlob} />{/if}
  </div>
{/if}
</Wizard>
