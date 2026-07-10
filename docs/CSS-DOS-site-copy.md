# CSS-DOS Site Copy

- Pastebin
    
    
    - COPY: FAQS
        - did you use AI?
            - Yes! Claude was very helpful. It definitely wouldn't have been able to figure all this out on its own but it was super useful to remove a lot of drudgery from the process. It also made some perf optimisations in Calcite that I don't understand. Overall this project may not have been finished before my patience ran out if I had to code it manually.
            - I wrote a lot of hacky BS code before AI came along. (perhaps link my code golf account?) but I'm no coding god.
            - fun fact: I actually didn't know rust at all before this project so Claude was hugely helpful in that regard.
        - How did you debug this?
            - With enormous pain. Many tears were shed… I had to create a lot of debug tools myself. This project truly made me appreciate debug tooling. There's nothing like a program crashing, and having absolutely zero clue or insight into what in the very opaque system was breaking. Even Claude was a bit useless in this regard, as it would end up chasing the bytes around trying to look for a fix. I had to create a variety of tools.
        - How long did this take?
            - about 6mos of on-and-off hobbyist work.
        - …Why?
            - (why should be an FAQ question?)
        - please email me with any questions, I'd love to hear more from interested people. (*ahmed*.*elhadi*.*amer* and then *@gmail.com)*
        - 
        - Did you use AI?
            - yes and I have things to say about it
            - it banged out so much code that would have taken years
            - but sometimes felt like ‘press button to finish game’
            - beware of it in creative projects
        
    - change the top bar to include contact?
    
    ## HOW IS THIS POSSIBLE
    
    - CSS is **Turing**-**complete** (dotted explanation), which in computer terms is like saying ‘anywhere is walking distance if you have the time’
    - Nevertheless, this is only possible due to two tools recently added to CSS: if() statements and reusable @functions.
    - The entire house of cards is built from those basic blocks
    - [table] CSS variables with if() statements, calc
    - These will solve any problem eventually through sheer brute force if we hit the problem enough times.
    - This leads to some of the filthiest, most repetitive, circuitous and unintelligible code ever written in earnest. (colour this)
    - The waste is enormous - the final file is an astonishing 300mb of text.
    
    ## Calcite section in ‘how it works’
    
    instead of spamming up the player
    
     the player can say ‘running using calcite” with a link to attempt to load the raw html page
    
     (this is here for completeness but WILL crash your browser if you attempt to open it) 
    
    OPTION 2: show a popup once that explains Calcite? or a step in the flow once that explains it. 
    
    that'll be good to work ou
    
    1. In the explainer, an explanation of the ‘shim’ - the page is innocent (no html/js) 
    Calcite **intercepts through HTTP, runs a SW in your browser, quickly translates it
    This is the closest thing to how V8 works. 
    (except if i had a chrome extension, but i dont want to make people download that due to the friction) this** 
    *I wish I could insert calcite into chrome, buuuut I can’t.* 
    
    ## how it works section
    
    include more real code and good ways to explain the code
    
    ## CPU section
    
    On ‘how is this possible’ page: 
    
    - However, it wont actually RUN. It would bring Chrome to its knees. For that, we need Calcite. OR: that will be discussed later.
    - Do we need a specific Calcite page?
    

# CSS-DOS — About section copy

Extracted 2026-07-08 from the rendered site.
Edit freely, but keep the `## …` / `### …` section headers and the
`source:` lines intact so edits can be mapped back to the right file.
Code fences are verbatim exhibits — usually not copy to edit.

---

## PAGE: Home (hero)

source: web/site/src/routes/About.svelte (sub 1)

![CSS-DOS]

# An entire ‘80s PC in a stylesheet.

An IBM PC compatible — 8086 processor, 640 KB RAM, floppy drive, keyboard, VGA screen, and various less-memorable support chips — in one `.css` file. 

That file is a morbidly obese **300+ MB** of spec-compliant CSS, albeit abused beyond recognition - perhaps some of the most circuitous and painfully inefficient code ever written in earnest. 

It boots MS-DOS (Microsoft’s operating system before Windows) and runs unmodified ‘80s software.

Yes, it runs **Doom*** 

The first time real programs have run in CSS!*

*barely.

[★ View the source on GitHub](https://github.com/stop-amertime/css-dos)

---

## PAGE: Why?

source: web/site/src/routes/About.svelte (sub 2)

# Why?

> “Because it’s there”
> *— George Mallory, when asked why he climbed Everest.*

Cave paintings started when some spare blood was misused to represent a deer. Fifty thousand years later, someone beat *Dark Souls* using the bongo drums controller from Gamecube rhythm game *Donkey Konga*.

**I’m under no illusion: this project was excruciating to create and serves no practical benefit whatsoever.** “Dugg, why are you wasting perfectly good blood on the cave walls, you mad idiot? We’ll have none left for all the rituals that need doing!” Dugg didn’t have an answer for ‘why?’. The rituals have been lost to time, but the deer is now encased in glass. I don’t think anyone’s even bothered asking the *Dark Souls* bongo drums guy why he did it. I also don’t have a good answer to the question, only one as vague and meaningless as Mallory’s: because it *wasn’t* there.

---

## PAGE: How is this possible?

source: web/site/src/routes/About.svelte (sub 3)

# How is this possible?

CSS is designed to style elements on websites (e.g. making a box a specific size and colour) and was never designed to compute anything. 

Basic tools have trickled into CSS as websites have become more complex: 

[Demonstrations of CSS - these should go back to how they were, as tabbed switchable demonstrations, but: bullet points are in a dotted timeline connected by a vertical line, with a year and they are clickable to see a demo of that particular feature, wrapping on mobile]

- 1996 - Set a property (e.g. make a box blue)
- 2011 - Simple calculations with calc()
- 2014 - Variables, as var(--x) only
- 2022 - Remainders and rounding
- 2025 - Ask yes/no questions with if()
- 2025 - Re-use a block of code with @function

[note: years = first shipped in any browser — calc() IE9 2011; custom properties Firefox 2014 (Chrome 2016); mod()/round() Safari 2022 (Chrome only 2024); if() Chrome 137, May 2025; @function Chrome 139, Aug 2025 — worth one final double-check before ship]

Those last two, arriving within months of each other in 2025, made this entire project possible. And yet, it is still a pitifully small set of tools for such a large job. 

We smack every problem with those tools until it’s fixed. Some problems would be solved in one hit with a very slightly better tool for the job. Instead, they are brute forced with millions of hits from a tool we do have. Each whack is a line of code — 5.9 million lines later, the file ends up an appalling 300+ MB of text:

EARTHMOON~60%

Take one step for every character in the file — letter, digit, etc. — and you’d walk **about 60% of the way to the Moon** (some 230,000 km).

[Callout] How the entire .css file works is covered in detail via a full file map on the next page - this page attempts to just provide an accessible intuition on the basics.

So, let’s say we want to run DOOM in CSS. What is stopping us? After all, CSS is a programming language, and DOOM is a program, right? Well, let’s take it one problem at a time:

## Problem 1: CSS can’t do lists of instructions

CSS declares properties once and forever- size, font, colour - with no step-by-step workflows. A huge pain in the arse for programs, which are lists of instructions by definition. 
CSS is conceptually more like a spreadsheet (bear with me) - each cell/property can have a formula which works out its value, and they can even reference each other, but you can’t write a *program* because there is no order to any of it - it just exists, recalculating in response to input, but not having a direction of travel of its own. 

**The solution is the philosophical cornerstone of this project: instead of running programs, reconstruct an *entire computer - CPU, RAM, PIT, PIC, etc.*** and then run the programs on *that* simulated computer.

This sounds a bizarre detour, but: a CPU is a fixed circuit whose outputs are always a function of its inputs. Always in force, like a spreadsheet, or like CSS. Programs are a terrible fit for CSS, but circuits are a surprisingly natural one. The dream is: if we can just emulate all the components of a PC 1:1, code should just… run on it. 

[CALLOUT] Recreating an entire computer is *technically possible* since CSS is Turing complete <dotted definition here>. This is like saying ‘anywhere is walking distance, if you have the time’. 

And so, we embark on a rollercoaster journey: mimicking the processor hardware and all its foibles 1:1, reinventing logical operations like AND, OR and NOT in CSS, re-creating the RAM, the clock, the PIT (timer) and PIC (interrupt controller), hacking in a screen, and so on and so forth. We might genuinely hit *another* problem we can’t solve along the way - the only way to really tell in advance is to try to do it. 

*FUN FACT: The earliest experiments in CSS computation had no way to make time pass — the user had to repeatedly press keys or hold the mouse down to advance the machine one cycle at a time, until a trick was found: using CSS animations and @keyframes to drive a clock instead.* 

### Just a taste: the AND function

Lets sink our teeth into one of the simplest helper functions - AND - in CSS. AND combines two numbers bit by bit: the result has a 1 only where *both* numbers have a 1. Every other language on earth does it with one built-in operator: `a & b`. CSS has no bitwise operators at all — so we rebuild Boolean logic out of arithmetic. On single bits, AND is just multiplication (1×1 is 1, everything else is 0), OR is min(1, a+b), and NOT is 1−a. The same job transistors do with voltage, done with calc() — the ‘reinventing logic gates’ promised above, made literal.

That trick only works one bit at a time, though. So to AND two 16-bit numbers, the function must first shred both into their sixteen separate bits — sixteen divide-and-round-down extractions each — multiply the pairs, then reassemble the answers into a number. Thirty-odd lines of long division to do what `&` does anywhere else. This is all real spec-compliant CSS from the cabinet.

Bear in mind: **this isn’t a CPU instruction - it’s just one helper @*function.*** The actual AND X,Y *instruction* is implemented across many CPU registers, which each individually compute what happens to them if and when the current CPU instruction is ‘AND X,Y’. But let’s not worry about that yet - it’s tackled in the next ‘problem’ section. 

- [EXPANDABLE] The full AND machinery - get ready to scroll… (the verbatim exhibit at the end of this page)

```css
/* CSS-DOS: the AND operation, plus auxiliary @functions.
   Extracted verbatim from the Kiln emitters (kiln/css-lib.mjs, kiln/patterns/flags.mjs).
   Dependency tree:
     --andFlags16/--andFlags8  (full FLAGS word after AND/TEST)
       -> --and      (16-bit bitwise AND, self-contained)
       -> --parity   (PF, 256-entry even-parity table over the low byte)
            -> --lowerBytes
       -> --bit      (single-bit extract, for SF)
            -> --rightShift
     --and8 = --and truncated to 8 bits via --lowerBytes */

/* ===== core helpers ===== */
@function --lowerBytes(--a <integer>, --b <integer>) returns <integer> {
  result: mod(var(--a), pow(2, var(--b)));
}

@function --rightShift(--a <integer>, --b <integer>) returns <integer> {
  result: round(down, var(--a) / pow(2, var(--b)));
}

@function --bit(--val <integer>, --idx <integer>) returns <integer> {
  result: mod(--rightShift(var(--val), var(--idx)), 2);
}

/* ===== the AND itself ===== */
@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);
  --a2: mod(round(down, var(--a) / 2), 2);
  --a3: mod(round(down, var(--a) / 4), 2);
  --a4: mod(round(down, var(--a) / 8), 2);
  --a5: mod(round(down, var(--a) / 16), 2);
  --a6: mod(round(down, var(--a) / 32), 2);
  --a7: mod(round(down, var(--a) / 64), 2);
  --a8: mod(round(down, var(--a) / 128), 2);
  --a9: mod(round(down, var(--a) / 256), 2);
  --a10: mod(round(down, var(--a) / 512), 2);
  --a11: mod(round(down, var(--a) / 1024), 2);
  --a12: mod(round(down, var(--a) / 2048), 2);
  --a13: mod(round(down, var(--a) / 4096), 2);
  --a14: mod(round(down, var(--a) / 8192), 2);
  --a15: mod(round(down, var(--a) / 16384), 2);
  --a16: mod(round(down, var(--a) / 32768), 2);
  --b1: mod(var(--b), 2);
  --b2: mod(round(down, var(--b) / 2), 2);
  --b3: mod(round(down, var(--b) / 4), 2);
  --b4: mod(round(down, var(--b) / 8), 2);
  --b5: mod(round(down, var(--b) / 16), 2);
  --b6: mod(round(down, var(--b) / 32), 2);
  --b7: mod(round(down, var(--b) / 64), 2);
  --b8: mod(round(down, var(--b) / 128), 2);
  --b9: mod(round(down, var(--b) / 256), 2);
  --b10: mod(round(down, var(--b) / 512), 2);
  --b11: mod(round(down, var(--b) / 1024), 2);
  --b12: mod(round(down, var(--b) / 2048), 2);
  --b13: mod(round(down, var(--b) / 4096), 2);
  --b14: mod(round(down, var(--b) / 8192), 2);
  --b15: mod(round(down, var(--b) / 16384), 2);
  --b16: mod(round(down, var(--b) / 32768), 2);
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * 2 +
    calc(var(--a3) * var(--b3)) * 4 +
    calc(var(--a4) * var(--b4)) * 8 +
    calc(var(--a5) * var(--b5)) * 16 +
    calc(var(--a6) * var(--b6)) * 32 +
    calc(var(--a7) * var(--b7)) * 64 +
    calc(var(--a8) * var(--b8)) * 128 +
    calc(var(--a9) * var(--b9)) * 256 +
    calc(var(--a10) * var(--b10)) * 512 +
    calc(var(--a11) * var(--b11)) * 1024 +
    calc(var(--a12) * var(--b12)) * 2048 +
    calc(var(--a13) * var(--b13)) * 4096 +
    calc(var(--a14) * var(--b14)) * 8192 +
    calc(var(--a15) * var(--b15)) * 16384 +
    calc(var(--a16) * var(--b16)) * 32768
  );
}

@function --and8(--a <integer>, --b <integer>) returns <integer> {
  --full: --and(var(--a), var(--b));
  result: --lowerBytes(var(--full), 8);
}

/* ===== flag computation ===== */
@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
    style(--low8: 0): 4;
    style(--low8: 1): 0;
    style(--low8: 2): 0;
    style(--low8: 3): 4;
    style(--low8: 4): 0;
    style(--low8: 5): 4;
    style(--low8: 6): 4;
    style(--low8: 7): 0;
    style(--low8: 8): 0;
    style(--low8: 9): 4;
    style(--low8: 10): 4;
    style(--low8: 11): 0;
    style(--low8: 12): 4;
    style(--low8: 13): 0;
    style(--low8: 14): 0;
    style(--low8: 15): 4;
    style(--low8: 16): 0;
    style(--low8: 17): 4;
    style(--low8: 18): 4;
    style(--low8: 19): 0;
    style(--low8: 20): 4;
    style(--low8: 21): 0;
    style(--low8: 22): 0;
    style(--low8: 23): 4;
    style(--low8: 24): 4;
    style(--low8: 25): 0;
    style(--low8: 26): 0;
    style(--low8: 27): 4;
    style(--low8: 28): 0;
    style(--low8: 29): 4;
    style(--low8: 30): 4;
    style(--low8: 31): 0;
    style(--low8: 32): 0;
    style(--low8: 33): 4;
    style(--low8: 34): 4;
    style(--low8: 35): 0;
    style(--low8: 36): 4;
    style(--low8: 37): 0;
    style(--low8: 38): 0;
    style(--low8: 39): 4;
    style(--low8: 40): 4;
    style(--low8: 41): 0;
    style(--low8: 42): 0;
    style(--low8: 43): 4;
    style(--low8: 44): 0;
    style(--low8: 45): 4;
    style(--low8: 46): 4;
    style(--low8: 47): 0;
    style(--low8: 48): 4;
    style(--low8: 49): 0;
    style(--low8: 50): 0;
    style(--low8: 51): 4;
    style(--low8: 52): 0;
    style(--low8: 53): 4;
    style(--low8: 54): 4;
    style(--low8: 55): 0;
    style(--low8: 56): 0;
    style(--low8: 57): 4;
    style(--low8: 58): 4;
    style(--low8: 59): 0;
    style(--low8: 60): 4;
    style(--low8: 61): 0;
    style(--low8: 62): 0;
    style(--low8: 63): 4;
    style(--low8: 64): 0;
    style(--low8: 65): 4;
    style(--low8: 66): 4;
    style(--low8: 67): 0;
    style(--low8: 68): 4;
    style(--low8: 69): 0;
    style(--low8: 70): 0;
    style(--low8: 71): 4;
    style(--low8: 72): 4;
    style(--low8: 73): 0;
    style(--low8: 74): 0;
    style(--low8: 75): 4;
    style(--low8: 76): 0;
    style(--low8: 77): 4;
    style(--low8: 78): 4;
    style(--low8: 79): 0;
    style(--low8: 80): 4;
    style(--low8: 81): 0;
    style(--low8: 82): 0;
    style(--low8: 83): 4;
    style(--low8: 84): 0;
    style(--low8: 85): 4;
    style(--low8: 86): 4;
    style(--low8: 87): 0;
    style(--low8: 88): 0;
    style(--low8: 89): 4;
    style(--low8: 90): 4;
    style(--low8: 91): 0;
    style(--low8: 92): 4;
    style(--low8: 93): 0;
    style(--low8: 94): 0;
    style(--low8: 95): 4;
    style(--low8: 96): 4;
    style(--low8: 97): 0;
    style(--low8: 98): 0;
    style(--low8: 99): 4;
    style(--low8: 100): 0;
    style(--low8: 101): 4;
    style(--low8: 102): 4;
    style(--low8: 103): 0;
    style(--low8: 104): 0;
    style(--low8: 105): 4;
    style(--low8: 106): 4;
    style(--low8: 107): 0;
    style(--low8: 108): 4;
    style(--low8: 109): 0;
    style(--low8: 110): 0;
    style(--low8: 111): 4;
    style(--low8: 112): 0;
    style(--low8: 113): 4;
    style(--low8: 114): 4;
    style(--low8: 115): 0;
    style(--low8: 116): 4;
    style(--low8: 117): 0;
    style(--low8: 118): 0;
    style(--low8: 119): 4;
    style(--low8: 120): 4;
    style(--low8: 121): 0;
    style(--low8: 122): 0;
    style(--low8: 123): 4;
    style(--low8: 124): 0;
    style(--low8: 125): 4;
    style(--low8: 126): 4;
    style(--low8: 127): 0;
    style(--low8: 128): 0;
    style(--low8: 129): 4;
    style(--low8: 130): 4;
    style(--low8: 131): 0;
    style(--low8: 132): 4;
    style(--low8: 133): 0;
    style(--low8: 134): 0;
    style(--low8: 135): 4;
    style(--low8: 136): 4;
    style(--low8: 137): 0;
    style(--low8: 138): 0;
    style(--low8: 139): 4;
    style(--low8: 140): 0;
    style(--low8: 141): 4;
    style(--low8: 142): 4;
    style(--low8: 143): 0;
    style(--low8: 144): 4;
    style(--low8: 145): 0;
    style(--low8: 146): 0;
    style(--low8: 147): 4;
    style(--low8: 148): 0;
    style(--low8: 149): 4;
    style(--low8: 150): 4;
    style(--low8: 151): 0;
    style(--low8: 152): 0;
    style(--low8: 153): 4;
    style(--low8: 154): 4;
    style(--low8: 155): 0;
    style(--low8: 156): 4;
    style(--low8: 157): 0;
    style(--low8: 158): 0;
    style(--low8: 159): 4;
    style(--low8: 160): 4;
    style(--low8: 161): 0;
    style(--low8: 162): 0;
    style(--low8: 163): 4;
    style(--low8: 164): 0;
    style(--low8: 165): 4;
    style(--low8: 166): 4;
    style(--low8: 167): 0;
    style(--low8: 168): 0;
    style(--low8: 169): 4;
    style(--low8: 170): 4;
    style(--low8: 171): 0;
    style(--low8: 172): 4;
    style(--low8: 173): 0;
    style(--low8: 174): 0;
    style(--low8: 175): 4;
    style(--low8: 176): 0;
    style(--low8: 177): 4;
    style(--low8: 178): 4;
    style(--low8: 179): 0;
    style(--low8: 180): 4;
    style(--low8: 181): 0;
    style(--low8: 182): 0;
    style(--low8: 183): 4;
    style(--low8: 184): 4;
    style(--low8: 185): 0;
    style(--low8: 186): 0;
    style(--low8: 187): 4;
    style(--low8: 188): 0;
    style(--low8: 189): 4;
    style(--low8: 190): 4;
    style(--low8: 191): 0;
    style(--low8: 192): 4;
    style(--low8: 193): 0;
    style(--low8: 194): 0;
    style(--low8: 195): 4;
    style(--low8: 196): 0;
    style(--low8: 197): 4;
    style(--low8: 198): 4;
    style(--low8: 199): 0;
    style(--low8: 200): 0;
    style(--low8: 201): 4;
    style(--low8: 202): 4;
    style(--low8: 203): 0;
    style(--low8: 204): 4;
    style(--low8: 205): 0;
    style(--low8: 206): 0;
    style(--low8: 207): 4;
    style(--low8: 208): 0;
    style(--low8: 209): 4;
    style(--low8: 210): 4;
    style(--low8: 211): 0;
    style(--low8: 212): 4;
    style(--low8: 213): 0;
    style(--low8: 214): 0;
    style(--low8: 215): 4;
    style(--low8: 216): 4;
    style(--low8: 217): 0;
    style(--low8: 218): 0;
    style(--low8: 219): 4;
    style(--low8: 220): 0;
    style(--low8: 221): 4;
    style(--low8: 222): 4;
    style(--low8: 223): 0;
    style(--low8: 224): 0;
    style(--low8: 225): 4;
    style(--low8: 226): 4;
    style(--low8: 227): 0;
    style(--low8: 228): 4;
    style(--low8: 229): 0;
    style(--low8: 230): 0;
    style(--low8: 231): 4;
    style(--low8: 232): 4;
    style(--low8: 233): 0;
    style(--low8: 234): 0;
    style(--low8: 235): 4;
    style(--low8: 236): 0;
    style(--low8: 237): 4;
    style(--low8: 238): 4;
    style(--low8: 239): 0;
    style(--low8: 240): 4;
    style(--low8: 241): 0;
    style(--low8: 242): 0;
    style(--low8: 243): 4;
    style(--low8: 244): 0;
    style(--low8: 245): 4;
    style(--low8: 246): 4;
    style(--low8: 247): 0;
    style(--low8: 248): 0;
    style(--low8: 249): 4;
    style(--low8: 250): 4;
    style(--low8: 251): 0;
    style(--low8: 252): 4;
    style(--low8: 253): 0;
    style(--low8: 254): 0;
    style(--low8: 255): 4;
  else: 0);
}

@function --andFlags16(--a <integer>, --b <integer>) returns <integer> {
  --res: --and(var(--a), var(--b));
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 15) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}

@function --andFlags8(--a <integer>, --b <integer>) returns <integer> {
  --full: --and(var(--a), var(--b));
  --res: --lowerBytes(var(--full), 8);
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 7) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}
```

- [EXPANDABLE: Explanation of how AND works] The little helpers at the top (--lowerBytes, --rightShift, --bit) are helpers — chop-to-N-bits, shift, extract-one-bit — each built from division and remainder. Then --and itself: thirty-two bit extractions, sixteen multiplications, one weighted sum. Below it, --parity: the 8086 reports whether a result has an even number of 1-bits, and nothing in CSS can count bits, so all 256 possible answers were worked out in advance and written into a 256-arm if(). Last, --andFlags16 — the bookkeeping a real chip does as a free side effect of its silicon (did the result hit zero? go negative?), reconstructed as arithmetic. 

[TABLE]

- **Clock: a**n animation ticks a counter, and every formula in the file re-evaluates each tick.
- **CPU Registers:** each a set of formulas including every possible processor instruction that could change them, and how to calculate their resultant value. Those instructions are cobbled together with a combination of if() statements, calc, mod (remainder) and round.
- **RAM:** a titanic list of hundreds of thousands of variables, declared one-by-one, each with a formula asking, every single tick: ‘did this instruction just write to *my* address?’. Reading them back is its own nightmare — CSS gives no way to get from an address (a number) to a variable (a name), so reads go through one colossal lookup function with one arm per address: ‘is it address 0? is it address 1?…’, 743,948 arms long.

[note: the Floppy disk row moved down into the ‘No inputs and outputs’ problem]

[CALLOUT] Lyra Rebane first built an [x86 CPU in CSS](https://lyra.horse/x86css/) with a limited instruction set — this extends that work to a full machine running an unmodified OS and real programs.

### Problem 2: CSS cannot change a property while running

In any other programming language, we can set a variable and then change it later

x = 2

…
x = 4

In CSS, **you only get one chance to set a property.** A huge pain in the arse for programs, which rely heavily on… changing the values of things. 

Instead, each CSS property - from the RAM to the CPU registers - has to be written in such a way that its value is true *all the time.* 

We end up with gigantic if() statements which cover every possible state that a variable could be in: 

- CPU registers cover every possible CPU instruction that could change them, and the resultant value of doing so
- Bytes of RAM each ask, every cycle, whether this tick’s instruction wrote to their address — and when it didn’t, their formula simply answers with last tick’s value, unchanged.

Here is the register AX — structurally exact from the cabinet, arithmetic elided:

```css
--AX: if(
    style(--opcode: 0): …;    /* ADD, one flavour */
    style(--opcode: 1): …;    /* ADD, another */
    …                         /* every opcode that can touch AX */
    else: var(--snapshot-AX));   /* untouched: keep the old value */
```

One table, keyed on the current instruction, with a row for everything that could ever happen to AX — and that final `else` is this whole problem in one line of CSS: a variable’s single, permanent definition has to end with *“otherwise, I am what I was.”* Fourteen of these tables, one per register, are the machine’s entire brain.

Memory gets the same treatment at scale. Each tick, the current instruction broadcasts “I am writing value V to address N” into three small shared variables (the **write slots**), and all 368,256 memory-cell formulas compare the slots against their own address. When an instruction writes nothing — most don’t — a 0-or-1 ‘live’ flag on each slot lets every formula short-circuit at once. 

### Problem 3: CSS variables can’t reference themselves

In any programming language, you increment a variable using `x=x+1` . In CSS, that’s off the table: a variable whose definition mentions itself is a *circular reference*, and CSS rejects it outright. 

This one is simple to solve - just keep a *complete second set* of all variables that *could* change - a ‘snapshot’ - from which you can copy variables as required. So, each variable actually needs two copies - what it is *now* and what it was *before.* Since at most 3 of the machine’s 368,256 memory cells change in any given cycle, over 99.999% of this copying is redundant. 

Except that’s actually still not quite enough. Every formula must read the frozen *before*-picture while the *after*-picture is being computed — if new values landed the moment they were ready, half the machine would calculate from the old state and half from the new, and the state would be scrambled beyond repair. 

That one is simple to solve too: create *another complete copy* of all variables as a buffer between the two. New values are parked there, then handed over all at once, on a beat of the clock, when nothing is reading. (In the real file every memory cell ends up as **four** variables. If you know electronics or graphics, yes: we have just reinvented the flip-flop — the CSS-as-circuits analogy holding up worryingly well — or, if you prefer, double-buffering.) 

### Problems 4-7: No inputs and outputs.

A computer you can’t feed programs into, see, or touch isn’t much of a computer. CSS can’t read files, can’t take input from your keyboard, and can’t draw to the screen — so we cobble every one of these together:

- **The floppy disk:** CSS can’t open anything at runtime — no files, no requests, no loading — so the entire floppy is baked into the stylesheet in advance, byte by byte, one if() arm per byte. (Byte zero of the disk is `235` — the x86 jump instruction every boot sector begins with.) DOS asks the drive for one 512-byte sector at a time, so the machine keeps a 512-byte *window* in memory whose contents aren’t stored anywhere: those addresses read straight through to the disk table, at ‘requested sector × 512 + offset’. DOS writes a sector number into memory and the window instantly shows a different slice of the disk — it never learns the floppy is a fiction. (Making disks *writable* — saving your work into a stylesheet — is its own adventure, covered on the next page.)
- **The screen:** 64,000 `<div>`s are assembled in a 320x200 grid, each with a rule that colours it from its own byte of video RAM (skipping over the complexity of various video modes - Text, CGA, Mode13h…). This is, note, the only place in 300 MB where CSS is doing its actual day job — reading a value and colouring a box. Everything else is smuggling; the screen is the sliver of honest work at the end. What a pity we’re still abusing it with sixty-four thousand elements.
- **A keyboard:** CSS cannot see your keyboard — no selector reacts to a real keypress. The *one* thing it can perceive about a human is whether an element is being pressed at this exact moment: the `:active` selector. So the machine’s keyboard is a set of real on-screen buttons, each carrying a rule — ‘while I am held, the keyboard variable holds my key’s code’ — wired into the two bytes of memory where the BIOS expects keyboard hardware. It is the single aperture through which the physical world enters the computation.
- **Sound** just has no way to work, really. Except possibly displaying the sound wave visually..? Perhaps that’s future work.

### Problem 8: There's too much code to realistically write down

The final code is cooked up using templates via a generator script called **Kiln** - it mechanically fills in every register table, memory formula, every one of the 743,948 read arms and so on. Could I write that in CSS too? Not directly; as I say, you can't really write programs in CSS. It'd be much easier to write a Javascript interpreter for DOS, stick MS-DOS and that program on a floppy disk, then transpile all of that to CSS.  

### Problem 9: This runs absurdly slowly, if it runs at all.

- [EXPANDABLE Why it’s so slow]
    - All 368,256 RAM cells re-check ‘was I just written to?’ every single tick — even though, at most, 3 of them were. In a normal computer the cost of a step is proportional to what *changed*; in this machine it is proportional to what *exists*.
    - CPU instructions that normally run *in hardware* — silicon executing billions of them per second — are here re-derived as long chains of arithmetic (remember the AND function above), which the browser has to grind through symbolically, every tick.
    - (A thought for the technical: the .css file is, in a sense, an unrolled computer)

A browser really will evaluate all of this — at about two instructions per second. Not 2 fps. Two **instructions* - add, multiply, etc. To put it in perspective how slow that is: 

[Component: grid of boxes with large numbers in them and text underneath]

- ~3 weeks - to boot DOS
- ~3 months - DOOM level load
- 0.00001 fps - DOOM framerate

This is all assuming your browser doesn’t crash from trying to load a 300+ MB .css file, which it absolutely will (at time of writing) 

The solution is to do what every other programming language does (including Javascript in Chrome etc.), and compile the code into something faster before it runs. 

This site runs the same file through **Calcite**, a compiler that evaluates the same CSS over 100,000x faster; [its own page](link to the page) explains how it works, and why it isn’t cheating. 

---

## PAGE: Calcite

source: web/site/src/routes/About.svelte (sub 5)

# Calcite

Chrome has no issue loading a CSS file up to 568MB (V8's string limit), but trying to *evaluate* 300MB of spaghetti-CSS results in an immediate freeze. Even if equipped to handle such a task, it would take three weeks to boot DOS, three months for Doom to load in, and would run that at 0.00001 fps. So we have a working computer in a stylesheet (proven working with scaled-down components), but no way to run it. 

Every programming language has this problem: source code is written for humans, and running it directly just *is* slow. And every language solves it the same way: **compile the source into something faster before running it.** Chrome compiles JavaScript to machine code before running it (the V8 engine, written in C++), as does every other browser. Python quietly compiles `.py` to bytecode before running it. Almost nothing runs from raw source these days except shell scripts and declarative languages like CSS. 

Nobody previously wrote a compiler for CSS, because nobody had ever been foolish enough to need one. Thus, CSS-DOS grew a second project: a compiler of its own, which took about as long to build as the CSS-generating half of the project. (If you’ve played Elden Ring, this is the part where you go down the lift to Siofra.)

**Calcite ** is a JIT compiler for computational CSS — written in Rust, shipped as WebAssembly, running in the background and operating on a player page which is itself entirely HTML/CSS (mimicking the model of an in-browser engine like V8). On load, it reads the whole stylesheet once and recognises the repetitive shapes that an emulated computer forces CSS into — the 368,256 near-identical write formulas, the colossal lookup functions, the register tables. It compiles those shapes into native routines, over 200,000× faster than the above baseline speed.

(In a perfect world I’d insert Calcite into Chrome’s own style engine and the site would need nothing else. You can’t patch Chrome from a website, so Calcite lives as WebAssembly instead, in a service worker which calculates the video output and streams it to the tab. I considered creating a fast-CSS browser, but nobody wants to download a whole browser just to play around with one website these days.)

### Is this cheating?

A fair question — if a separate program is doing the heavy lifting, is the CSS just decoration? I've taken this seriously, because the entire point of the project is that the machine is written in real, spec-compliant CSS. To ensure this, Calcite is bound by five self-imposed rules, which are on the stricter side where possible. The first is the project's cardinal rule:

1. **Calcite must produce EXACTLY what a spec-compliant browser would — byte for byte.** This is the 'cardinal rule', front and centre in the documentation. Feed the same cabinet to Chrome's own style engine and you'd get the exact same behaviour, just unbearably slowly. I have not allowed ONE BYTE of divergence in my conformance testing — no fast approximations, no cut corners or hacking. If Calcite disagrees with a spec-compliant browser, that's a bug in Calcite. The CSS IS the source code, and Calcite is its servant - perfect, or nothing. 
2. **Calcite must parse a .css file on-the-spot and blind — no AOT compilation, no pre-baking**. It compiles whatever arrives at load time, in the browser, the same way V8 takes whatever JavaScript arrives: everything inferred from the file itself, immediately. And an even stricter rule: it must be the same file. Not one byte added, changed, or removed to make Calcite's life easier, it can only interpret and recreate.
3. **The player page must contain ZERO JavaScript — only HTML/CSS.** Calcite lives in a separately-loaded service worker, mimicking an in-browser engine like V8, and the screen is fed back to the tab through an HTML element. I could easily support the real keyboard, improve performance, etc. with JavaScript on the player page. But it wouldn't be right.
4. **Calcite must be generic — no knowledge of x86, DOS, or this repo.** It doesn't know it's compiling a CPU, and it never finds out what the program does — it only ever reasons about the shape of the CSS. Since CSS has so few tools, the shapes are enumerable in advance even with no idea what they're for. Point it at a different computational stylesheet — another CPU, a Pong cabinet, a cellular automaton, a spreadsheet encoded in selectors — and it would speed those up just the same.
5. **The CSS may not signal to Calcite in an unnatural way.** Plenty of languages allow compiler hints in the source, JavaScript once had a whole dialect of them (asm.js and its "use asm" pragma, killed off when WASM arrived). Forbidden here. Not only is the stylesheet spec-compliant, but it can't smuggle in anything *above and beyond* the spec either. No hints hidden in comments, no sleight of hand. 

---

## PAGE: FAQs

source: web/site/src/routes/About.svelte (sub 6)

# FAQs

#### ▸ Really — not even a LITTLE JavaScript?

Really, none. The machine is one CSS file, and a browser can evaluate every line of it. What a browser *can’t* do is process it in a reasonable amount of time without freezing: 300 MB of stylesheet is more than a tab survives, and even a small build crawls at a couple of instructions per second. So this site feeds the same file to **Calcite**, a compiler built for the job — [its page](#about/calcite) explains what it does, and why it isn’t cheating.

#### ▸ Don’t you need an HTML page for this to work?

Yes, all CSS is impotent unless loaded into a HTML page. That page needs certain scaffolding: a tag that loads the stylesheet, one element for the clock, one for the CPU, 64,000 empty ones for each screen pixel, and a bunch of buttons for the keyboard. And they need to have the same names as the ones I picked for the selectors. 

#### ▸ How does it have a clock, screen, and keyboard? 

These are covered in more detail in their respective sections of the 'file map'. 

Clock:
(For the non-technical, this refers to a regular pulse that synchronises electronics, not the circular wall item that our ancestors used to tell the time before mobile phones were invented) 
One thing in CSS moves by itself: animations. At the very bottom of the file, an animation ticks a counter — 0, 1, 2, 3 — and each lap, the machine advances by one instruction. The [clock section](#about/file/clock) details the keyframes, plus the trick that lets 368,256 memory cells change at once.

Video:
CSS is doing its day job here: colouring boxes in. The screen is 64,000 boxes, 320 wide by 200 tall, each with a formula that grabs the corresponding byte of video memory and uses it as its background colour. There are complexities around supporting video modes (CGA, Text and Mode 13h), changing the palette, and even faking the electron beam in a CRT monitor that would draw all of this. The [screen section](#about/file/screen) details those. 

Keyboard:
No selector reacts to a real keyboard key*, so the machine's only usesr input is an on-screen keyboard. CSS can detect when an element is being pressed right now (the `:active` selector) and feed the currently-pressed key into the computer. The [keyboard section](#about/file/keys) has more on this. 

* This isn't strictly true due to some very niche accessibility features, but they aren't useful. 

#### ▸ What *doesn't* work in CSS?

[] **Sound** - There's just no way for CSS to make noise. Except… possibly displaying the sound wave visually? Perhaps that’s future work.

[]  **A physical keyboard, or any other physical input.** I think clicking buttons is the only viable input mechanism to mimic a keyboard. 

[] **Any more complex OS than MS-DOS** would be a real pain in the arse, perhaps even impossible. Anything using protected mode, or 286/386 instructions is a significant step up in complexity. There's a solid barrier in the way: V8's string size limit, which carts are already pushing up against. On the other hand, emulating *this* was already a huge pain in the arse that seems like it might actually be impossible, so never say never. 

However, **Windows 1.0 is surprisingly possible.** It is just a GUI layer over DOS 16-bit real-mode; the main barrier is the required mouse support. And more Calcite performance work. Conceptually, we could allow the screen <div> pixels themselves to be hoverable and clickable, feeding that information to position and click the cursor on the screen. But I'm releasing this first, the scope creep would be too egregious. 

A minor note: I like the name CSS-DOS, but lack a catchy name for a CSS Windows. CSSWin and WinCSS are uncomfortably close to Tailwind CSS and Windsurf. I'd probably go for Windows.css - nobody take that name, please. 

#### ▸ Can CSS-DOS run any DOS program?

Yes, visit the Build page and hand the builder any DOS file (.com/.exe) or folder small enough to fit on a floppy, and that only uses 8086 instructions (no Intel 286 or 386 opcodes) and it wll bake that into a .css file for you. All of the presets were made that way, although I included a sidecar JSON file that configures the options properly first-time. The file needs to remain under 538MB, or you'll hit V8's string size limit and the .css file won't load in the browser. Try reducing the amount of RAM if needed.

#### ▸ How long did this take?

About six months of on-and-off hobbyist work. I have no idea how many AI tokens I used on the project, but it's easily in the hundreds of millions, probably thousands of pounds of API-equivalent usage. 

#### ▸ How did you debug this?

With enormous pain. Many late nights and tears shed. There is nothing quite like a program diverging from the reference emulator by a byte or two half a million ticks into boot, which only became apparent when the system crashed four million ticks into boot, inside a system with no debugger, no logging and no stack traces — just 368,256 variables recalculating every tick, one of which did so wrongly. Good luck! 

I ended up building a messy collection of debug tools which were often themselves impractically slow unless used with restraint and finesse. Suffice to say, this project gave me a newfound appreciation for debug tooling. An LLM was useful, but without constant steering it would cheerfully chase individual bytes around for hours.  I had to put in rules on what the model could do: all CLI debugger invocations could run for a maximum of two minutes at a time, for example. 

#### ▸ Did you use AI?

Yes, I did. I code in my day job too, and I haven't typed a line of code in earnest in around a year now. Claude 'wrote' 100% of this project’s code, except for some minor tweaks and fixes by me. 

Claude could never have figured the project out on its own, but it was immensely helpful. Claude lacked the intuition to contribute reliably on a conceptual level, although it had its moments - the writable shadow-disk, and <img> tag hack in Calcite, among others were Claude's idea. However, this project is an unusual one, taking Claude well out of distribution, and it often took a laughably inept path through some implementations. But what it lacked in smarts, it made up for in being able to spew out code to a spec while I did other things. 

As a long-time tinkerer and coder, I do miss the romantic thrill of cobbling code together by hand, rolling the dice on it, and feeling that pay-off (or letdown). Perhaps this is the mindset of an old fogey, but there's something about creating with your own two hands that's lost when you order a minion to do it for you, no matter how beautiful the end product. The ideas are mostly mine, but I didn't execute them. 

But. This project wouldn't exist without AI, full stop. I am 100% sure my patience would have run out before the machine booted. I don't know Rust well, and couldn't have coded Calcite myself. Claude made optimisations in it that I don’t fully understand. In fact, the day Fable 5 was released, it doubled or tripled Calcite's performance in a single commit. There's something lovely about that, although some part of me wishes I was the one who did it. 

There's a tension: accessibility / convenience / frictionlessness versus challenge / satisfaction / ownership. A game that offered you a button to immediately skip every level would be pointless. But what about skipping *one* level? What if the option only appeared after being stuck on it for a while first? What if it cost a bit of money, so you couldn't do it willy nilly? When does that kind of option turn into a net positive? 

Some part of me often wishes for less choice, to have challenge forced upon me. Dark Souls has no level-skipping. If it did I would have crumbled, sullying the achievement with an asterisk. But a lot of people have completed Dark Souls, and nobody has *ever* run a full OS in CSS. It would have been tempting to declare this project impossible and quit. Doing five out of six levels and seeing the end is arguably better than giving up.  

Shunning LLMs feels like throwing the baby out with the bathwater. Maybe I'm spoiled, but considering brainlessly editing the CSS of this website myself has started to feel menial in an old-timey way, like washing clothes by hand or emptying the chamber pot. Maybe because I've had a taste of AI coding, or maybe I've had a taste of the depraved stuff and ordinary CSS doesn't turn me on any more. Either way, I do want to automate centering divs and fiddling with line heights. That part is just an obstruction, a waste of time. Can someone make an AI model, that either teaches you new skills or automates things you can already do, rather than doing things entirely for you? I'd subscribe to that.

Until then, I hope for the restraint to use tools to reach higher places, not to avoid getting off my arse at all.

#### ▸ Can I contribute/donate?

**Code**: both projects (CSS-DOS and Calcite) are open-source, and I'd welcome code contributions. Huge performance gains are on the table for Calcite, which is currently written in a sub-optimal way and needs a ground-up refactor. Not for the faint of heart. 
Interested contributors could also fix bugs that prevent other DOS games' compatibility - many programs still crash, hang or run too slowly to be playable. 

**Cash**: I earn enough from my day job - if you like this work, please direct any cash you can spare to [ADHD UK](https://adhduk.co.uk/donate-to-adhd-uk/) instead of to me.

#### ▸ I have a question that isn’t answered here.

Email me — **ahmed.elhadi.amer [at] gmail (dot) com**. I’d love to hear from interested people.

#### ▸ Can I get in touch with you for press/videos/podcasts/etc. 

Email me — **ahmed.elhadi.amer [at] gmail (dot) com**. I’d be happy to contribute to press, YouTube videos, and whatever else. 

---

## PAGE: Credits & thanks

source: web/site/src/routes/About.svelte (sub 7)

# Credits & thanks

These people proved, piece by piece, that a browser’s style engine could be blackmailed into computation, and/or provided other helpful assets. 

### Prior art & kindred projects

- [x86CSS](https://lyra.horse/x86css/) — Lyra Rebane ([rebane2001](https://github.com/rebane2001/x86css)). A working 16-bit x86 CPU in pure CSS — the original demonstration that the trick is possible at all. CSS-DOS grew out of it.
- [The CSS CPU Hack](https://dev.to/janeori/expert-css-the-cpu-hack-4ddj) — Jane Ori. The writeup for doing real computation in CSS.
- [emu8](https://github.com/nicknisi/emu8) — the reference 8086 emulator CSS-DOS checks itself against. Very useful for its PIT and PIC chips. 

### Operating system

- The booted OS for most programs is **EDR-DOS**, from the [SvarDOS](https://svardos.org/) build — an open, freely-distributable DR-DOS descendant. CSS-DOS ships its `kernel.sys` and `command.com` on the emulated floppy.
- Also included is the full **MS-DOS** by Microsoft [[[ADD LINKS AND SHIT HERE]]]

### Assets

- Font (headings, code, chrome): “Web437 IBM VGA” by VileR, from the [Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) ([int10h.org](http://int10h.org/)) — CC BY-SA 4.0.
- Font (body text): “[More Perfect DOS VGA](https://laemeur.sdf.org/fonts/)” by LÆMEUR, remastering Zeh Fernando’s “Perfect DOS VGA 437”; IBM designed the glyphs. Free for all use.

---

## PAGE: How it works (the file carousel)

source: web/site/src/routes/About.svelte (sub 4) + components/anatomy/*

### CAROUSEL SECTION: The whole file (map)

source: web/site/src/components/anatomy/SectionMap.svelte

The bar above is the whole cabinet — a real build (Sokoban, 309 MB), drawn to scale, in file order. Click the sections or arrows above to delve* in.

*written by a human, I promise. 

### CAROUSEL SECTION: Utility functions

source: web/site/src/components/anatomy/SectionUtil.svelte

The cabinet begins with a toolbox of **66 small functions** - helpers for common operations we don't have. 

CSS arithmetic has

`x + y`✓

`x − y`✓

`x × y`✓

`x ÷ y`✓

`mod(x, y)`✓

`round(x)`✓

an 8086 needs

`x AND y`✗

`x OR y`✗

`x XOR y`✗

`x << n`✗

`x < y`✗

Everything in the right-hand column has to be built out of the left-hand column.

#### ▸ Background: AND, OR, and why a CPU needs them

Computers store numbers as **bits** — a 16-bit number is sixteen 0-or-1 digits. AND, OR and XOR combine two numbers by comparing each bit - AND keeps a 1 only where both numbers have a 1, OR where either does, XOR where exactly one does. Programs lean on them for all sorts of operations. 

### Bit operations from arithmetic

You met `--and` on the last page — the whole trick is that on single bits, AND is multiplication: 1×1 is 1, everything else is 0. Line two numbers up in binary and multiply each column:

10101100 = 172

AND 01100110 = 102

= 00100100 = 36

Each column is one multiplication; only 1 × 1 survives.

So `--and` splits both numbers into their sixteen bits with divide-and-remainder, multiplies each pair, and reassembles the result:

```css
@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);
  --a2: mod(round(down, var(--a) / 2), 2);
  --a3: mod(round(down, var(--a) / 4), 2);
  /* … sixteen bits of --a, sixteen bits of --b … */
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * 2 +
    calc(var(--a3) * var(--b3)) * 4 +
    /* … */
```

OR and XOR fall out of the same move: per bit, OR is `min(1, a + b)`, XOR is `a + b − 2ab`, and NOT is `1 − a` — the full set of logic gates, rebuilt from primary-school arithmetic.

### Comparisons from sign()

Here’s a stranger gap: CSS can’t ask “is A less than B?”. There is no `<`. The nearest thing on the shelf is `sign()`, which tells you what sign a number is, returning -1 for negative and 1 for positive (and 0 for the number 0, which doesn't have a sign). 

We can check if B is less than A with this little chestnut: 

```css
max(0, sign(B - A - 0.5))    /* 1 if A < B, else 0 */
```

Out comes a clean 0 or 1 that can be fed straight into more arithmetic - exactly how this works is left as an exercise to the reader. This helper is how a subtraction decides whether it had to borrow ([the CPU](#about/file/cpu)’s carry flag), and how [the screen](#about/file/screen) fakes its 70 Hz retrace signal.

A 0-or-1 answer also stands in for “if” inside a formula: `flag × A + (1 − flag) × B` picks A or B. The machine even uses it to *cancel* memory writes: when a write shouldn’t happen, the same trick turns its target address into −1 — an address no memory cell answers to — and the write lands nowhere.

### The lookup tables

In places where CSS genuinely can’t do the maths (or it's significantly faster to avoid it), some of those 66 helper functions aren't computations, but pre-calculated tables of answers. `calc()` can’t raise 2 to a variable power so `--pow2` is just one big 'if' statement:

```css
@function --pow2(--n <integer>) returns <integer> {
  result: if(
    style(--n: 0): 1;
    style(--n: 1): 2;
    style(--n: 2): 4;
    style(--n: 3): 8;
    /* … up to 2³¹ … */
```

And the 8086’s parity flag reports the number of 1-bits in a result. Nothing in CSS counts bits, so `--parity` carries the verdict for all 256 possible bytes:

```css
@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
    style(--low8: 0): 4;
    style(--low8: 1): 0;
    style(--low8: 2): 0;
    style(--low8: 3): 4;
    /* … all 256 byte values … */
```

"But why are the values 0 and 4, not 0 and 1?" I hear a solitary person ask from the back. Well, I'm glad you're paying attention: the parity flag lives at bit 2 of the flags register, so the table might as well store the 4 already moved into position, saving a shift on every arithmetic instruction. Optimisation! 

### What else is in the box

The rest of the 66 sort into three rough families: byte plumbing, which splits and splices the two-bytes-per-cell memory (`--extractByte`, `--spliceByte`, `--applySlot` — the [write-formulas section](#about/file/memw) shows the last one at work); instruction decoding, which picks apart x86 operand bytes (`--getReg16`, `--modrmLen`); and thirty-six flag calculators (`--addFlags16`, `--shrFlags8`, …), which [the CPU section](#about/file/cpu) comes back to.

### CAROUSEL SECTION: CPU

source: web/site/src/components/anatomy/SectionCpu.svelte

This section is the fourteen registers — `--AX`, `--BX`, `--IP` and so on — and the tables that define them. All of it fits in about 255 KB — less than 0.1% of the file. 

Yes okay, that's the registers, but how do the actual instructions get processed? This one is a little conceptually odd - each register just has a lengthy formula describing how it could react to any given opcode. Then, each tick, the registers all check what the current opcode and recalculate themselves accordingly. This feels intuitively backwards - shouldn't the CPU be controlling the registers? Yes, it would be much more efficient to do it that way, which is why it's done that way in a real processor. But we don't have a CPU, we just have registers. So they have to be strong, independent registers who don't need no CPU. 

#### ▸ Background: what a CPU does

Memory (RAM) is a long row of numbered boxes, each holding a byte (a number from 0 to 255). A program is numbers sitting in those boxes, and some of the numbers are instructions: the sequence 184, 5, 0 means “put the number 5 into AX”. AX is a **register** — one of fourteen values the processor keeps directly to hand instead of in memory. Another register, IP, holds the address of the current instruction.

The processor runs in a loop: read the number IP points at, execute that instruction, move IP past it, repeat. On a real processor, that loop is made from many tiny electrical circuits that do the computations. There's no code to make a CPU find the number it needs to; it does it the same way a lightbulb lights up when you press the switch - it's engineered to do it. 

A register might change depending on the current instruction: ADD puts a sum in AX, MOV loads a value into it, POP pulls one off the stack into it. But `--AX` is a CSS variable, and we only get one chance to define it as we learned on the previous page. So the definition has to cover, in advance, everything that could ever happen to the register. — one table, keyed on the current opcode, with a row for every instruction that can touch it. You saw this table’s skeleton on the last page; here is the real thing:

```css
--AX: if(
  style(--_irqActive: 1): var(--snapshot-AX);  /* interrupt pending — hardware outranks the program this tick */
  else: if(
    style(--opcode: 0): …;    /* ADD, one flavour */
    style(--opcode: 1): …;    /* ADD, another */
    …                     /* every opcode that can touch AX */
    else: var(--snapshot-AX)));   /* untouched: keep the old value */
```

Note

Code here is real cabinet code, structurally exact — only the variable names are tidied for reading: `--__1IP` becomes `--snapshot-IP`.

Fourteen of these tables, one per register — that *is* the CPU. Evaluating all fourteen against the current opcode, once, is how an instruction gets executed. And the opcode itself is just another variable: the cabinet contains the line `--opcode: var(--q0)`, where `--q0` is the byte of memory IP points at, fetched through the monstrous function in the [read-formulas section](#about/file/memr).

All fourteen tables, drawn as one grid — a mark where a table has a row for an opcode:

opcode 0255AXCXDXBXSPBPSIDICSDSESSSIPflags

850 rows, 232 distinct opcodes — measured from the Sokoban cabinet. The IP row is full: every instruction has to say where the machine goes next. The blank columns are opcodes the 8086 never defined; the near-empty rows are the segment registers, which almost nothing is allowed to touch.

These tables are the same CSS in every cabinet: Doom’s CPU and Zork’s are byte-identical. Everything that differs between two cabinets is memory and disk.

### One instruction, all the way through

The instruction in question is ADD - opcode 5. We'll take a look at everything that needs to update to process this instruction. 

Opcode 5 is “add a number to AX”. When the snapshot says `--opcode: 5`, this row fires for the AX register:

[NOTE FROM AHMED: PLEASE INCLUDE AX = if... at the start of this ]
```css
style(--opcode: 5): --lowerBytes(calc(var(--snapshot-AX) + var(--imm16)), 16);   /* ADD AX, imm16 */
```

In plain English: New AX = old AX plus the number that followed the opcode in memory, trimmed back to 16 bits because registers wrap. 

Meanwhile, the IP property is also recalculating itself based on the opcode. The ADD instruction is 3 bytes long (ADD,X,Y), so we need to add 3 to the IP counter to find the next instruction.

[AGAIN, ADD the property itself here and the if statement]
```css
style(--opcode: 5): calc(var(--snapshot-IP) + 3);   /* ADD is three bytes long */
```

If we hit a jump instruction, the IP register uses that to find its destination instead. A backwards jump is how loops happen. Next tick, the fetch reads from the new IP, and the process repeats. It's oddly simple in principle. 

We need one more function, though - A real ADD circuit also reports, as side effects of the silicon, whether the sum overflowed, hit zero, or went negative. These reports are the **flags**, and programs check them constantly — every “if” in every program ends up as a flag check. The flags function has a row for opcode 5, which calls the machine’s real 16-bit ADD flag function:

```css
@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf)
    + calc(round(down, max(0, sign(mod(var(--dst), 16)
        + mod(var(--src), 16) - 15.5)) + 0.5) * 16)
    + var(--zfsf) + var(--of) + 2);
}
```

[AHMED SAYS: BULLET POINT THESE AND PUT THEM IN AN EXPANDABLE]

In there: `--cf` asks “did the true sum pass 65,535?” — divide by 65,536, round down, and that is the **carry flag** as a 1 or a 0. `--zfsf` asks “is the result zero?” and “is its top bit set?” (a 16-bit number’s way of being negative) — the **zero** and **sign** flags, each parked at its own bit position. `--pf`, the **parity flag**, comes from the 256-entry lookup table in the utility-functions section. The long line in the middle is the **half-carry** flag — “did the bottom four bits overflow?” — built out of `sign()` because CSS has no `<`. And the `+ 2` at the end is a bit the 8086 keeps permanently switched on.

In total, one ADD is a sum, a new IP, six flags and a table lookup — and ADD is one of the easiest instructions in the set.

### How branching works

If you've read this far, I'm going to assume you know what branching is. So how does an “if” happen? 

With arithmetic, again: `--bit()` pulls one flag out of the flags register as a 0 or a 1, and the jump multiplies its travel distance by it. This is the real IP row for JZ, “jump if zero”:

[AS ABOVE, ADD WHAT THE ACTUAL FUNCTION IS]
```css
style(--opcode: 116): --lowerBytes(calc(var(--snapshot-IP) + 2
  + --bit(var(--snapshot-flags), 6) * --u2s1(var(--q1))), 16);  
```

[THE NEXT 3 SENTENCES NEED BETTER EXPLANATION, TOO HARD TO READ]
Taken, IP moves by the distance byte; not taken, it moves by zero times the distance byte. (`--u2s1()` reads the byte as signed, so the distance can be negative.)

Some conditions cost more. “Jump if less” is taken when the sign flag and the overflow flag disagree — an XOR, which CSS doesn’t have. The [utility section](#about/file/util) builds XOR out of multiplication, and here it is at work on two flag bits:

```css
/* JL, "jump if less": taken when the sign flag differs from the
   overflow flag — an XOR, done as a + b − 2ab on two flag bits */
calc(--bit(var(--snapshot-flags), 7) + --bit(var(--snapshot-flags), 11)
   - 2 * --bit(var(--snapshot-flags), 7) * --bit(var(--snapshot-flags), 11))
```

#### ▸ DIV, DAA, and the less reasonable instructions

Now we're cooking. DIV divides a 32-bit number — held across two registers, DX and AX — producing a quotient and a remainder at once. Two tables catch its output:

```css
/* AX takes the quotient */
round(down, calc((var(--snapshot-DX) * 65536 + var(--snapshot-AX)) / max(1, var(--rmVal16))))
/* DX takes the remainder */
mod(calc(var(--snapshot-DX) * 65536 + var(--snapshot-AX)), max(1, var(--rmVal16)))
```

The `max(1, …)` is there because a program can ask to divide by zero, and the formula has to stay legal CSS when it does.

This is DAA, “decimal adjust AL” — a calculator-era relic that patches up sums done on numbers stored as decimal digits. DOS-era programs really use it, so:

```css
style(--opcode: 39): calc(round(down, var(--snapshot-AX) / 256) * 256
  + mod(calc(var(--AL)
  + calc(min(1, calc(round(down, mod(var(--AL), 16) / 10)
  + mod(round(down, var(--snapshot-flags) / 16), 2))) * 6)
  + calc(min(1, calc(round(down, var(--AL) / 154)
  + mod(var(--snapshot-flags), 2))) * 96)), 256))
```

DAA needs to ask “is this 4-bit chunk bigger than 9?”, and with no `<` available it asks by dividing: `round(down, nibble / 10)` is 1 exactly for 10–15 and 0 otherwise. The whole family of decimal instructions runs on that idiom.

It goes on like this for **232 distinct opcodes — 850 rows** across the register tables.

[QUESTION: WHERE ARE THE PIT AND PIC? ARE THEY COUNTED IN CPU? THEY SHOULDNT REALLY BE]

#### ▸ How an interrupt arrives

[THIS IS WAY TOO DENSE. WHAT IS AN INTERRUPT? WHAT DO YOU MEAN IT 'REFUSES'? CODE CANT REFUSE ANYTHING]
A keypress or a timer tick has to be able to interrupt the running program between instructions. On real hardware that’s wiring; here it’s the override standing in front of every register table. When an interrupt is pending, the machine **refuses to run the instruction it just fetched** — no register takes its decoded value that tick. Instead: IP and CS load the interrupt handler’s address out of a table in memory, SP drops by six for the three pushed words, and the flags register switches interrupts off so the handler can’t itself be interrupted. The cycle counter even charges 61 cycles — what the real 8086 billed for a hardware interrupt.

Behind that sits a simulated interrupt controller — three variables tracking which interrupts are masked, pending, and currently being serviced, with the timer outranking the keyboard. When a handler finishes, it announces “end of interrupt”, and the controller clears the in-service bit with a classic bit hack: `x AND (x − 1)` deletes the lowest set bit of a number, no loop required.

[WHY DO WE NEED TO DO THAT? THIS bIT JUST MAKES NO SENSE]

One timing subtlety is kept faithfully: the 8086’s single-step trap fires *after* the traced instruction, not before. The machine reproduces that with a one-tick delay line — verbatim:

```css
--_tf: var(--__1_tfPending);   /* this tick's trap = LAST tick's request */
``

#### ▸ The other chips: timer, interrupt controller, palette
[AA: THIS SHOULD BE A DIFFERENT SECTION TO CPU]

A PC contains three other chips, and programs talk to them *directly* (it's the '80s, anything goes!): they program a **timer chip** to interrupt 18.2 times a second, tell the **interrupt controller** which events to let through, stream colours into the **VGA palette**. Each of those chips is simulated the same way the registers are — a few more variables, with big if() statements mimicking what the silicon would have done:

[SPLIT THESE UP: PUT THE REGISTERS AND THE FLAG IN THE CPU BIT AND THE VARIABLES FOR THE OTHER STUFF IN THIS NEW SECTION]
```css
--AX --CX --DX --BX --SP --BP --SI --DI   /* the registers … */
--CS --DS --ES --SS --IP --flags          /* … all fourteen */
--picMask --picPending --picInService     /* interrupt controller */
--pitMode --pitReload --pitCounter …      /* timer chip */
--prevKeyboard --kbdScancodeLatch         /* keyboard */
--dacWriteIndex --dacSubIndex …           /* VGA palette chip */
```

### Power-on

What starts the machine? The clock animation begins ticking when the stylesheet loads, and on tick one the fetch simply reads from wherever CS:IP point. They're set in the CSS file from the beginning. 

```css
@property --CS { … initial-value: 61440; }   /* 0xF000 — the BIOS ROM */
@property --IP { … initial-value: 0; }
```

That is linear address 983,040 — the first ROM entry in the [read-formulas section](#about/file/memr) — and the byte sitting there is 235: a jump instruction. So the machine’s first act is to jump into the BIOS proper, which sets up a stack, fills in the interrupt table, paints its splash screen, and jumps again, into DOS. A cold boot, the same way a real PC does it. 

### CAROUSEL SECTION: Keyboard & debug display

source: web/site/src/components/anatomy/SectionKeys.svelte

The smallest section in the file, and the machine’s only window to the outside world. 

CSS has no input events. The one relevant selector it has is **`:active`**, which asks “is this element being pressed, right now?” So the player’s on-screen keys are buttons, and the cabinet simply checks if they are currently being pressed, and sets the --keyboard variable to a specific and suspiciously large number.  

```css
.cpu:has(#kb-a:active) {
  --keyboard: 7777;
}
.cpu:has(#kb-s:active) {
  --keyboard: 8051;
}
.cpu:has(#kb-d:active) {
  --keyboard: 8292;
}
/* … one rule per key … */
```

- -keyboard:

hold a key — even this readout is pure CSS

Wait, 7777? 8051? Those aren't scancodes. In fact, each number packs the key’s hardware scancode together with its text character (A: 30 × 256 + 97 = 7777). Let go, and it snaps back to **0** — that’s how games see you release.

[QUESTION: WHY DOES IT PACK THE SCANCODE TOGETHER WITH THE TEXT CHARACTER]

### The release-code latch

Real keyboards also send a *release* code when a key comes back up, and games depend on it. But `:active` only stops matching for the single instant you let go, and programs usually don’t check the keyboard until a few ticks later — by then that instant is gone, and the key would look held down forever. So the machine keeps a **latch**: one variable holding the most recent key event, press or release, until the next one replaces it.

CSS cannot see your physical keyboard — no selector reacts to a real keypress, so every program is piloted from the on-screen keys. 

And CSS cannot make sound either, so there's no audio. I considered, but never got around to, displaying the audio waveform graphically. 

### CAROUSEL SECTION: Screen

source: web/site/src/components/anatomy/SectionScreen.svelte

Mercifully, the one thing CSS was actually built for is to colour boxes. If you think about it, pixels are just coloured boxes. So the screen is a 320x200 grid of <div> elements, each one a pixel: 64,000 of them. Each simply reads the relevant byte of video-specific memory (aka Video RAM, aka VRAM):

```css
#pixel-0 {
  background: --palette(var(--vram-0));
}
#pixel-1 {
  background: --palette(var(--vram-1));
}
#pixel-2 {
  background: --palette(var(--vram-2));
}
/* … 63,997 more, one per pixel … */
```

…⋱= 64,000<div>s320 pixels200 rows

Each rule reads its pixel’s byte of video memory (`--vram-…`) and looks the colour up in the palette. No image, no canvas — when a game draws, it writes bytes, and divs change colour. These 64,000 rules are 6.5 MB of the file, and they’re always in it — this is the pure-CSS renderer, proven to paint in real Chromium.

Each rule is one line. Pixel 31,840 — row 99, column 160, the middle of the screen — is:

```css
#p31840 { --ci: mod(var(--snapshot-mc343600), 256); background-color: --paletteRGB(var(--ci)); }
```

`mod()` digs the pixel’s byte out of its packed memory cell, and the palette function turns that byte into a colour.

### The palette — how 256 colours get chosen

Older programs were limited to 256 colours at once, which isn't very many. They could at least choose WHICH 256 colours they wanted to use. That list of colours is the 'palette', and the pixel's byte references a colour from that list (0-255). To set one colour, the program writes three bytes — red, green, blue — to a single port, while a small counter steps 0, 1, 2 and rolls over to the next colour slot. When a game fades to black, it is re-streaming the whole table a little darker, over and over.

The lookup itself is a shared 256-way `if()` function, `--paletteRGB`, that turns the live palette into an actual `rgb(…)` value for each div:

```css
@function --paletteRGB(--idx <integer>) returns <color> {
  result: if(
    style(--idx: 0): rgb(round(mod(var(--snapshot-mc524288), 256) * 255 / 63)
                         round(round(down, var(--snapshot-mc524288) / 256) * 255 / 63)
                         round(mod(var(--snapshot-mc524289), 256) * 255 / 63));
    /* … all 256 palette slots … */
    else: rgb(0 0 0));
}
```

The mess inside `rgb()` is three live memory reads — red, green, blue — each scaled by 255/63 because a real VGA’s palette chip only kept six bits per channel: programs wrote brightnesses from 0 to 63, and the machine honours that.

FUN FACT: Of the file’s thousands of functions, this is the only one that returns a colour! All the others just return integers. 

#### ▸ The palette read-back cursor

There’s a second, separate cursor for *reading* the palette back — a fade effect wants to know the current colours before dimming them, and real VGA hardware let it ask without disturbing the write cursor. If real hardware did it, we have to support it too. 

### Text mode & CGA — the shared bytes

Mode 13h isn’t the only screen the machine carries. Text mode — the 80×25 grid the DOS prompt lives on — is its own region of video memory at a different address: two bytes per character, the letter and its colours. And the older CGA graphics modes have their own aperture… which **overlaps the text region**. The same memory cells serve both, on purpose, because that’s genuinely how 1981 CGA hardware behaved — the aliasing is part of the machine being faithful.

[AA: THIS SECTION IS A BIT UNCLEAR AND HARD TO FOLLOW. CAN WE TRY TO REPHRASE IT? WHAT REGISTER. ]
The pure-CSS painter above only draws Mode 13h. For the other modes the cabinet stores everything a renderer needs — including copying the current video mode and the CGA palette register into two spare bytes of the BIOS data area, so the outside of the machine can tell which screen the program meant. That register carries one famous bit: the choice between CGA’s two four-colour palettes, green/red/yellow or cyan/magenta/white — the reason so many old PC games are those exact colours.

### The electron beam

[AA: GAMES DONT FUCKING DO ANYTHING, STOP SAYING 'games ask the screen' and that kind of turn of phrase. be more precise. I removed that phrase ]
An 80s monitor painted the picture with an electron beam, top to bottom, 70 times a second — and games wait for the beam’s flyback (the *vertical retrace*) to redraw without tearing. They poll a status port for this information. 

We fake its position from a number the CPU already tracks — the running count of cycles each instruction would have cost on the real 4.77 MHz chip. One seventieth of a second is 68,182 cycles, and the beam spends about 5% of each frame flying back, so:

[AA: WHERE DOES THE 5% come into it?? WHERE HAS THE NUMBER 3409 come from?]

```css
/* in retrace? — 1 while the beam would be flying back */
max(0, sign(3409 - mod(var(--snapshot-cycleCount), 68182)))
```
The electron beam of a CRT monitor, mimicked with a `mod()` and a `sign()` so that games can synchronise to it. 

### CAROUSEL SECTION: Memory — variable declarations

source: web/site/src/components/anatomy/SectionMemDecl.svelte

Before CSS lets you use a variable as a typed integer, you have to declare it. Sigh. 

```css
@property --mc5000 {
  syntax: '<integer>';
  inherits: true;
  initial-value: 32861;
}
```

The file declares every memory cell — all **368,256** of them, one by one.  

Do we really have to write `inherits: true` 368,256 times? Regrettably, we do. The spec makes `inherits` a required descriptor of `@property` — if left out, the rule is invalid and silently ignored. Ouch. It can’t be `false` either: the memory variables live on the CPU element but get read by its descendants. But 'false' is one character longer anyway, so it wouldn't even help. 

Just the repeated should-be-implicit `inherits:true` instructions total about 6 MB of text - longer than the *complete works of Shakespeare*, just spent saying “yes, inherit” a third of a million times.

### One cell, four variables

[AA: would prefer a more neutral writing here, 'remember the flip flop we invented' is a fucking annoying tone]
There’s a wrinkle: `--mc5000` isn’t the only variable for that cell. Remember the flip-flop we accidentally reinvented on the last page — every value that can change needs a frozen *before*-copy to read while the *after*-copy is being computed. In the real file that comes to **four** variables per cell: the freshly computed value, the snapshot the formulas read, and two hand-over copies that pass results to the next tick (the [clock section](#about/file/clock) walks through that process).

Yet only the first one is ever declared. The other three have no `@property` block anywhere in the file — an unregistered CSS variable simply springs into existence the first time something assigns it. What they *do* need is the power-on value, for the very first tick, before anything has been handed over. It rides along as a fallback, right inside their plumbing lines (variable names tidied for reading — the real ones are `--__1mc5000` etc.):

[I slightly hate staged and held, what is that? is it the snapshot copy? they dont make sense at all as names]
```css
--snapshot-mc5000: var(--staged-mc5000, 32861);
--staged-mc5000: var(--held-mc5000, 32861);
```

If the staged copy doesn’t exist yet — tick one, nothing stored — the snapshot falls back to 32861, the declared power-on value. Which means every byte of the machine’s starting memory is actually written into the file **three times**: once as an `initial-value`, and twice more as fallbacks.

The one optimisation

Memory is **packed two bytes per variable** (32861 is really the two bytes 93 and 128), so every sweep over memory mentions half as many cells as there are bytes. Without it, everything memory-related in the file doubles. This had to be done to avoid V8's string size limit, which would have prevented cabinets loading in Chrome entirely. 

### CAROUSEL SECTION: Memory — read formulas

source: web/site/src/components/anatomy/SectionMemRead.svelte

Wait, *read* formulas? Updating the variable might be hard, but how complex can *reading* it be? Just read it. 

Let's say we want to read memory cell number 12345. Each memory cell is a variable, like var(--memory-12345).  In a normal programming language, we'd place the memory cells in a list and find the 12345th entry, with `memory[12345]` but CSS doesn't *have* lists.  

You're probably thinking there's a way around it. Maybe we could search for the number in the variable name somehow? Nope. There's just no way to go from knowing you want address 12345, to picking out --mem-12345. 

So with a sigh, we have to brute force it. As in, we have to *check every possible option*. The function `--readMem` is a single gigantic `if()` statement which checks every address — 743,948 of them. Not a table, not a list of functions: one `if()`, forty-four million characters long, that simply asks “is it address 0? is it address 1? is it address 2?” until it hits the right one. 


any programming language

```css
opcode = memory[IP];
```

CSS — verbatim from the cabinet

```css
@function --readMem(--at <integer>) returns <integer> {
  result: if(
    style(--at: 0): mod(var(--__1mc0), 256);
    style(--at: 1): round(down, var(--__1mc0) / 256);
    style(--at: 2): mod(var(--__1mc1), 256);
    style(--at: 3): round(down, var(--__1mc1) / 256);
    style(--at: 4): mod(var(--__1mc2), 256);
    style(--at: 5): round(down, var(--__1mc2) / 256);
    style(--at: 6): mod(var(--__1mc3), 256);
    style(--at: 7): round(down, var(--__1mc3) / 256);
    style(--at: 8): mod(var(--__1mc4), 256);
    style(--at: 9): round(down, var(--__1mc4) / 256);
    style(--at: 10): mod(var(--__1mc5), 256);
    style(--at: 11): round(down, var(--__1mc5) / 256);
    style(--at: 12): mod(var(--__1mc6), 256);
    style(--at: 13): round(down, var(--__1mc6) / 256);
    style(--at: 14): mod(var(--__1mc7), 256);
    style(--at: 15): round(down, var(--__1mc7) / 256);
    style(--at: 16): mod(var(--__1mc8), 256);
    style(--at: 17): round(down, var(--__1mc8) / 256);
    style(--at: 18): mod(var(--__1mc9), 256);
    style(--at: 19): round(down, var(--__1mc9) / 256);
    style(--at: 20): mod(var(--__1mc10), 256);
    style(--at: 21): round(down, var(--__1mc10) / 256);
    style(--at: 22): mod(var(--__1mc11), 256);
    style(--at: 23): round(down, var(--__1mc11) / 256);
    style(--at: 24): mod(var(--__1mc12), 256);
    style(--at: 25): round(down, var(--__1mc12) / 256);
    style(--at: 26): mod(var(--__1mc13), 256);
    style(--at: 27): round(down, var(--__1mc13) / 256);
    style(--at: 28): mod(var(--__1mc14), 256);
    style(--at: 29): round(down, var(--__1mc14) / 256);
    style(--at: 30): mod(var(--__1mc15), 256);
    style(--at: 31): round(down, var(--__1mc15) / 256);
    style(--at: 32): mod(var(--__1mc16), 256);
    style(--at: 33): round(down, var(--__1mc16) / 256);
    style(--at: 34): mod(var(--__1mc17), 256);
    style(--at: 35): round(down, var(--__1mc17) / 256);
    style(--at: 36): mod(var(--__1mc18), 256);
    style(--at: 37): round(down, var(--__1mc18) / 256);
    style(--at: 38): mod(var(--__1mc19), 256);
    style(--at: 39): round(down, var(--__1mc19) / 256);
    style(--at: 40): mod(var(--__1mc20), 256);
    style(--at: 41): round(down, var(--__1mc20) / 256);
    style(--at: 42): mod(var(--__1mc21), 256);
    style(--at: 43): round(down, var(--__1mc21) / 256);
    style(--at: 44): mod(var(--__1mc22), 256);
    style(--at: 45): round(down, var(--__1mc22) / 256);
    style(--at: 46): mod(var(--__1mc23), 256);
    style(--at: 47): round(down, var(--__1mc23) / 256);
    style(--at: 48): mod(var(--__1mc24), 256);
    style(--at: 49): round(down, var(--__1mc24) / 256);
    style(--at: 50): mod(var(--__1mc25), 256);
    style(--at: 51): round(down, var(--__1mc25) / 256);
    style(--at: 52): mod(var(--__1mc26), 256);
    style(--at: 53): round(down, var(--__1mc26) / 256);
    style(--at: 54): mod(var(--__1mc27), 256);
    style(--at: 55): round(down, var(--__1mc27) / 256);
    style(--at: 56): mod(var(--__1mc28), 256);
    style(--at: 57): round(down, var(--__1mc28) / 256);
    style(--at: 58): mod(var(--__1mc29), 256);
    style(--at: 59): round(down, var(--__1mc29) / 256);
    style(--at: 60): mod(var(--__1mc30), 256);
    style(--at: 61): round(down, var(--__1mc30) / 256);
    style(--at: 62): mod(var(--__1mc31), 256);
    style(--at: 63): round(down, var(--__1mc31) / 256);
    style(--at: 64): mod(var(--__1mc32), 256);
    style(--at: 65): round(down, var(--__1mc32) / 256);
    style(--at: 66): mod(var(--__1mc33), 256);
    style(--at: 67): round(down, var(--__1mc33) / 256);
    style(--at: 68): mod(var(--__1mc34), 256);
    style(--at: 69): round(down, var(--__1mc34) / 256);
    style(--at: 70): mod(var(--__1mc35), 256);
    style(--at: 71): round(down, var(--__1mc35) / 256);
    style(--at: 72): mod(var(--__1mc36), 256);
    style(--at: 73): round(down, var(--__1mc36) / 256);
    style(--at: 74): mod(var(--__1mc37), 256);
    style(--at: 75): round(down, var(--__1mc37) / 256);
    style(--at: 76): mod(var(--__1mc38), 256);
    style(--at: 77): round(down, var(--__1mc38) / 256);
    style(--at: 78): mod(var(--__1mc39), 256);
    style(--at: 79): round(down, var(--__1mc39) / 256);

         … 736,430 more arms like these — every byte of RAM …

    style(--at: 983040): 235;
    style(--at: 983041): 16;
    style(--at: 983042): 144;
    style(--at: 983043): 144;

         … 6,920 more baked-in BIOS ROM bytes …

    style(--at: 851968): --readDiskByte(calc((mod(var(--__1mc632), 256) + round(down, var(--__1mc632) / 256) * 256) * 512 + 0));
    style(--at: 851969): --readDiskByte(calc((mod(var(--__1mc632), 256) + round(down, var(--__1mc632) / 256) * 256) * 512 + 1));

         … 510 more — the 512-byte disk window …

  else: 0);
}
```

Just this function is nine complete works of Shakespeare. Let's explore the three types of formula we have above: 

### The RAM — 736,510 

The overwhelming bulk. Memory cells hold two bytes each, so every cell gets a pair of arms: the even address extracts the low byte (`mod(…, 256)`), the odd address the high byte (divide by 256, round down). These arms read the live machine — whatever a program has written is what comes back.

Two arms hiding in the middle of the RAM range aren’t memory at all: addresses 1280 and 1281 are wired straight to the live keyboard value — the aperture from the [keyboard section](#about/file/keys), plumbed in. When the BIOS keyboard service reads those addresses, it gets real keypresses through the same function as everything else:

```css
style(--at: 1280): --lowerBytes(var(--snapshot-keyboard), 8);
style(--at: 1281): --rightShift(var(--snapshot-keyboard), 8);
```

### The BIOS ROM — 6,924

The BIOS is read-only, so its bytes don’t need cells — each one is baked in as a literal constant: `style(--at: 983040): 235;`. Bytes that are zero are omitted entirely (the `else: 0` at the bottom of the function answers for them), which is why a 64 KB ROM region needs only 6,924 arms.

### The disk window — 512

[AA: this formula is dropped in out of nowhere and super unclear. what is 'my offset'??]
The last 512 arms are the strangest. They don’t hold anything: each one computes “requested sector × 512 + my offset” — the sector number itself read out of a memory cell — and passes the question through to the disk function. Those 512 addresses are a *view* onto whichever sector was last asked for. The [disk section](#about/file/disk) picks it up from there.

### If all else fails - 1
Finally, `else: 0);`, and the function ends.
[AA: Does it ever actually reach this, or is it just there because it needs to be?]

### CAROUSEL SECTION: Disk

source: web/site/src/components/anatomy/SectionDisk.svelte

CSS can’t open anything at runtime — no files, no requests, no loading — so whatever the machine will ever need has to be in the stylesheet before it starts: the BIOS, DOS itself, and the entire floppy disk, baked in byte by byte. The concept here is relatively simple - we just give each byte in the floppy disk one variable each, and a function reads them back: 

```css
@function --readDiskByte(--idx <integer>) returns <integer> {
  result: if(
    style(--idx: 0): 235;
    style(--idx: 1): 60;
    style(--idx: 2): 144;
    /* … one arm per byte of the floppy … */
```

[AA: You go straight into FAT here - what is FAT?]
(Already meaningful: 235, 60, 144 is the x86 jump instruction that every FAT boot sector opens with. Byte zero of the disk is the first thing the machine boots.)

### The window

How does DOS read it? Luckily, never all at once — it asks the floppy controller for one sector at a time: “give me sector 57.” So the machine keeps a 512-byte **window** in memory whose contents are not stored anywhere: those 512 addresses read *through* to the disk table, at “requested sector × 512 + offset”. Ask for a different sector and the same window now shows different bytes. DOS copies them out and never learns the disk is a fiction.

Window byte 48’s actual arm, in full:

```css
style(--at: 852016): --readDiskByte(calc(
  (mod(var(--snapshot-mc632), 256) + round(down, var(--snapshot-mc632) / 256) * 256) * 512 + 48));
```

[AA: Badly written please fix]
The clutter in the middle is the sector number being dug out of memory cell 632 — the “which sector do you want” register is itself two bytes of ordinary RAM. DOS writes a number there, and 512 addresses instantly mean a different part of the disk.

This is the one section that grows with the game — Sokoban’s disk is 13 MB of the file; Doom’s 1.3 MB floppy takes its cabinet to ~330 MB. The machine itself costs ~296 MB before any game arrives, so Zork — 85 KB of words on a screen — still comes out around 300 MB. 

### Writable disks

Everything above is read-only — each disk byte is a number baked into an `if()` statement. Can a stylesheet hold a disk you can actually save files onto? At a price. A cart can opt in to a second mode (the “Writable” checkbox on the Build page): every byte of the floppy also becomes an ordinary memory cell — the same kind that holds RAM. Reads stop consulting the baked table and ask the cells instead, and the write machinery that serves RAM now serves the floppy too. Save a file in the MS-DOS 4.00 cart’s EDIT and `DIR` shows it. It can't save a new .css file or otherwise persist itself, so it's lost on reload. 

The price is steep. A byte that can change needs a declaration, a read formula and a write formula — ten times the text of a read-only byte, about 0.4 MB of cabinet per KB of floppy. Building Sokoban’s 720 KB floppy as writable inflates the cabinet from 300MB to 570 MB — past the ~536 MB V8 string limit in Chrome, so a writable Sokoban cannot be loaded. Speed roughly halves too (more cells checking themselves every tick). That’s why it’s opt-in per cart, and why the writable MS-DOS 4.00 floppy is a deliberately smaller 480 KB.

#### ▸ A real, bootable floppy

The disk is a genuine FAT12 floppy image containing the given files, plus DOS’s boot sector and kernel in place. DOS reads its directory tables and follows its cluster chains exactly as it would on hardware. (Zero bytes are skipped in the lookup, so sparse disks are cheaper than their nominal size.)

### CAROUSEL SECTION: Clock

source: web/site/src/components/anatomy/SectionClock.svelte

Only one thing in CSS changes on its own: an **animation**. Everything else in the file is formulas — 300 MB of them, unchanging. At the very bottom of the file sits the little bit of code that prods them to re-evaluate:

```css
.clock {
  animation: anim-play 400ms steps(4, jump-end) infinite;
  --clock: 0;
}

@keyframes anim-play {
  0% { --clock: 0 }
  25% { --clock: 1 }
  50% { --clock: 2 }
  75% { --clock: 3 }
}
```

The counter ticks 0, 1, 2, 3, repeat. Each lap, every formula in the file re-evaluates once and the machine advances by one CPU instruction.

### Why four beats and not one?

[[[ BOOKMARK!! ]]]
This is Problem 3 from the last page — no variable may reference itself, so every cell exists as four variables, the flip-flop — now with the actual machinery on the table. The clock’s four beats are what drive the handover. Here is one cell’s full plumbing:

```css
/* always in force: the snapshot — the copy every formula reads —
   is wired to the staged copy from last tick */
--snapshot-mc5000: var(--staged-mc5000, 32861);

/* always in force: the next value, computed from snapshots only
   (this is the write formula from the write-formulas section) */
--mc5000: …;

/* beat 3 — the "execute" keyframe: park the computed value */
--held-mc5000: var(--mc5000);

/* beat 1 — the "store" keyframe: stage the parked value
   so it becomes the NEXT tick's snapshot */
--staged-mc5000: var(--held-mc5000, 32861);
```

Follow one lap of the clock. The formulas compute the whole machine’s next state, reading only the frozen snapshots. On beat 3, the results are parked in the *held* copies. On beat 1 of the next lap, the parked values move into the *staged* copies — and since the snapshots are wired to those, every formula now sees the new state, and computes the tick after. Round and round, forever.

Why the two-step handover? Because each copy is written at one beat and read at another, nothing is ever read and overwritten at the same moment. The machine never sees a half-updated version of itself — every tick gets a clean before-picture, even though 368,256 cells and fourteen registers all change “at once.”

```css
@keyframes tick {
  0%   { --clock: 0 }
  25%  { --clock: 1 }
  50%  { --clock: 2 }
  75%  { --clock: 3 }
}
.cpu {
  animation: tick 400ms
    steps(4) infinite;
}
```

0 rest nothing moves

1 copy in the buffer becomes the snapshot every formula reads

2 compute every formula re-derives from the fresh snapshot

3 copy out the results are parked in the buffer for next tick

The moving highlight is itself a CSS animation — the same mechanism, slowed 8×. The cabinet’s clock does a full lap every 400 ms; Calcite runs the same lap hundreds of thousands of times a second.

And that is where this section’s 43 MB goes: the animation itself is 0.1 KB, but the three plumbing lines have to be written out per cell — three complete sweeps over all of memory (15 + 15 + 13 MB), just to move values from one copy to the next. The registers get the same treatment in a much smaller block inside the CPU.

### The other clock — the one DOS sees

The animation is the machine’s heartbeat, but DOS has never heard of it. What DOS expects is the PC’s **timer chip**, interrupting it 18.2 times a second — that’s how it keeps the time of day, and how games pace themselves. And of course CSS can’t read a wall clock. So the timer is derived from a number the CPU already tracks: a running tally of the cycles each instruction *would have cost* on the real 4.77 MHz chip.

The tally is one more register table — every instruction’s row adds what Intel’s 1978 manual billed for it:

```css
style(--opcode: 144): calc(var(--snapshot-cycleCount) + 3);   /* NOP: 3 cycles */
style(--opcode: 136): calc(var(--snapshot-cycleCount)
  + if(style(--mod: 3): 2; else: 9));   /* MOV: 2 — or 9 if memory is involved */
style(--opcode: 212): calc(var(--snapshot-cycleCount) + 83);  /* AAM: 83 — division was expensive */
```

The gearing is real 1981 engineering: the PC’s timer chip ran at exactly one quarter of the CPU’s clock, so the machine’s timer ticks are simply `cycleCount / 4`. The chip is simulated down to its quirks — in its default square-wave mode the counter genuinely counts down by *two* per tick, and its 16-bit reload value has to arrive as two separate byte writes before the count starts, just like the real part. Every time the counter crosses zero, the timer interrupt fires and DOS’s clock advances.

So the machine keeps two times: the CSS animation decides how fast the world computes, and the cycle counter decides what the software *believes* the time is. Evaluate the file faster and everything speeds up together, still in step — DOS’s sense of time is tied to work done, not to your wall clock.

### How one animation conducts two more

The store and execute steps are themselves `@keyframes` — and an animation can’t call another animation. So the cabinet attaches both to the CPU permanently, **paused**, and the clock unpauses each one for a single beat — verbatim:

```css
.cpu {
  animation: store 1ms infinite, execute 1ms infinite;
  animation-play-state: paused, paused;
  @container style(--clock: 1) { animation-play-state: running, paused }
  @container style(--clock: 3) { animation-play-state: paused, running }
```

### CAROUSEL SECTION: Memory — write formulas

source: web/site/src/components/anatomy/SectionMemWrite.svelte

The single biggest section of the file, and the reason for most of its size. You already know why it has to exist — this is Problem 2 from the last page. This section is what it costs.

One more time, because this is where it costs 171 MB: a normal language assigns — `x = y`, and x changes. A stylesheet has no order; every rule is in force the whole time, and you only get to declare, once, what x *is*:

```css
--x: 5;
```

So the definition itself has to do the work: each byte of memory is written as a formula that works out, every tick, what its value now is — closer to a spreadsheet cell than to a line of code. The formula asks one question — did this tick’s instruction write to *my* address? Three **write slots** carry the answer: small shared variables holding the addresses and values of whatever the current instruction writes.

```css
/* every byte of RAM is this formula */

byte N = IF this instruction
           writes to address N:
             the value being written
       ELSE:
             last tick’s value of N
```

0 00000

85 00001

238 00002

0 00003

12 00004

7 00005

press run — watch every formula re-evaluate

Naturally, this means every byte has to re-check its formula every single tick, whether it was written or not. In a normal programming language, `x = y` changes x and touches nothing else. Here, an instruction that writes one byte — or no bytes at all — still makes all 650,000 write formulas ask their question again. This is massively inefficient.

More than half the file (171 MB) is this single formula, written out once per memory cell.

### How a write actually lands

One complication we’ve been skating over: cells hold two bytes each, so “write this byte here” actually means *splicing* a value into half of a cell without disturbing the other half. One function does the splicing, and every cell’s formula calls it once per write slot — verbatim:

```css
@function --applySlot(--cell, --live, --loOff, --hiOff, --val, --width) returns <integer> {
  result: if(
    style(--live: 0): var(--cell);                /* slot idle — pass through */
    style(--width: 2) and style(--loOff: 0) and style(--hiOff: 1):
      --lowerBytes(var(--val), 16);              /* whole word, aligned */
    style(--width: 2) and style(--loOff: 1):
      calc(--lowerBytes(var(--val), 8) * 256 + mod(var(--cell), 256));   /* word straddles me: low half */
    style(--width: 2) and style(--hiOff: 0):
      calc(round(down, var(--cell) / 256) * 256 + --rightShift(var(--val), 8));   /* word straddles me: high half */
    style(--loOff: 0): calc(round(down, var(--cell) / 256) * 256 + var(--val));   /* one byte, low */
    style(--loOff: 1): calc(var(--val) * 256 + mod(var(--cell), 256));            /* one byte, high */
  else: var(--cell));
}
```

The middle two cases are the awkward one: a 16-bit write to an odd address lands half in one cell and half in the next, so *both* cells fire, each splicing in its own half. And in every cell’s formula the three slot calls are nested with slot 0 outermost, so if two slots ever hit the same cell, slot 0 wins.

Assembled, this is one cell of the machine — verbatim, names tidied as usual, the middle slot elided:

```css
--mc5000: --applySlot(--applySlot(--applySlot(var(--snapshot-mc5000),
      var(--_slot2Live), calc(var(--memAddr2) - 5000 * 2),
      calc(var(--memAddr2) + 1 - 5000 * 2), var(--memVal2), var(--_writeWidth)),
    /* … slot 1, the same shape … */),
  var(--_slot0Live), calc(var(--memAddr0) - 5000 * 2),
  calc(var(--memAddr0) + 1 - 5000 * 2), var(--memVal0), var(--_writeWidth));
```

This line, once per cell — 368,256 times, each with its own address baked into the arithmetic — is the 171 MB.

Why stop at two bytes per cell, when four would halve everything again? Arithmetic, sadly: four packed bytes can reach past four billion, beyond what the 32-bit signed integers all this maths must survive in can hold. Two bytes tops out at 65,535 and is always safe.

#### ▸ Why exactly three write slots

The worst case is a hardware interrupt or an `INT` instruction, which pushes three 16-bit words onto the stack in a single tick — the flags, the code segment, and the return address. Everything else needs fewer, so three slots cover the whole instruction set.

Each slot also carries a **live gate** — a 0/1 saying whether it fires this tick. Most instructions don’t write memory at all, and the gate lets all 650,000 write formulas short-circuit at once: “no slot is live, nothing changes” — without checking a million addresses one by one.