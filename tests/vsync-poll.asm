; Test: port 0x3DA (VGA input status 1) read decode.
; Reads 0x3DA via both IN AL, imm8 (0xE4) and IN AL, DX (0xEC),
; so kiln emits dispatch entries for both opcodes with q1: 986 and
; --__1DX: 986 respectively.
;
; This test is just to smoke-test the kiln emit — the program itself
; doesn't assert anything at runtime. Grep the emitted CSS for
; `q1: 986` and `--__1DX: 986` to confirm port 0x3DA is decoded.
org 0x100

    ; IN AL, imm8 — 0xE4 form, q1=0xDA
    in al, 0xDA

    ; IN AL, DX — 0xEC form, DX=0x3DA
    mov dx, 0x3DA
    in al, dx

    ; Exit.
    int 0x20
