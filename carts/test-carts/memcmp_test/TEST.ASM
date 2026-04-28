; Test if calcite emulates repe cmpsw correctly across segment boundaries
; Set up: DS:SI = far buffer1 (a different segment from CS/SS).
; ES:DI = local buffer2.
; Both buffers contain "DPPISTOL".
; repe cmpsw with cx=4 should result in ZF=1.

org 0x100
bits 16
cpu 186

start:
    mov ah, 9
    mov dx, msg_start
    int 0x21

    ; Set up two buffers with same content.
    ; Buffer 1: in DATA segment (DS-relative).
    ; Buffer 2: also in DATA segment for the simple test.
    mov si, buffer1
    mov di, buffer2
    push ds
    pop es                ; ES = DS for the simple test
    mov cx, 4             ; 4 words = 8 bytes
    cld
    repe cmpsw
    jne not_equal

    mov ah, 9
    mov dx, msg_eq
    int 0x21
    jmp do_far_test

not_equal:
    mov ah, 9
    mov dx, msg_ne
    int 0x21

do_far_test:
    ; Now test with FAR buffer. Allocate a far segment via DOS allocate (INT 21h, AH=48h)
    mov ah, 0x48
    mov bx, 0x100         ; 256 paragraphs = 4KB
    int 0x21
    jc alloc_err
    mov [farseg], ax

    mov ah, 9
    mov dx, msg_alloc
    int 0x21

    ; Copy "DPPISTOL" to that far buffer
    mov es, [farseg]
    xor di, di
    mov si, buffer1
    mov cx, 8
    cld
    rep movsb             ; ES:DI <- DS:SI

    ; Now do far compare: DS:SI from local, ES:DI from far
    push ds
    mov ds, [farseg]
    xor si, si
    push cs
    pop es                ; ES = CS so we use CS:DI for buffer
    ; but we want ES:DI = local buffer. So set ES = original DS.
    mov ax, [csbuffer_ds]    ; load original DS (was CS in COM)
    pop es                ; oh, just pop instead
    ; Actually let me restart this part
    ; Need: DS:SI -> far buffer, ES:DI -> local buffer2
    pop ds                ; restore DS to original
    push ds
    pop es                ; ES = DS (= CS for COM)
    mov ds, [farseg]
    xor si, si
    mov di, buffer2
    mov cx, 4
    cld
    repe cmpsw
    pushf
    push ds               ; save far DS
    pop ax                ; just to discard
    push cs
    pop ds                ; restore DS = CS (for COM)
    popf
    jne far_not_equal

    mov ah, 9
    mov dx, msg_far_eq
    int 0x21
    jmp done

far_not_equal:
    mov ah, 9
    mov dx, msg_far_ne
    int 0x21

done:
    mov ax, 0x4C00
    int 0x21

alloc_err:
    mov ah, 9
    mov dx, msg_alloc_err
    int 0x21
    mov ax, 0x4C01
    int 0x21

msg_start:    db 'TEST CMPS',13,10,'$'
msg_eq:       db 'NEAR EQ',13,10,'$'
msg_ne:       db 'NEAR NE',13,10,'$'
msg_alloc:    db 'ALLOC OK',13,10,'$'
msg_alloc_err:db 'ALLOC ERR',13,10,'$'
msg_far_eq:   db 'FAR EQ',13,10,'$'
msg_far_ne:   db 'FAR NE',13,10,'$'
buffer1:      db 'DPPISTOL'
buffer2:      db 'DPPISTOL'
farseg:       resw 1
csbuffer_ds:  resw 1
