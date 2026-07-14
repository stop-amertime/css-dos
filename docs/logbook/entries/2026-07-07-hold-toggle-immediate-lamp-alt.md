# 2026-07-07 - Hold-off releases immediately; hold lamp; Alt key; SW heartbeat

Owner: exiting hold mode only released held keys on the NEXT key
press - the calcite player's checkbox could only reach the bridge
riding a key submission (zero-JS page; see 2026-07-06 findings).
Fix: `#kb-hold` is now a plain submit key (`key=kb-hold`); the BRIDGE
owns the mode and flips the `--kbdHold` wire per press, so mode-off
drains the `kbdHeld*` slots at once (the machine drain needs no
input - emitIRQCompute). `holdmode=` rider param deleted
(player/SW/bridge). Mode feedback: a lamp dot on the key - `<img
src=/_screen/holdlamp>`, second multipart stream (SW machinery now
shared with the framebuffer; bridge broadcasts a 10px BMP - green=on,
black=off - on toggle/reset/`lamp-viewer` + 1 Hz keepalive). Raw keeps the
checkbox (immediate by construction) - raw-regen swaps the control.
Alt key (0x38) added between Ctrl and Space (kiln + players).
FINDINGS (all probe-verified): (1) **the SW dies after ~30 s without
fetch events - broadcasts/stream writes don't count - killing the
screen + lamp streams: the live player froze permanently if you just
watched.** Fixed zero-JS: hidden `heartbeat.html` iframe self-refreshes
every 20 s (meta refresh = fetch event; replaces history entry).
(2) Chrome paints multipart part N only as N+1 streams in → SW now
trails each part with the delimiter; lamp frames sent twice.
(3) canvas drawImage of a multipart `<img>` returns a stale frame -
lamp asserted via screenshot + `png-pixel.mjs` helper. Verified:
smoke 6/6, writable, msdos, kbd-e2e (chord LEFT+CTRL+ALT, drain on
toggle-off alone, lamp lit/dark on the actual display).
