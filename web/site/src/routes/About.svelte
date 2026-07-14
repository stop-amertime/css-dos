<script>
  // About - the wizard's first step. A thin shell: the sub-page dots
  // plus one component per sub-page (routes/about/). All copy and
  // page-specific styling lives in those components.
  import { nav } from '../lib/router.svelte.js';
  import StepDots from '../components/StepDots.svelte';
  import Wizard from '../components/Wizard.svelte';
  import AboutHome from './about/AboutHome.svelte';
  import AboutWhy from './about/AboutWhy.svelte';
  import AboutHow from './about/AboutHow.svelte';
  import AboutFileMap from './about/AboutFileMap.svelte';
  import AboutCalcite from './about/AboutCalcite.svelte';
  import AboutFaqs from './about/AboutFaqs.svelte';
  import AboutCredits from './about/AboutCredits.svelte';

  let { strip, wizNav } = $props();

  // Order matches router.svelte.js ABOUT_SUBS (nav.sub is 1-based).
  const SUBPAGES = [
    { label: 'Home', page: AboutHome },
    { label: 'Why?', page: AboutWhy },
    { label: 'How?', page: AboutHow },
    { label: 'File Map', page: AboutFileMap },
    { label: 'Calcite', page: AboutCalcite },
    { label: 'FAQs', page: AboutFaqs },
    { label: 'Credits', page: AboutCredits },
  ];
  const Page = $derived(SUBPAGES[nav.sub - 1].page);
</script>

{#snippet subhead()}
  <StepDots variant="sub" items={SUBPAGES} current={nav.sub} onjump={(n) => (nav.sub = n)} />
{/snippet}

<Wizard {strip} {subhead} nav={wizNav}>
  <section class="step learn-step" data-step="1">
    <Page />
  </section>
</Wizard>
