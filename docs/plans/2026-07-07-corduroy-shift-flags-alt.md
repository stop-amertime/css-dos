# Corduroy shift flags + Alt key (make hold-mode chords useful in apps)

Follow-up split out of the hold wire (LOGBOOK 2026-07-07). The machine
can now hold chords (Shift/Ctrl/anything via hold mode), but Corduroy's
INT 09h never sets the BDA shift flags (0x417/0x418) and its
scancode2ascii table has no shifted/ctrl variants — so a held Shift
doesn't capitalise and EDIT/Ctrl+C style app shortcuts don't fire.

Work:

- INT 09h: track make/break of Shift/Ctrl/Alt scancodes (0x2A/0x36,
  0x1D, 0x38) into BDA 0x417 flags (breaks DO reach the ISR — it
  currently just drops them before the ring).
- Shifted + ctrl ASCII translation tables (shifted digits/punct,
  letters via flag, Ctrl+letter = 0x01..0x1A).
- Player keyboard: add kb-alt (scancode 0x38, ascii 0x00) to
  KEYBOARD_KEYS + both players' HTML (raw regen picks it up free).
- Verify: hold Shift → type = capitals (dos-shell); Ctrl+C breaks a
  running command; kbd-e2e stays green.
