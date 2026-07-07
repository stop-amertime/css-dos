/* @ts-self-types="./calcite_wasm.d.ts" */

/**
 * The main engine handle exposed to JavaScript.
 */
export class CalciteEngine {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CalciteEngine.prototype);
        obj.__wbg_ptr = ptr;
        CalciteEngineFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CalciteEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_calciteengine_free(ptr, 0);
    }
    /**
     * Discard all registered watches (and pending events) without
     * touching the engine state. Call this between bench profile
     * stages to start fresh; `reset()` does this implicitly along
     * with rebuilding state.
     */
    clear_watches() {
        wasm.calciteengine_clear_watches(this.__wbg_ptr);
    }
    /**
     * Diagnostic: per-phase compile timing as a JSON array
     * (`[{"phase":"parse.cssparser","secs":12.3}, …]`). Recorded during
     * the constructor's parse+compile; wasm has no stderr so this is the
     * only way hosts can see the breakdown.
     * @returns {string}
     */
    compile_phase_report() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.calciteengine_compile_phase_report(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Diagnostic: total compiled-program op count.
     * @returns {number}
     */
    compiled_op_count() {
        const ret = wasm.calciteengine_compiled_op_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Diagnostic: total compacted slot count.
     * @returns {number}
     */
    compiled_slot_count() {
        const ret = wasm.calciteengine_compiled_slot_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Drain pending measurement events, returning them as a JSON
     * string. Each event is a JSON object with shape
     * `{tick, watch, halted, vars:[[name,val]...], dumps:[{tag,addr,len,bytes}]}`.
     * `bytes` is a base64 string when the dump sink is Memory.
     * @returns {string}
     */
    drain_measurements() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.calciteengine_drain_measurements(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Read the sticky "unknown opcode" latch. 0 means none seen yet.
     * A non-zero value is the opcode byte of the first instruction the
     * CPU hit that has no dispatch entry — typically a 286/386/486
     * instruction the 8086 core doesn't implement. Execution is
     * effectively halted because IP can't advance through it.
     * @returns {number}
     */
    get_halt_code() {
        const ret = wasm.calciteengine_get_halt_code(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get the current value of a register (for debugging).
     * @param {number} index
     * @returns {number}
     */
    get_register(index) {
        const ret = wasm.calciteengine_get_register(this.__wbg_ptr, index);
        return ret;
    }
    /**
     * Read the last video mode the program REQUESTED, before any silent
     * remap. Written by the corduroy BIOS to linear 0x04F2 on every
     * INT 10h AH=00h call. If this differs from `get_video_mode()` the
     * program asked for a mode CSS-DOS doesn't implement (EGA/VGA planar,
     * CGA, Hercules, etc.) and was silently remapped to text mode 0x03.
     * @returns {number}
     */
    get_requested_video_mode() {
        const ret = wasm.calciteengine_get_requested_video_mode(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get a state variable by name (e.g. "cycleCount", "IP", "AX").
     * Returns 0 if the variable doesn't exist.
     * @param {string} name
     * @returns {number}
     */
    get_state_var(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.calciteengine_get_state_var(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Return string properties as a JSON object string, e.g. `{"textBuffer":"Hello"}`.
     * @returns {string}
     */
    get_string_properties() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.calciteengine_get_string_properties(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Number of ticks evaluated since reset. Equivalent to the
     * `tick` count `calcite-cli` prints. Used by bench harnesses that
     * want a stable "calcite work units done" metric independent of
     * guest CPU frequency.
     * @returns {number}
     */
    get_tick() {
        const ret = wasm.calciteengine_get_tick(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Read the current video mode from the BDA (0x0449).
     *
     * Returns the byte at flat address 0x0449 (BDA segment 0x0040, offset 0x49).
     * This is written by INT 10h AH=00h (set mode) and read by AH=0Fh (get mode).
     * Common values: 0x03 = 80x25 text, 0x13 = VGA Mode 13h (320x200x256).
     * @returns {number}
     */
    get_video_mode() {
        const ret = wasm.calciteengine_get_video_mode(this.__wbg_ptr);
        return ret;
    }
    /**
     * Returns the input edges the recogniser found in this cabinet's
     * CSS, as a JS array of `{property, pseudo, selector, value}`
     * objects. Useful for the host to know which edges to drive.
     * @returns {any}
     */
    input_edges() {
        const ret = wasm.calciteengine_input_edges(this.__wbg_ptr);
        return ret;
    }
    /**
     * Create a new engine instance from CSS source text.
     * @param {string} css
     */
    constructor(css) {
        const ptr0 = passStringToWasm0(css, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.calciteengine_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        CalciteEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Create a new engine instance from CSS source as raw UTF-8 bytes.
     * Use this for large files that exceed JS string limits.
     * @param {Uint8Array} css_bytes
     * @returns {CalciteEngine}
     */
    static new_from_bytes(css_bytes) {
        const ptr0 = passArray8ToWasm0(css_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.calciteengine_new_from_bytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return CalciteEngine.__wrap(ret[0]);
    }
    /**
     * Diagnostic: number of recognised packed-broadcast ports.
     * 0 = recogniser didn't fire (cabinet falls back to slow per-cell eval).
     * 3 = current 3-slot scheme; 6 = legacy byte-slot scheme.
     * @returns {number}
     */
    packed_broadcast_port_count() {
        const ret = wasm.calciteengine_packed_broadcast_port_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Read a graphics-mode framebuffer as raw RGBA bytes.
     *
     * Returns `width * height * 4` bytes suitable for direct use with
     * `new ImageData(new Uint8ClampedArray(bytes), width, height)` and
     * `ctx.putImageData()` in the browser.
     * @param {number} base_addr
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    read_framebuffer_rgba(base_addr, width, height) {
        const ret = wasm.calciteengine_read_framebuffer_rgba(this.__wbg_ptr, base_addr, width, height);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Read a contiguous byte range from memory. Returns `len` bytes starting
     * at `base_addr`. Out-of-range reads return 0.
     *
     * Used by the browser renderer when it needs the raw VGA/CGA framebuffer
     * bytes (char+attr pairs for text mode, 2-bpp packed scanlines for CGA
     * mode 0x04). Calcite stays x86-ignorant: it just hands over the bytes,
     * the caller decodes.
     * @param {number} base_addr
     * @param {number} len
     * @returns {Uint8Array}
     */
    read_memory_range(base_addr, len) {
        const ret = wasm.calciteengine_read_memory_range(this.__wbg_ptr, base_addr, len);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Read text-mode video memory (character bytes only).
     *
     * Returns `width * height` bytes from video memory at `base_addr`.
     * Default for DOS text mode: `read_video_memory(0xB8000, 40, 25)`.
     * @param {number} base_addr
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    read_video_memory(base_addr, width, height) {
        const ret = wasm.calciteengine_read_video_memory(this.__wbg_ptr, base_addr, width, height);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Register a watch (script-primitive) with the engine. The spec
     * uses the same string format as calcite-cli's `--watch` flag —
     * see `crates/calcite-core/src/script.rs` for the full grammar.
     * Examples (`spec`):
     *
     * * `"poll:stride:every=50000"` — a cheap stride that ticks every
     *   50K engine ticks. Suitable as a `gate=` target for expensive
     *   watches.
     * * `"ingame:cond:0x3a3c4=0:gate=poll:then=emit+halt"` — fire +
     *   halt when the byte at linear 0x3a3c4 is zero, evaluated only
     *   on `poll` fires.
     * * `"vram_dump:at:tick=2000000:then=dump=0xb8000,4000"` — capture
     *   text VRAM at tick 2M; the bytes attach to the emitted event.
     *
     * Returns the watch's index on success. Throws on parse error.
     * @param {string} spec
     * @returns {number}
     */
    register_watch(spec) {
        const ptr0 = passStringToWasm0(spec, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.calciteengine_register_watch(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * Render a graphics-mode framebuffer as a PPM P6 image.
     *
     * Each byte at `base_addr + i` is a palette index; the returned buffer
     * is a complete PPM P6 file including header. For VGA Mode 13h:
     * `render_framebuffer(0xA0000, 320, 200)`.
     * @param {number} base_addr
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    render_framebuffer(base_addr, width, height) {
        const ret = wasm.calciteengine_render_framebuffer(this.__wbg_ptr, base_addr, width, height);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Render text-mode video memory as a string (for debugging).
     * @param {number} base_addr
     * @param {number} width
     * @param {number} height
     * @returns {string}
     */
    render_screen(base_addr, width, height) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.calciteengine_render_screen(this.__wbg_ptr, base_addr, width, height);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Render text-mode video memory as HTML with CGA color spans.
     * @param {number} base_addr
     * @param {number} width
     * @param {number} height
     * @returns {string}
     */
    render_screen_html(base_addr, width, height) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.calciteengine_render_screen_html(this.__wbg_ptr, base_addr, width, height);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Reset the engine's runtime state without recompiling the CSS.
     * Equivalent to `new CalciteEngine(css)` but skips the parse +
     * compile steps, which are the expensive ones for large cabinets.
     * Used by the bridge worker to restart the machine on each
     * viewer-connect without paying multi-second compile cost.
     */
    reset() {
        wasm.calciteengine_reset(this.__wbg_ptr);
    }
    /**
     * Restore a snapshot blob produced by [`snapshot`](Self::snapshot)
     * against the same cabinet. Returns an error if the blob is malformed
     * or the cabinet's state shape doesn't match the snapshot.
     * @param {Uint8Array} blob
     */
    restore(blob) {
        const ptr0 = passArray8ToWasm0(blob, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.calciteengine_restore(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Run a batch of ticks WITHOUT computing the per-batch state-var diff.
     *
     * `tick_batch` returns the changed state vars as a JSON string for
     * callers (debug-server, conformance harness) that consume them.
     * The web bridge ignores the returned JSON — it observes state via
     * `get_state_var` / `read_framebuffer_rgba` after each batch instead.
     * On large cabinets the diff is non-trivial (doom8088: ~10K state
     * vars, full O(N) sweep each batch), and the JSON formatting on top
     * of that adds another ~5-10% per batch.
     *
     * This entry point skips both. Same correctness contract as
     * `tick_batch` for state advancement; just doesn't synthesize the
     * JSON return.
     * @param {number} count
     */
    run_batch_silent(count) {
        wasm.calciteengine_run_batch_silent(this.__wbg_ptr, count);
    }
    /**
     * Run `count` ticks while polling the watch registry every
     * `chunk_ticks` ticks. Returns true if a watch requested halt
     * before `count` ticks elapsed; false otherwise. The host drains
     * events via `drain_measurements` after this returns.
     *
     * Use `chunk_ticks = 0` to disable chunking (single big batch with
     * one final poll).
     * @param {number} count
     * @param {number} chunk_ticks
     * @returns {boolean}
     */
    run_batch_watched(count, chunk_ticks) {
        const ret = wasm.calciteengine_run_batch_watched(this.__wbg_ptr, count, chunk_ticks);
        return ret !== 0;
    }
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
     * (release) — calcite does not synthesise key-up automatically.
     * @param {string} pseudo
     * @param {string} selector
     * @param {boolean} value
     */
    set_pseudo_class_active(pseudo, selector, value) {
        const ptr0 = passStringToWasm0(pseudo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(selector, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.calciteengine_set_pseudo_class_active(this.__wbg_ptr, ptr0, len0, ptr1, len1, value);
    }
    /**
     * Serialise the runtime-mutable state (state_vars + memory + extended
     * + string_properties + frame_counter) to a byte blob. Pair with
     * [`restore`](Self::restore) on the same cabinet to resume execution
     * from this exact tick — useful for benchmarking a level-load window
     * without re-running boot/title/menu first.
     *
     * The blob is portable across calcite-cli and calcite-wasm and across
     * runs of the same cabinet, but NOT across cabinets (slot ordering is
     * per-parse).
     * @returns {Uint8Array}
     */
    snapshot() {
        const ret = wasm.calciteengine_snapshot(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Run a batch of ticks and return the property changes as a JSON string.
     *
     * Returns `[[name, value], ...]` pairs.
     * @param {number} count
     * @returns {string}
     */
    tick_batch(count) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.calciteengine_tick_batch(this.__wbg_ptr, count);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Number of registered watches.
     * @returns {number}
     */
    watch_count() {
        const ret = wasm.calciteengine_watch_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Has any watch requested a halt during the most recent poll?
     * @returns {boolean}
     */
    watch_halt_requested() {
        const ret = wasm.calciteengine_watch_halt_requested(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) CalciteEngine.prototype[Symbol.dispose] = CalciteEngine.prototype.free;

/**
 * Initialise the WASM module (sets up logging, etc.).
 */
export function init() {
    wasm.init();
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_2e59b1b37a9a34c3: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_is_undefined_c0cca72b82b86f4d: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_throw_81fc77679af83bc6: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_debug_50e24f25b064ded1: function(arg0) {
            console.debug(arg0);
        },
        __wbg_error_38bec0a78dd8ded8: function(arg0) {
            console.error(arg0);
        },
        __wbg_info_4e3339024d0fb613: function(arg0) {
            console.info(arg0);
        },
        __wbg_log_4c0baeb8af2f8f89: function(arg0) {
            console.log(arg0);
        },
        __wbg_new_4f9fafbb3909af72: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_f3c9df4f38f3f798: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_now_e7c6795a7f81e10f: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_performance_3fcf6e32a7e1ed0a: function(arg0) {
            const ret = arg0.performance;
            return ret;
        },
        __wbg_push_6bdbc990be5ac37b: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_set_8ee2d34facb8466e: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_static_accessor_GLOBAL_THIS_a1248013d790bf5f: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_f2e0f995a21329ff: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_24f78b6d23f286ea: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_59fd959c540fe405: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_warn_2b0a27f629a4bb1e: function(arg0) {
            console.warn(arg0);
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./calcite_wasm_bg.js": import0,
    };
}

const CalciteEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_calciteengine_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('calcite_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
