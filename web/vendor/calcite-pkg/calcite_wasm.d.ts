/* tslint:disable */
/* eslint-disable */

/**
 * The main engine handle exposed to JavaScript.
 */
export class CalciteEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Discard all registered watches (and pending events) without
     * touching the engine state. Call this between bench profile
     * stages to start fresh; `reset()` does this implicitly along
     * with rebuilding state.
     */
    clear_watches(): void;
    /**
     * Diagnostic: per-phase compile timing as a JSON array
     * (`[{"phase":"parse.cssparser","secs":12.3}, …]`). Recorded during
     * the constructor's parse+compile; wasm has no stderr so this is the
     * only way hosts can see the breakdown.
     */
    compile_phase_report(): string;
    /**
     * Diagnostic: total compiled-program op count.
     */
    compiled_op_count(): number;
    /**
     * Diagnostic: total compacted slot count.
     */
    compiled_slot_count(): number;
    /**
     * Drain pending measurement events, returning them as a JSON
     * string. Each event is a JSON object with shape
     * `{tick, watch, halted, vars:[[name,val]...], dumps:[{tag,addr,len,bytes}]}`.
     * `bytes` is a base64 string when the dump sink is Memory.
     */
    drain_measurements(): string;
    /**
     * Read the sticky "unknown opcode" latch. 0 means none seen yet.
     * A non-zero value is the opcode byte of the first instruction the
     * CPU hit that has no dispatch entry - typically a 286/386/486
     * instruction the 8086 core doesn't implement. Execution is
     * effectively halted because IP can't advance through it.
     */
    get_halt_code(): number;
    /**
     * Get the current value of a register (for debugging).
     */
    get_register(index: number): number;
    /**
     * Read the last video mode the program REQUESTED, before any silent
     * remap. Written by the corduroy BIOS to linear 0x04F2 on every
     * INT 10h AH=00h call. If this differs from `get_video_mode()` the
     * program asked for a mode CSS-DOS doesn't implement (EGA/VGA planar,
     * CGA, Hercules, etc.) and was silently remapped to text mode 0x03.
     */
    get_requested_video_mode(): number;
    /**
     * Get a state variable by name (e.g. "cycleCount", "IP", "AX").
     * Returns 0 if the variable doesn't exist.
     */
    get_state_var(name: string): number;
    /**
     * Return string properties as a JSON object string, e.g. `{"textBuffer":"Hello"}`.
     */
    get_string_properties(): string;
    /**
     * Number of ticks evaluated since reset. Equivalent to the
     * `tick` count `calcite-cli` prints. Used by bench harnesses that
     * want a stable "calcite work units done" metric independent of
     * guest CPU frequency.
     */
    get_tick(): number;
    /**
     * Read the current video mode from the BDA (0x0449).
     *
     * Returns the byte at flat address 0x0449 (BDA segment 0x0040, offset 0x49).
     * This is written by INT 10h AH=00h (set mode) and read by AH=0Fh (get mode).
     * Common values: 0x03 = 80x25 text, 0x13 = VGA Mode 13h (320x200x256).
     */
    get_video_mode(): number;
    /**
     * Returns the input edges the recogniser found in this cabinet's
     * CSS, as a JS array of `{property, pseudo, selector, value}`
     * objects. Useful for the host to know which edges to drive.
     */
    input_edges(): any;
    /**
     * Create a new engine instance from CSS source text.
     */
    constructor(css: string);
    /**
     * Create a new engine instance from CSS source as raw UTF-8 bytes.
     * Use this for large files that exceed JS string limits.
     */
    static new_from_bytes(css_bytes: Uint8Array): CalciteEngine;
    /**
     * Diagnostic: number of recognised packed-broadcast ports.
     * 0 = recogniser didn't fire (cabinet falls back to slow per-cell eval).
     * 3 = current 3-slot scheme; 6 = legacy byte-slot scheme.
     */
    packed_broadcast_port_count(): number;
    /**
     * Read a graphics-mode framebuffer as raw RGBA bytes.
     *
     * Returns `width * height * 4` bytes suitable for direct use with
     * `new ImageData(new Uint8ClampedArray(bytes), width, height)` and
     * `ctx.putImageData()` in the browser.
     */
    read_framebuffer_rgba(base_addr: number, width: number, height: number): Uint8Array;
    /**
     * Read a contiguous byte range from memory. Returns `len` bytes starting
     * at `base_addr`. Out-of-range reads return 0.
     *
     * Used by the browser renderer when it needs the raw VGA/CGA framebuffer
     * bytes (char+attr pairs for text mode, 2-bpp packed scanlines for CGA
     * mode 0x04). Calcite stays x86-ignorant: it just hands over the bytes,
     * the caller decodes.
     */
    read_memory_range(base_addr: number, len: number): Uint8Array;
    /**
     * Read text-mode video memory (character bytes only).
     *
     * Returns `width * height` bytes from video memory at `base_addr`.
     * Default for DOS text mode: `read_video_memory(0xB8000, 40, 25)`.
     */
    read_video_memory(base_addr: number, width: number, height: number): Uint8Array;
    /**
     * Register a watch (script-primitive) with the engine. The spec
     * uses the same string format as calcite-cli's `--watch` flag -
     * see `crates/calcite-core/src/script.rs` for the full grammar.
     * Examples (`spec`):
     *
     * * `"poll:stride:every=50000"` - a cheap stride that ticks every
     *   50K engine ticks. Suitable as a `gate=` target for expensive
     *   watches.
     * * `"ingame:cond:0x3a3c4=0:gate=poll:then=emit+halt"` - fire +
     *   halt when the byte at linear 0x3a3c4 is zero, evaluated only
     *   on `poll` fires.
     * * `"vram_dump:at:tick=2000000:then=dump=0xb8000,4000"` - capture
     *   text VRAM at tick 2M; the bytes attach to the emitted event.
     *
     * Returns the watch's index on success. Throws on parse error.
     */
    register_watch(spec: string): number;
    /**
     * Render a graphics-mode framebuffer as a PPM P6 image.
     *
     * Each byte at `base_addr + i` is a palette index; the returned buffer
     * is a complete PPM P6 file including header. For VGA Mode 13h:
     * `render_framebuffer(0xA0000, 320, 200)`.
     */
    render_framebuffer(base_addr: number, width: number, height: number): Uint8Array;
    /**
     * Render text-mode video memory as a string (for debugging).
     */
    render_screen(base_addr: number, width: number, height: number): string;
    /**
     * Render text-mode video memory as HTML with CGA color spans.
     */
    render_screen_html(base_addr: number, width: number, height: number): string;
    /**
     * Reset the engine's runtime state without recompiling the CSS.
     * Equivalent to `new CalciteEngine(css)` but skips the parse +
     * compile steps, which are the expensive ones for large cabinets.
     * Used by the bridge worker to restart the machine on each
     * viewer-connect without paying multi-second compile cost.
     */
    reset(): void;
    /**
     * Restore a snapshot blob produced by [`snapshot`](Self::snapshot)
     * against the same cabinet. Returns an error if the blob is malformed
     * or the cabinet's state shape doesn't match the snapshot.
     */
    restore(blob: Uint8Array): void;
    /**
     * Run a batch of ticks WITHOUT computing the per-batch state-var diff.
     *
     * `tick_batch` returns the changed state vars as a JSON string for
     * callers (debug-server, conformance harness) that consume them.
     * The web bridge ignores the returned JSON - it observes state via
     * `get_state_var` / `read_framebuffer_rgba` after each batch instead.
     * On large cabinets the diff is non-trivial (doom8088: ~10K state
     * vars, full O(N) sweep each batch), and the JSON formatting on top
     * of that adds another ~5-10% per batch.
     *
     * This entry point skips both. Same correctness contract as
     * `tick_batch` for state advancement; just doesn't synthesize the
     * JSON return.
     */
    run_batch_silent(count: number): void;
    /**
     * Run `count` ticks while polling the watch registry every
     * `chunk_ticks` ticks. Returns true if a watch requested halt
     * before `count` ticks elapsed; false otherwise. The host drains
     * events via `drain_measurements` after this returns.
     *
     * Use `chunk_ticks = 0` to disable chunking (single big batch with
     * one final poll).
     */
    run_batch_watched(count: number, chunk_ticks: number): boolean;
    /**
     * Report a pseudo-class match edge as active or inactive.
     *
     * This is the principled input surface: the cabinet's CSS uses
     * `&:has(#SELECTOR:PSEUDO) { --PROP: VALUE; }` rules to bind the
     * match state to a custom property. The host calls this to flip
     * the (pseudo, selector) edge; the next tick's evaluation
     * produces VALUE on PROP via calcite's input-edge recogniser.
     *
     * `pseudo` is the pseudo-class name without the leading `:`
     * (e.g. `"active"`). `selector` is the id-selector text without
     * the leading `#` (e.g. `"kb-1"`). `value` is the boolean state.
     *
     * The host is responsible for sending matching false edges
     * (release) - calcite does not synthesise key-up automatically.
     */
    set_pseudo_class_active(pseudo: string, selector: string, value: boolean): void;
    /**
     * Serialise the runtime-mutable state (state_vars + memory + extended
     * + string_properties + frame_counter) to a byte blob. Pair with
     * [`restore`](Self::restore) on the same cabinet to resume execution
     * from this exact tick - useful for benchmarking a level-load window
     * without re-running boot/title/menu first.
     *
     * The blob is portable across calcite-cli and calcite-wasm and across
     * runs of the same cabinet, but NOT across cabinets (slot ordering is
     * per-parse).
     */
    snapshot(): Uint8Array;
    /**
     * Run a batch of ticks and return the property changes as a JSON string.
     *
     * Returns `[[name, value], ...]` pairs.
     */
    tick_batch(count: number): string;
    /**
     * Number of registered watches.
     */
    watch_count(): number;
    /**
     * Has any watch requested a halt during the most recent poll?
     */
    watch_halt_requested(): boolean;
}

/**
 * Initialise the WASM module (sets up logging, etc.).
 */
export function init(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_calciteengine_free: (a: number, b: number) => void;
    readonly calciteengine_clear_watches: (a: number) => void;
    readonly calciteengine_compile_phase_report: (a: number) => [number, number];
    readonly calciteengine_compiled_op_count: (a: number) => number;
    readonly calciteengine_compiled_slot_count: (a: number) => number;
    readonly calciteengine_drain_measurements: (a: number) => [number, number];
    readonly calciteengine_get_halt_code: (a: number) => number;
    readonly calciteengine_get_register: (a: number, b: number) => number;
    readonly calciteengine_get_requested_video_mode: (a: number) => number;
    readonly calciteengine_get_state_var: (a: number, b: number, c: number) => number;
    readonly calciteengine_get_string_properties: (a: number) => [number, number];
    readonly calciteengine_get_tick: (a: number) => number;
    readonly calciteengine_get_video_mode: (a: number) => number;
    readonly calciteengine_input_edges: (a: number) => any;
    readonly calciteengine_new: (a: number, b: number) => [number, number, number];
    readonly calciteengine_new_from_bytes: (a: number, b: number) => [number, number, number];
    readonly calciteengine_packed_broadcast_port_count: (a: number) => number;
    readonly calciteengine_read_framebuffer_rgba: (a: number, b: number, c: number, d: number) => [number, number];
    readonly calciteengine_read_memory_range: (a: number, b: number, c: number) => [number, number];
    readonly calciteengine_read_video_memory: (a: number, b: number, c: number, d: number) => [number, number];
    readonly calciteengine_register_watch: (a: number, b: number, c: number) => [number, number, number];
    readonly calciteengine_render_framebuffer: (a: number, b: number, c: number, d: number) => [number, number];
    readonly calciteengine_render_screen: (a: number, b: number, c: number, d: number) => [number, number];
    readonly calciteengine_render_screen_html: (a: number, b: number, c: number, d: number) => [number, number];
    readonly calciteengine_reset: (a: number) => void;
    readonly calciteengine_restore: (a: number, b: number, c: number) => [number, number];
    readonly calciteengine_run_batch_silent: (a: number, b: number) => void;
    readonly calciteengine_run_batch_watched: (a: number, b: number, c: number) => number;
    readonly calciteengine_set_pseudo_class_active: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly calciteengine_snapshot: (a: number) => [number, number];
    readonly calciteengine_tick_batch: (a: number, b: number) => [number, number, number, number];
    readonly calciteengine_watch_count: (a: number) => number;
    readonly calciteengine_watch_halt_requested: (a: number) => number;
    readonly init: () => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
