<script>
  // FAQs - a stack of Foldables under the opening title. Each Foldable
  // carries a stable `id` so it's a deep-link target: '/about/faqs/<id>'
  // opens that fold and scrolls to it (see nav.faqAnchor in
  // router.svelte.js) - e.g. <a href="/about/faqs/ai">the AI FAQ</a>.
  import Foldable from '../../components/Foldable.svelte';
  import Term from '../../components/Term.svelte';
  import { nav } from '../../lib/router.svelte.js';

  $effect(() => {
    const id = nav.faqAnchor;
    if (!id) return;
    const el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    nav.faqAnchor = null; // one-shot - don't re-fire on the next render
  });
</script>

<div class="subpage">
  <h1>FAQs</h1>

  <div class="faq-list">
    <Foldable id="js" open={true}>
      {#snippet summary()}Really - no JavaScript?{/snippet}
      <p>
        Really - the machine is one CSS file, and a browser can evaluate every line of it; nothing you see comes from JavaScript. What a browser can&rsquo;t do is keep up: 300&nbsp;MB of stylesheet is more than a tab survives, and even a small build runs at a couple of instructions per second. So this site feeds the same file to <b>Calcite</b>, a compiler built for the job - <a href="/about/calcite">its page</a> explains it, and why it isn&rsquo;t cheating.
      </p>
    </Foldable>

    <Foldable id="html-page">
      {#snippet summary()}Don&rsquo;t you need an HTML page for this to work?{/snippet}
      <p>
        Yes - a small, dumb one. A tag that loads the stylesheet, one element for the clock, one for the CPU, and 64,000 empty ones for the pixels. Nothing in it computes anything; it&rsquo;s scaffolding for the CSS to hang off.
      </p>
    </Foldable>

    <Foldable id="video">
      {#snippet summary()}How does it draw video?{/snippet}
      <p>
        In theory, the screen is 64,000 boxes, 320 wide by 200 tall, each with a rule that turns its own byte of video memory into a background colour. The <a href="/about/file/screen">screen section</a> has the rules, the palette, and the faked electron beam. In practise, <a href="/about/calcite">Calcite</a> streams the image into the page instead. 
      </p>
    </Foldable>

    <Foldable id="input">
      {#snippet summary()}How do you control it? CSS can&rsquo;t see a keyboard/mouse.{/snippet}
      <p>
        It can&rsquo;t. What it can see is whether an element is currently being pressed - the <code>:active</code> selector - so the machine has an on-screen keyboard whose keys are real buttons. The <a href="/about/file/keys">keyboard section</a> shows the actual rules, live. The mouse plays the same trick in reverse: every screen pixel is itself clickable, and a click feeds an emulated serial mouse with the cursor&rsquo;s position.
      </p>
    </Foldable>

    <Foldable id="doesnt-work">
      {#snippet summary()}What doesn&rsquo;t work in CSS?{/snippet}
      <p>
        <b>Sound</b> - there&rsquo;s just no way for CSS to make noise. Except&hellip; possibly displaying the sound wave visually? Perhaps that&rsquo;s future work.
      </p>
      <p>
        <b>A physical keyboard, or any other physical input.</b> I think clicking buttons is the only viable input mechanism to mimic a keyboard.
      </p>
      <p>
        <b>Any more complex OS than Windows 1.01</b> would be a real pain in the arse, perhaps even impossible. Anything using protected mode, or 286/386 instructions is a significant step up in complexity. There&rsquo;s a solid barrier in the way: V8&rsquo;s string size limit, which carts are already pushing up against. On the other hand, emulating <i>this</i> was already a huge pain in the arse that seems like it might actually be impossible, so never say never.
      </p>
      <p class="dim small">
        A minor note: I like the name CSS-DOS, but lack a catchy name for a CSS Windows. CSSWin and WinCSS are uncomfortably close to Tailwind CSS and Windsurf. I&rsquo;d probably go for Windows.css - nobody take that name, please.
      </p>
    </Foldable>

    <Foldable id="any-program">
      {#snippet summary()}Can CSS-DOS run any DOS program?{/snippet}
      <p>
        Yes - visit the Build page and hand the builder any DOS program (.com/.exe) or folder. Two conditions: it has to fit on a floppy, and it has to stick to 8086 instructions (no Intel 286 or 386 opcodes). The builder bakes it into a <Term t="cabinet">cabinet</Term> for you - every preset here was made exactly that way. One more limit: the finished file must stay under ~536&nbsp;MB, or you hit V8&rsquo;s string size limit and the file simply won&rsquo;t load in a browser. If that happens, try reducing the machine&rsquo;s RAM.
      </p>
    </Foldable>

    <Foldable id="how-long">
      {#snippet summary()}How long did this take?{/snippet}
      <p>
        About six months of hobbyist work - a lot of evenings and weekends and probably thousands of pounds of API-equivalent LLM usage. Worth it? Hopefully - if you enjoyed it, drop me a line at hello [at sign] ahmedamer.co.uk. 
      </p>
    </Foldable>

    <Foldable id="debug">
      {#snippet summary()}How did you debug this?{/snippet}
      <p>
        With enormous pain. Many late nights and tears shed. There is nothing quite like a program diverging from the reference emulator by a byte or two half a million ticks into boot, which only became apparent when the system crashed four million ticks into boot, inside a system with no debugger, no logging and no stack traces - just 368,256 variables recalculating every tick, one of which did so wrongly. Good luck!
      </p>
      <p>
        I ended up building a messy collection of debug tools which were often themselves impractically slow unless used with restraint and finesse. Suffice to say, this project gave me a newfound appreciation for debug tooling. An LLM was useful, but without constant steering it would cheerfully chase individual bytes around for hours. I had to put in rules on what the model could do: all CLI debugger invocations could run for a maximum of two minutes at a time, for example.
      </p>
    </Foldable>

    <Foldable id="ai">
      {#snippet summary()}Did you use AI?{/snippet}
      <p>Yes, a lot. I still consider the code to be <i>my code</i> - but my opinions on the matter are complex. I'm no ambassador for AI accelerationism - as a published AI safety researcher and red-teamer, I'm well aware that LLMs aren't a tool to point at a problem and press 'Go' unthinkingly. I'd label CSS-DOS 'LLM-assisted' but not 'vibe coded'.</p>

      <p>NOTE: AI <i>writing</i> I find cringe-inducing and bland. I'm typing this myself. The copy on this website is edited by my fingers word-by-word, with proofreading by Claude.</p>
      <p>
      <b>I want to briefly validate the LLM haters.</b> I think the availability of LLMs cheapens the act of writing code, opening the door to 'slop'. I <i>hate</i> slop. Thoughtless and generic 'content' produced without craft is a blight. The Luddites had a point. However, I think indiscriminately hating on all LLM use is throwing the baby out with the bathwater. I wish the internet would unite against 'slop' itself and cherish craftsmanship. Automatically tarring <i>all</i> LLM use with the same brush only alienates those with nuanced opinions and real use cases. We should judge <i>the work itself</i>.
      </p>
      <p>I don't feel AI replaces my own creativity when used in the following ways: A) to churn out mechanical work I could otherwise do, and B) to aid with menial tasks like writing docs and comments, organising commits and refactoring. Prior to AI, these tasks often fell by the wayside due to my ADHD and projects suffered. Claude is able to spew out menial code like a slightly dim intern with the speed of The Flash. I'm the opposite - an intuitive and eccentric thinker, but by no means meticulous. So, it makes the entire process more enjoyable by letting me focus on the part I enjoy - the ideas. I also prefer writing scripts on a laptop versus pen and paper.</p>

      <p>This silly project would be nowhere without human intuition and craft. Claude lacked the imagination/talent to contribute reliably on a conceptual level, although a few ideas (the writable shadow-disk, and <code>&lt;img&gt;</code> tag Calcite hack, among others) were Claude&rsquo;s, it failed much more than it succeeded. Claude often took a laughably inept path through implementations, needing firm shepherding.
      </p>
      <p>
      I do worry about educating future generations on that craft, but I don't think prejudice and sweeping dismissal and negativity achieve that. They just communicate aloofness and elitism. The Luddites were great craftspeople, but history tells us that smashing the mills didn't end up teaching the next generation to make beautiful clothes.
      </p>
      <p>
      <b>As a long-time tinkerer, I do miss the romantic thrill of cobbling code together</b>, rolling the dice on it, and feeling the pay-off (or letdown). There&rsquo;s something about creating with your own two hands that&rsquo;s lost when you order a minion to do it for you, no matter how beautiful the end product.
      </p>
      <p>
      But I think this project wouldn&rsquo;t exist without AI. I'm quite convinced the mess and debt would have snowballed, and my patience would have run out, before DOS booted.
      </p>
      <p>
      <b>There is a line where my AI use goes from 'helpful' to 'guilt-inducing', and I'm still finding it.</b> I don&rsquo;t know Rust super well, and couldn&rsquo;t have coded Calcite alone. Claude made Calcite optimisations I don&rsquo;t fully understand. In fact, Fable 5 sauntered in and doubled Calcite&rsquo;s performance in a single commit. There&rsquo;s something lovely about that, though some part of me wishes I was the one who did it.
      </p>
      <p>
      If a game had a button to immediately skip to the end, playing would be pointless. But what about skipping <i>one</i> level? What if you had to be stuck for a bit, or it cost money, so you couldn&rsquo;t do it willy nilly? When does that kind of option become a net positive? Some part of me wishes for less choice, to have challenge forced upon me. Dark Souls has no level-skipping - it'd cheapen it. But a lot of people have completed Dark Souls, and nobody has <i>ever</i> run a full OS in CSS. In this case, getting to the end with a little help is arguably better than giving up before crossing the finish line.
      </p>
      <p>
      <b>Can someone make an AI that only A) teaches you, or B) automates menial tasks you can already do? I'd subscribe.</b> Editing website CSS manually has started to feel menial and old-timey, like hand-washing clothes. Maybe I&rsquo;ve had a taste of LLM coding, or maybe I&rsquo;ve had a taste of the depraved stuff and ordinary CSS doesn&rsquo;t turn me on any more. Either way, I want to automate centering divs and fiddling with line heights: it's not 'creative', it's an unnecessary obstruction.
      </p>
      <p>
      <b>In summary, I hope to be disciplined enough to use tools to reach higher places, not to avoid getting off my arse at all.</b>
      </p>
    </Foldable>

    <Foldable id="contact">
      {#snippet summary()}I have a question that isn&rsquo;t answered here.{/snippet}
      <p>
        Email me - <b>hello [at] ahmedamer (dot) co.uk</b>. I&rsquo;d love to hear from interested people.
      </p>
    </Foldable>

    <Foldable id="press">
      {#snippet summary()}Can I get in touch with you for press/videos/podcasts/etc.?{/snippet}
      <p>
        Email me - <b>hello [at] ahmedamer (dot) co.uk</b>. I&rsquo;d be happy to contribute to press, YouTube videos, and whatever else.
      </p>
    </Foldable>
    
    <Foldable id="contribute">
      {#snippet summary()}Can I contribute/donate?{/snippet}
      <p>
        <b>Code</b>: both projects (CSS-DOS and Calcite) are open-source, and I&rsquo;d welcome code contributions. Huge performance gains are on the table for Calcite, which is currently written in a sub-optimal way and needs a ground-up refactor. Not for the faint of heart. Interested contributors could also fix bugs that prevent other DOS games&rsquo; compatibility - many programs still crash, hang or run too slowly to be playable.
      </p>
      <p>
        <b>Cash</b>: I earn enough from my day job - if you like this work, please direct any cash you can spare to <a href="https://adhduk.co.uk/donate-to-adhd-uk/" class="ext-link" target="_blank" rel="noopener">ADHD UK</a> instead of to me.
      </p>
    </Foldable>

  </div>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }
  /* Foldable's own 16px stack margin is the spacing here - the old
     fragment's 10px override was losing the cascade and never rendered. */
  .faq-list { margin-top: 20px; max-width: 660px; }
</style>
