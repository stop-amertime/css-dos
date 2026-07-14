# 2026-07-06 - Splash held ~3 guest seconds; PIT armed at POST; MEMORY line fixed

Owner ask: the boot splash flashed by at calcite speed. Three changes
to Corduroy: (1) new `install_pit()` at POST arms PIT ch0 to the
standard 18.2 Hz tick (mode 3, reload 0xFFFF - the CSS PIT model
treats reload 0 as disarmed) - previously NO code armed the PIT until
a program (doom) did, so the BDA tick count never advanced and
INT 1Ah was meaningless. (2) `splash_show()` executes STI (IVT/BDA/
PIC/PIT are ready) and paces on the real BDA tick counter: 5-tick
pauses between POST lines + a 35-tick hold = 55 BDA ticks ≈ 3 guest
seconds (~570K CSS ticks ≈ ~1s wall on a fast host; guest-anchored
per owner). Poll loop, not HLT - this machine's IRQ frame pushes the
CURRENT IP, so an interrupted HLT re-halts forever. (3) The MEMORY
POST line had NEVER rendered: SS (0x0030) ≠ DS, and passing a stack
buffer as a near `char*` made `draw_text` read DS garbage - digits
now drawn by value; line spacing opened to the title block's 12px
pitch. Boot ticks shift +~750K for every Corduroy cabinet (splash
end ~450K → ~1.2M); prior boot-milestone tick constants (STATUS
"boot→ingame 13.5–13.7M", tick-benchmarks.md) need re-measuring.
Trap hit on the way: build.mjs's mtime check kept a stale
bios_init.obj after a git-checkout A/B dance - the linked BIOS
lacked install_pit and every fresh cabinet hung in the first wait.
Verified: fast-shoot timeline, smoke 6/6, kbd-e2e doom PASS, splash
seen held on the real web player.
