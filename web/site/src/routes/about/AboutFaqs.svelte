<script>
  // FAQs — a stack of Foldables under the opening title.
  import Foldable from '../../components/Foldable.svelte';
  import Term from '../../components/Term.svelte';
</script>

<div class="subpage">
  <h1>FAQs</h1>

  <div class="faq-list">
    <Foldable open={true}>
      {#snippet summary()}Really &mdash; no JavaScript?{/snippet}
      <p>
        Really &mdash; the machine is one CSS file, and a browser can evaluate every line of it; nothing you see comes from JavaScript. What a browser can&rsquo;t do is keep up: 300&nbsp;MB of stylesheet is more than a tab survives, and even a small build runs at a couple of instructions per second. So this site feeds the same file to <b>Calcite</b>, a compiler built for the job &mdash; <a href="#about/calcite">its page</a> explains it, and why it isn&rsquo;t cheating.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}Don&rsquo;t you need an HTML page for this to work?{/snippet}
      <p>
        Yes &mdash; a small, dumb one. A tag that loads the stylesheet, one element for the clock, one for the CPU, and 64,000 empty ones for the pixels. Nothing in it computes anything; it&rsquo;s scaffolding for the CSS to hang off.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}How can there be a clock? Nothing in CSS moves.{/snippet}
      <p>
        One thing in CSS moves by itself: animations. At the very bottom of the file a tiny animation ticks a counter &mdash; 0, 1, 2, 3, forever &mdash; and each lap the machine advances by one instruction. The <a href="#about/file/clock">clock section</a> has the real keyframes, and the trick that lets 368,256 memory cells change at once.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}How does it draw video?{/snippet}
      <p>
        The screen is 64,000 boxes, 320 wide by 200 tall, each with a rule that turns its own byte of video memory into a background colour. The <a href="#about/file/screen">screen section</a> has the rules, the palette, and the faked electron beam.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}How do you control it? CSS can&rsquo;t see a keyboard.{/snippet}
      <p>
        It can&rsquo;t. What it can see is whether an element is currently being pressed &mdash; the <code>:active</code> selector &mdash; so the machine has an on-screen keyboard whose keys are real buttons. The <a href="#about/file/keys">keyboard section</a> shows the actual rules, live.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}What doesn&rsquo;t work in CSS?{/snippet}
      <p>
        <b>Sound</b> &mdash; there&rsquo;s just no way for CSS to make noise. Except&hellip; possibly displaying the sound wave visually? Perhaps that&rsquo;s future work.
      </p>
      <p>
        <b>A physical keyboard, or any other physical input.</b> I think clicking buttons is the only viable input mechanism to mimic a keyboard.
      </p>
      <p>
        <b>Any more complex OS than MS-DOS</b> would be a real pain in the arse, perhaps even impossible. Anything using protected mode, or 286/386 instructions is a significant step up in complexity. There&rsquo;s a solid barrier in the way: V8&rsquo;s string size limit, which carts are already pushing up against. On the other hand, emulating <i>this</i> was already a huge pain in the arse that seems like it might actually be impossible, so never say never.
      </p>
      <p>
        However, <b>Windows 1.0 is surprisingly possible.</b> It is just a GUI layer over DOS 16-bit real-mode; the main barrier is the required mouse support. And more Calcite performance work. Conceptually, we could allow the screen <code>&lt;div&gt;</code> pixels themselves to be hoverable and clickable, feeding that information to position and click the cursor on the screen. But I&rsquo;m releasing this first &mdash; the scope creep would be too egregious.
      </p>
      <p class="dim small">
        A minor note: I like the name CSS-DOS, but lack a catchy name for a CSS Windows. CSSWin and WinCSS are uncomfortably close to Tailwind CSS and Windsurf. I&rsquo;d probably go for Windows.css &mdash; nobody take that name, please.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}Is Doom actually playable?{/snippet}
      <p>
        Barely &mdash; the asterisk on the intro page is honest. Through Calcite it manages a frame or two per second: enough to walk, open doors and shoot, a long way from comfortable.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}Can CSS-DOS run any DOS program?{/snippet}
      <p>
        Yes &mdash; visit the Build page and hand the builder any DOS program (.com/.exe) or folder. Two conditions: it has to fit on a floppy, and it has to stick to 8086 instructions (no Intel 286 or 386 opcodes). The builder bakes it into a <Term t="cabinet">cabinet</Term> for you &mdash; every preset here was made exactly that way. One more limit: the finished file must stay under ~536&nbsp;MB, or you hit V8&rsquo;s string size limit and the file simply won&rsquo;t load in a browser. If that happens, try reducing the machine&rsquo;s RAM.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}How long did this take?{/snippet}
      <p>
        About six months of on-and-off hobbyist work. I have no idea how many AI tokens I used on the project, but it&rsquo;s easily in the hundreds of millions, probably thousands of pounds of API-equivalent usage.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}How did you debug this?{/snippet}
      <p>
        With enormous pain. Many late nights and tears shed. There is nothing quite like a program diverging from the reference emulator by a byte or two half a million ticks into boot, which only became apparent when the system crashed four million ticks into boot, inside a system with no debugger, no logging and no stack traces &mdash; just 368,256 variables recalculating every tick, one of which did so wrongly. Good luck!
      </p>
      <p>
        I ended up building a messy collection of debug tools which were often themselves impractically slow unless used with restraint and finesse. Suffice to say, this project gave me a newfound appreciation for debug tooling. An LLM was useful, but without constant steering it would cheerfully chase individual bytes around for hours. I had to put in rules on what the model could do: all CLI debugger invocations could run for a maximum of two minutes at a time, for example.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}Did you use AI?{/snippet}
      <p>
        Yes, I did. I code in my day job too, and I haven&rsquo;t typed a line of code in earnest in around a year now. Claude &lsquo;wrote&rsquo; 100% of this project&rsquo;s code, except for some minor tweaks and fixes by me.
      </p>
      <p>
        Claude could never have figured the project out on its own, but it was immensely helpful. Claude lacked the intuition to contribute reliably on a conceptual level, although it had its moments &mdash; the writable shadow-disk, and <code>&lt;img&gt;</code> tag hack in Calcite, among others were Claude&rsquo;s idea. However, this project is an unusual one, taking Claude well out of distribution, and it often took a laughably inept path through some implementations. But what it lacked in smarts, it made up for in being able to spew out code to a spec while I did other things.
      </p>
      <p>
        As a long-time tinkerer and coder, I do miss the romantic thrill of cobbling code together by hand, rolling the dice on it, and feeling that pay-off (or letdown). Perhaps this is the mindset of an old fogey, but there&rsquo;s something about creating with your own two hands that&rsquo;s lost when you order a minion to do it for you, no matter how beautiful the end product. The ideas are mostly mine, but I didn&rsquo;t execute them.
      </p>
      <p>
        But. This project wouldn&rsquo;t exist without AI, full stop. I am 100% sure my patience would have run out before the machine booted. I don&rsquo;t know Rust well, and couldn&rsquo;t have coded Calcite myself. Claude made optimisations in it that I don&rsquo;t fully understand. In fact, the day Fable 5 was released, it doubled or tripled Calcite&rsquo;s performance in a single commit. There&rsquo;s something lovely about that, although some part of me wishes I was the one who did it.
      </p>
      <p>
        There&rsquo;s a tension: accessibility / convenience / frictionlessness versus challenge / satisfaction / ownership. A game that offered you a button to immediately skip every level would be pointless. But what about skipping <i>one</i> level? What if the option only appeared after being stuck on it for a while first? What if it cost a bit of money, so you couldn&rsquo;t do it willy nilly? When does that kind of option turn into a net positive?
      </p>
      <p>
        Some part of me often wishes for less choice, to have challenge forced upon me. Dark Souls has no level-skipping. If it did I would have crumbled, sullying the achievement with an asterisk. But a lot of people have completed Dark Souls, and nobody has <i>ever</i> run a full OS in CSS. It would have been tempting to declare this project impossible and quit. Doing five out of six levels and seeing the end is arguably better than giving up.
      </p>
      <p>
        Shunning LLMs feels like throwing the baby out with the bathwater. Maybe I&rsquo;m spoiled, but considering brainlessly editing the CSS of this website myself has started to feel menial in an old-timey way, like washing clothes by hand or emptying the chamber pot. Maybe because I&rsquo;ve had a taste of AI coding, or maybe I&rsquo;ve had a taste of the depraved stuff and ordinary CSS doesn&rsquo;t turn me on any more. Either way, I do want to automate centering divs and fiddling with line heights. That part is just an obstruction, a waste of time. Can someone make an AI model, that either teaches you new skills or automates things you can already do, rather than doing things entirely for you? I&rsquo;d subscribe to that.
      </p>
      <p>
        Until then, I hope for the restraint to use tools to reach higher places, not to avoid getting off my arse at all.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}Can I contribute/donate?{/snippet}
      <p>
        <b>Code</b>: both projects (CSS-DOS and Calcite) are open-source, and I&rsquo;d welcome code contributions. Huge performance gains are on the table for Calcite, which is currently written in a sub-optimal way and needs a ground-up refactor. Not for the faint of heart. Interested contributors could also fix bugs that prevent other DOS games&rsquo; compatibility &mdash; many programs still crash, hang or run too slowly to be playable.
      </p>
      <p>
        <b>Cash</b>: I earn enough from my day job &mdash; if you like this work, please direct any cash you can spare to <a href="https://adhduk.co.uk/donate-to-adhd-uk/" class="ext-link" target="_blank" rel="noopener">ADHD UK</a> instead of to me.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}I have a question that isn&rsquo;t answered here.{/snippet}
      <p>
        Email me &mdash; <b>ahmed.elhadi.amer&nbsp;[at]&nbsp;gmail&nbsp;(dot)&nbsp;com</b>. I&rsquo;d love to hear from interested people.
      </p>
    </Foldable>

    <Foldable>
      {#snippet summary()}Can I get in touch with you for press/videos/podcasts/etc.?{/snippet}
      <p>
        Email me &mdash; <b>ahmed.elhadi.amer&nbsp;[at]&nbsp;gmail&nbsp;(dot)&nbsp;com</b>. I&rsquo;d be happy to contribute to press, YouTube videos, and whatever else.
      </p>
    </Foldable>
  </div>
</div>

<style>
  .subpage {
    max-width: 680px;
    margin-inline: auto;
  }
  /* Foldable's own 16px stack margin is the spacing here — the old
     fragment's 10px override was losing the cascade and never rendered. */
  .faq-list { margin-top: 20px; max-width: 660px; }
</style>
