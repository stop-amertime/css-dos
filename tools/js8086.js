'use strict';

let CPU_186 = 0;

// all peripherals must have:
//     isConnected(port)     - returns true if port is served
//     portIn(w, port)       - returns port data
//     portOut(w, port, val) - set port data to val
// Dummy peripheral
const i82xx = {
    isConnected: (port) => false,
    hasInt: () => false,
    tick: () => undefined
};

// m_write(addr, value) - memory write
// m_read(addr)         - memory read, returns byte from addr
// i8259 must have:
//     hasInt()  - returns true if pending interrupts
//     nextInt() - returns next pending interrupt or 0
// i8253 must have:
//     tick() - process one timer tick
// int_handler(type) - returns true if interrupt type processed
function Intel8086(m_write, m_read, i8259 = i82xx, i8253 = i82xx, int_handler = null) {
    const CF = 0x0001;
    const PF = 0x0004;
    const AF = 0x0010;
    const ZF = 0x0040;
    const SF = 0x0080;
    const TF = 0x0100;
    const IF = 0x0200;
    const DF = 0x0400;
    const OF = 0x0800;
    const B  = 0b0;
    const W  = 0b1;
    const AX = 0b000;
    const CX = 0b001;
    const DX = 0b010;
    const BX = 0b011;
    const MASK = [0xff, 0xffff];
    const PARITY = [
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
        1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1
    ];
    const BITS = [8, 16];
    const SIGN = [0x80, 0x8000];

    function msb(w, x) {
        return (x & SIGN[w]) == SIGN[w];
    }

    function shift(x, n) {
        return n >= 0 ? x << n : x >>> -n;
    }

    function signconv(w, x) {
        return x << 32 - BITS[w] >> 32 - BITS[w];
    }

    let ah = 0, al = 0;
    let ch = 0, cl = 0;
    let dh = 0, dl = 0;
    let bh = 0, bl = 0;
    let sp = 0;
    let bp = 0;
    let si = 0;
    let di = 0;
    let cs = 0;
    let ds = 0;
    let ss = 0;
    let es = 0;
    let os = null;
    let ip = 0;
    let flags = 0x02;

    const queue = [0, 0, 0, 0, 0, 0];

    const pic = i8259;
    const pit = i8253;

    const peripherals = [pic, pit];

    let op = 0;
    let d = 0;
    let w = 0;
    let mod = 0;
    let reg = 0;
    let rm = 0;
    let ea = 0;
    let clocks = 0;

    function adc(w, dst, src) {
        const carry = (flags & CF) == CF ? 1 : 0;
        const res = dst + src + carry & MASK[w];
        setFlag(CF, carry == 1 ? res <= dst : res < dst);
        setFlag(AF, ((res ^ dst ^ src) & AF) > 0);
        setFlag(OF, (shift((dst ^ src ^ -1) & (dst ^ res), 12 - BITS[w]) & OF) > 0);
        setFlags(w, res);
        return res;
    }

    function add(w, dst, src) {
        const res = dst + src & MASK[w];
        setFlag(CF, res < dst);
        setFlag(AF, ((res ^ dst ^ src) & AF) > 0);
        setFlag(OF, (shift((dst ^ src ^ -1) & (dst ^ res), 12 - BITS[w]) & OF) > 0);
        setFlags(w, res);
        return res;
    }

    function callInt(type) {
        if (int_handler !== null && int_handler(type))
            return;
        push(flags);
        setFlag(IF, false);
        setFlag(TF, false);
        push(cs);
        push(ip);
        ip = getMem(0b1, type * 4);
        cs = getMem(0b1, type * 4 + 2);
    }

    function dec(w, dst) {
        const res = dst - 1 & MASK[w];
        setFlag(AF, ((res ^ dst ^ 1) & AF) > 0);
        setFlag(OF, res == SIGN[w] - 1);
        setFlags(w, res);
        return res;
    }

    function decode() {
        mod = queue[1] >>> 6 & 0b11;
        reg = queue[1] >>> 3 & 0b111;
        rm  = queue[1]       & 0b111;
        if (mod == 0b01)
            ip = ip + 2 & 0xffff;
        else if (mod == 0b00 && rm == 0b110 || mod == 0b10)
            ip = ip + 3 & 0xffff;
        else
            ip = ip + 1 & 0xffff;
    }

    function getAddr(seg, off) {
        return ((seg === null ? ds : seg) << 4) + off;
    }

    function getEA(mod, rm) {
        let disp = 0;
        if (mod == 0b01) {
            clocks += 4;
            disp = signconv(B, queue[2]);
        } else if (mod == 0b10) {
            clocks += 4;
            disp = signconv(W, queue[3] << 8 | queue[2]);
        }
        let ea = 0;
        switch (rm) {
        case 0b000: // EA = (BX) + (SI) + DISP
            clocks += 7;
            ea = (bh << 8 | bl) + si + disp; if (os === null) os = ds;
            break;
        case 0b001: // EA = (BX) + (DI) + DISP
            clocks += 8;
            ea = (bh << 8 | bl) + di + disp; if (os === null) os = ds;
            break;
        case 0b010: // EA = (BP) + (SI) + DISP
            clocks += 8;
            ea = bp + si + disp; if (os === null) os = ss;
            break;
        case 0b011: // EA = (BP) + (DI) + DISP
            clocks += 7;
            ea = bp + di + disp; if (os === null) os = ss;
            break;
        case 0b100: // EA = (SI) + DISP
            clocks += 5;
            ea = si + disp; if (os === null) os = ds;
            break;
        case 0b101: // EA = (DI) + DISP
            clocks += 5;
            ea = di + disp; if (os === null) os = ds;
            break;
        case 0b110:
            if (mod == 0b00) { // EA = (IMM:IMM)
                clocks += 6;
                ea = queue[3] << 8 | queue[2]; if (os === null) os = ds;
            } else {           // EA = (BP) + DISP
                clocks += 5;
                ea = bp + disp; if (os === null) os = ss;
            }
            break;
        case 0b111: // EA = (BX) + DISP
            clocks += 5;
            ea = (bh << 8 | bl) + disp; if (os === null) os = ds;
            break;
        }
        return (os << 4) + (ea & 0xffff);
    }

    function getFlag(flag) {
        return (flags & flag) > 0;
    }

    function getMem(w, addr) {
        if (addr === undefined) {
            addr = getAddr(cs, ip);
            let val = m_read(addr);
            if (w == W)
                val |= m_read(addr + 1) << 8;
            ip = ip + 1 + w & 0xffff;
            return val;
        }
        let val = m_read(addr);
        if (w == W) {
            if ((addr & 0b1) == 0b1)
                clocks += 4;
            val |= m_read(addr + 1) << 8;
        }
        return val;
    }

    function setMem(w, addr, val) {
        m_write(addr, val & 0xff);
        if (w == W) {
            if ((addr & 0b1) == 0b1)
                clocks += 4;
            m_write(addr + 1, val >>> 8 & 0xff);
        }
    }

    function getReg(w, reg) {
        if (w == B)
            switch (reg) {
            case 0b000: // AL
                return al;
            case 0b001: // CL
                return cl;
            case 0b010: // DL
                return dl;
            case 0b011: // BL
                return bl;
            case 0b100: // AH
                return ah;
            case 0b101: // CH
                return ch;
            case 0b110: // DH
                return dh;
            case 0b111: // BH
                return bh;
            }
        else
            switch (reg) {
            case 0b000: // AX
                return ah << 8 | al;
            case 0b001: // CX
                return ch << 8 | cl;
            case 0b010: // DX
                return dh << 8 | dl;
            case 0b011: // BX
                return bh << 8 | bl;
            case 0b100: // SP
                return sp;
            case 0b101: // BP
                return bp;
            case 0b110: // SI
                return si;
            case 0b111: // DI
                return di;
            }
        return 0;
    }

    function getRM(w, mod, rm) {
        if (mod == 0b11)
            return getReg(w, rm);
        else
            return getMem(w, ea > 0 ? ea : getEA(mod, rm));
    }

    function getSegReg(reg) {
        switch (reg) {
        case 0b00: // ES
            return es;
        case 0b01: // CS
            return cs;
        case 0b10: // SS
            return ss;
        case 0b11: // DS
            return ds;
        }
        return 0;
    }

    function inc(w, dst) {
        const res = dst + 1 & MASK[w];
        setFlag(AF, ((res ^ dst ^ 1) & AF) > 0);
        setFlag(OF, res == SIGN[w]);
        setFlags(w, res);
        return res;
    }

    function logic(w, res) {
        setFlag(CF, false);
        setFlag(OF, false);
        setFlags(w, res);
    }

    function pop() {
        const val = getMem(W, getAddr(ss, sp));
        sp = sp + 2 & 0xffff;
        return val;
    }

    function portIn(w, port) {
        for (let i = 0; i < peripherals.length; i++) {
            const peripheral = peripherals[i];
            if (peripheral.isConnected(port))
                return peripheral.portIn(w, port);
        }
        return 0x00;
    }

    function portOut(w, port, val) {
        for (let i = 0; i < peripherals.length; i++) {
            const peripheral = peripherals[i];
            if (peripheral.isConnected(port)) {
                peripheral.portOut(w, port, val);
                break;
            }
        }
    }

    function push(val) {
        sp = sp - 2 & 0xffff;
        setMem(W, getAddr(ss, sp), val);
    }

    function sbb(w, dst, src) {
        const carry = (flags & CF) == CF ? 1 : 0;
        const res = dst - src - carry & MASK[w];
        setFlag(CF, carry > 0 ? dst <= src : dst < src);
        setFlag(AF, ((res ^ dst ^ src) & AF) > 0);
        setFlag(OF, (shift((dst ^ src) & (dst ^ res), 12 - BITS[w]) & OF) > 0);
        setFlags(w, res);
        return res;
    }

    function setFlag(flag, set) {
        if (set)
            flags |= flag;
        else {
            flags &= ~flag;
            flags |= 0x02;
        }
    }

    function setFlags(w, res) {
        setFlag(PF, PARITY[res & 0xff] > 0);
        setFlag(ZF, res == 0);
        setFlag(SF, (shift(res, 8 - BITS[w]) & SF) > 0);
    }

    function setReg(w, reg, val) {
        if (w == B)
            switch (reg) {
            case 0b000: // AL
                al = val & 0xff;
                break;
            case 0b001: // CL
                cl = val & 0xff;
                break;
            case 0b010: // DL
                dl = val & 0xff;
                break;
            case 0b011: // BL
                bl = val & 0xff;
                break;
            case 0b100: // AH
                ah = val & 0xff;
                break;
            case 0b101: // CH
                ch = val & 0xff;
                break;
            case 0b110: // DH
                dh = val & 0xff;
                break;
            case 0b111: // BH
                bh = val & 0xff;
                break;
            }
        else
            switch (reg) {
            case 0b000: // AX
                al = val & 0xff;
                ah = val >>> 8 & 0xff;
                break;
            case 0b001: // CX
                cl = val & 0xff;
                ch = val >>> 8 & 0xff;
                break;
            case 0b010: // DX
                dl = val & 0xff;
                dh = val >>> 8 & 0xff;
                break;
            case 0b011: // BX
                bl = val & 0xff;
                bh = val >>> 8 & 0xff;
                break;
            case 0b100: // SP
                sp = val & 0xffff;
                break;
            case 0b101: // BP
                bp = val & 0xffff;
                break;
            case 0b110: // SI
                si = val & 0xffff;
                break;
            case 0b111: // DI
                di = val & 0xffff;
                break;
            }
    }

    function setRM(w, mod, rm, val) {
        if (mod == 0b11)
            setReg(w, rm, val);
        else
            setMem(w, ea > 0 ? ea : getEA(mod, rm), val);
    }

    function setSegReg(reg, val) {
        switch (reg) {
        case 0b00: // ES
            es = val & 0xffff;
            break;
        case 0b01: // CS
            cs = val & 0xffff;
            break;
        case 0b10: // SS
            ss = val & 0xffff;
            break;
        case 0b11: // DS
            ds = val & 0xffff;
            break;
        }
    }

    function sub(w, dst, src) {
        const res = dst - src & MASK[w];
        setFlag(CF, dst < src);
        setFlag(AF, ((res ^ dst ^ src) & AF) > 0);
        setFlag(OF, (shift((dst ^ src) & (dst ^ res), 12 - BITS[w]) & OF) > 0);
        setFlags(w, res);
        return res;
    }

    function step() {
        if (getFlag(TF)) {
            callInt(1);
            clocks += 50;
        }
        if (getFlag(IF) && pic.hasInt()) {
            callInt(pic.nextInt());
            clocks += 61;
        }
        os = null;
        let rep = 0,
            ip_start = ip;
        prefixes: while (true) {
            switch (getMem(B)) {
            case 0x26: // ES: (segment override prefix)
                os = es;
                clocks += 2;
                break;
            case 0x2e: // CS: (segment override prefix)
                os = cs;
                clocks += 2;
                break;
            case 0x36: // SS: (segment override prefix)
                os = ss;
                clocks += 2;
                break;
            case 0x3e: // DS: (segment override prefix)
                os = ds;
                clocks += 2;
                break;
            case 0xf2: // REPNE/REPNZ
                rep = 2;
                clocks += 9;
                break;
            case 0xf3: // REP/REPE/REPZ
                rep = 1;
                clocks += 9;
                break;
            default:
                ip = ip - 1 & 0xffff;
                break prefixes;
            }
        }
        for (let i = 0; i < 6; ++i)
            queue[i] = getMem(B, getAddr(cs, ip + i));
        op = queue[0];
        d  = op >>> 1 & 0b1;
        w  = op       & 0b1;
        ip = ip + 1 & 0xffff; // Increment IP.
        switch (op) {
        case 0xa4: // MOVS
        case 0xa5:
        case 0xaa: // STOS
        case 0xab:
            if (rep == 0)
                ++clocks;
            break;
        case 0x6c: // INS
        case 0x6d:
        case 0x6e: // OUTS
        case 0x6f:
        case 0xa6: // CMPS
        case 0xa7:
        case 0xae: // SCAS
        case 0xaf:
            break;
        case 0xac: // LODS
        case 0xad:
            if (rep == 0)
                --clocks;
            break;
        default:
            rep = 0;
            break;
        }
        do {
            if (rep > 0) {
                const cx = getReg(W, CX);
                if (cx == 0)
                    break;
                setReg(W, CX, cx - 1);
            }
            while (clocks > 3) {
                clocks -= 4;
                pit.tick();
            }
            ea = -1; // Reset stored EA.
            let dst, src, res;
            switch (op) {
            case 0x88: // MOV REG8/MEM8,REG8
            case 0x89: // MOV REG16/MEM16,REG16
            case 0x8a: // MOV REG8,REG8/MEM8
            case 0x8b: // MOV REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    src = getReg(w, reg);
                    setRM(w, mod, rm, src);
                    clocks += mod == 0b11 ? 2 : 9;
                } else {
                    src = getRM(w, mod, rm);
                    setReg(w, reg, src);
                    clocks += mod == 0b11 ? 2 : 8;
                }
                break;
            case 0xc6: // MOV REG8/MEM8,IMMED8
            case 0xc7: // MOV REG16/MEM16,IMMED16
                decode();
                switch (reg) {
                case 0b000:
                    src = getMem(w);
                    setRM(w, mod, rm, src);
                }
                clocks += mod == 0b11 ? 4 : 10;
                break;
            case 0xb0: // MOV AL,IMMED8
            case 0xb1: // MOV CL,IMMED8
            case 0xb2: // MOV DL,IMMED8
            case 0xb3: // MOV BL,IMMED8
            case 0xb4: // MOV AH,IMMED8
            case 0xb5: // MOV CH,IMMED8
            case 0xb6: // MOV DH,IMMED8
            case 0xb7: // MOV BH,IMMED8
            case 0xb8: // MOV AX,IMMED16
            case 0xb9: // MOV CX,IMMED16
            case 0xba: // MOV DX,IMMED16
            case 0xbb: // MOV BX,IMMED16
            case 0xbc: // MOV SP,IMMED16
            case 0xbd: // MOV BP,IMMED16
            case 0xbe: // MOV SI,IMMED16
            case 0xbf: // MOV DI,IMMED16
                w   = op >>> 3 & 0b1;
                reg = op       & 0b111;
                src = getMem(w);
                setReg(w, reg, src);
                clocks += 4;
                break;
            case 0xa0: // MOV AL,MEM8
            case 0xa1: // MOV AX,MEM16
            case 0xa2: // MOV MEM8,AL
            case 0xa3: // MOV MEM16,AX
                dst = getMem(W);
                if (d == 0b0) {
                    src = getMem(w, getAddr(os, dst));
                    setReg(w, AX, src);
                } else {
                    src = getReg(w, AX);
                    setMem(w, getAddr(os, dst), src);
                }
                clocks += 10;
                break;
            case 0x8c: // MOV REG16/MEM16,SEGREG
            case 0x8e: // MOV SEGREG,REG16/MEM16
                decode();
                if (d == 0b0) {
                    src = getSegReg(reg);
                    setRM(W, mod, rm, src);
                    clocks += mod == 0b11 ? 2 : 9;
                } else {
                    src = getRM(W, mod, rm);
                    setSegReg(reg, src);
                    clocks += mod == 0b11 ? 2 : 8;
                }
                break;
            case 0x50: // PUSH AX
            case 0x51: // PUSH CX
            case 0x52: // PUSH DX
            case 0x53: // PUSH BX
            case 0x54: // PUSH SP
            case 0x55: // PUSH BP
            case 0x56: // PUSH SI
            case 0x57: // PUSH DI
                reg = op & 0b111;
                src = getReg(W, reg);
                if (op === 0x54)
                    src = src - 2 & 0xffff;
                push(src);
                clocks += 11;
                break;
            case 0x06: // PUSH ES
            case 0x0e: // PUSH CS
            case 0x16: // PUSH SS
            case 0x1e: // PUSH DS
                reg = op >>> 3 & 0b111;
                src = getSegReg(reg);
                push(src);
                clocks += 10;
                break;
            case 0x58: // POP AX
            case 0x59: // POP CX
            case 0x5a: // POP DX
            case 0x5b: // POP BX
            case 0x5c: // POP SP
            case 0x5d: // POP BP
            case 0x5e: // POP SI
            case 0x5f: // POP DI
                reg = op & 0b111;
                src = pop();
                setReg(W, reg, src);
                clocks += 8;
                break;
            case 0x07: // POP ES
            case 0x0f: // POP CS
            case 0x17: // POP SS
            case 0x1f: // POP DS
                reg = op >>> 3 & 0b111;
                src = pop();
                setSegReg(reg, src);
                clocks += 8;
                break;
            case 0x86: // XCHG REG8,REG8/MEM8
            case 0x87: // XCHG REG16,REG16/MEM16
                decode();
                dst = getReg(w, reg);
                src = getRM(w, mod, rm);
                setReg(w, reg, src);
                setRM(w, mod, rm, dst);
                clocks += mod == 0b11 ? 3 : 17;
                break;
            case 0x91: // XCHG AX,CX
            case 0x92: // XCHG AX,DX
            case 0x93: // XCHG AX,BX
            case 0x94: // XCHG AX,SP
            case 0x95: // XCHG AX,BP
            case 0x96: // XCHG AX,SI
            case 0x97: // XCHG AX,DI
                reg = op & 0b111;
                dst = getReg(W, AX);
                src = getReg(W, reg);
                setReg(W, AX, src);
                setReg(W, reg, dst);
                clocks += 3;
                break;
            case 0xd7: // XLAT SOURCE-TABLE
                al = getMem(B, getAddr(os, getReg(W, BX) + al));
                clocks += 11;
                break;
            case 0xe4: // IN AL,IMMED8
            case 0xe5: // IN AX,IMMED8
                src = getMem(B);
                setReg(w, AX, portIn(w, src));
                clocks += 10;
                if (w == W && (src & 0b1) == 0b1)
                    clocks += 4;
                break;
            case 0xec: // IN AL,DX
            case 0xed: // IN AX,DX
                src = getReg(W, DX);
                setReg(w, AX, portIn(w, src));
                clocks += 8;
                if (w == W && (src & 0b1) == 0b1)
                    clocks += 4;
                break;
            case 0xe6: // OUT AL,IMMED8
            case 0xe7: // OUT AX,IMMED8
                src = getMem(B);
                portOut(w, src, getReg(w, AX));
                clocks += 10;
                if (w == W && (src & 0b1) == 0b1)
                    clocks += 4;
                break;
            case 0xee: // OUT AL,DX
            case 0xef: // OUT AX,DX
                src = getReg(W, DX);
                portOut(w, src, getReg(w, AX));
                clocks += 8;
                if (w == W && (src & 0b1) == 0b1)
                    clocks += 4;
                break;
            case 0x8d: // LEA REG16,MEM16
                decode();
                src = getEA(mod, rm) - ((os === null ? ds : os) << 4);
                setReg(W, reg, src);
                clocks += 2;
                break;
            case 0xc5: // LDS REG16,MEM32
                decode();
                src = getEA(mod, rm);
                setReg(W, reg, getMem(W, src));
                ds = getMem(W, src + 2);
                clocks += 16;
                break;
            case 0xc4: // LES REG16,MEM32
                decode();
                src = getEA(mod, rm);
                setReg(W, reg, getMem(W, src));
                es = getMem(W, src + 2);
                clocks += 16;
                break;
            case 0x9f: // LAHF
                ah = flags & 0xff;
                clocks += 4;
                break;
            case 0x9e: // SAHF
                flags = flags & 0xff00 | (ah & 0xd7) | 0x02;
                clocks += 4;
                break;
            case 0x9c: // PUSHF
                push(flags);
                clocks += 10;
                break;
            case 0x9d: // POPF
                flags = (pop() & 0xfd7) | 0x02;
                clocks += 8;
                break;
            case 0x00: // ADD REG8/MEM8,REG8
            case 0x01: // ADD REG16/MEM16,REG16
            case 0x02: // ADD REG8,REG8/MEM8
            case 0x03: // ADD REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = add(w, dst, src);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x04: // ADD AL,IMMED8
            case 0x05: // ADD AX,IMMED16
                dst = getReg(w, 0);
                src = getMem(w);
                res = add(w, dst, src);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x10: // ADC REG8/MEM8,REG8
            case 0x11: // ADC REG16/MEM16,REG16
            case 0x12: // ADC REG8,REG8/MEM8
            case 0x13: // ADC REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = adc(w, dst, src);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x14: // ADC AL,IMMED8
            case 0x15: // ADC AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                res = adc(w, dst, src);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x40: // INC AX
            case 0x41: // INC CX
            case 0x42: // INC DX
            case 0x43: // INC BX
            case 0x44: // INC SP
            case 0x45: // INC BP
            case 0x46: // INC SI
            case 0x47: // INC DI
                reg = op & 0b111;
                src = getReg(W, reg);
                res = inc(W, src);
                setReg(W, reg, res);
                clocks += 2;
                break;
            case 0x37: // AAA
                if ((al & 0xf) > 9 || getFlag(AF)) {
                    al += 6;
                    ah = ah + 1 & 0xff;
                    setFlag(CF, true);
                    setFlag(AF, true);
                } else {
                    setFlag(CF, false);
                    setFlag(AF, false);
                }
                al &= 0xf;
                setFlags(B, al);
                clocks += 4;
                break;
            case 0x27: { // DAA
                const oldAL = al;
                const oldCF = getFlag(CF);
                setFlag(CF, false);
                if ((al & 0xf) > 9 || getFlag(AF)) {
                    al += 6;
                    setFlag(CF, oldCF || al < 0);
                    al &= 0xff;
                    setFlag(AF, true);
                } else
                    setFlag(AF, false);
                if (oldAL > 0x99 || oldCF) {
                    al = al + 0x60 & 0xff;
                    setFlag(CF, true);
                } else
                    setFlag(CF, false);
                setFlags(B, al);
                clocks += 4;
                break;
            }
            case 0x28: // SUB REG8/MEM8,REG8
            case 0x29: // SUB REG16/MEM16,REG16
            case 0x2a: // SUB REG8,REG8/MEM8
            case 0x2b: // SUB REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = sub(w, dst, src);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x2c: // SUB AL,IMMED8
            case 0x2d: // SUB AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                res = sub(w, dst, src);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x18: // SBB REG8/MEM8,REG8
            case 0x19: // SBB REG16/MEM16,REG16
            case 0x1a: // SBB REG8,REG8/MEM8
            case 0x1b: // SBB REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = sbb(w, dst, src);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x1c: // SBB AL,IMMED8
            case 0X1d: // SBB AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                res = sbb(w, dst, src);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x48: // DEC AX
            case 0x49: // DEC CX
            case 0x4a: // DEC DX
            case 0x4b: // DEC BX
            case 0x4c: // DEC SP
            case 0x4d: // DEC BP
            case 0x4e: // DEC SI
            case 0x4f: // DEC DI
                reg = op & 0b111;
                dst = getReg(W, reg);
                res = dec(W, dst);
                setReg(W, reg, res);
                clocks += 2;
                break;
            case 0x38: // CMP REG8/MEM8,REG8
            case 0x39: // CMP REG16/MEM16,REG16
            case 0x3a: // CMP REG8,REG8/MEM8
            case 0x3b: // CMP REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                sub(w, dst, src);
                clocks += mod == 0b11 ? 3 : 9;
                break;
            case 0x3c: // CMP AL,IMMED8
            case 0x3d: // CMP AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                sub(w, dst, src);
                clocks += 4;
                break;
            case 0x3f: // AAS
                if ((al & 0xf) > 9 || getFlag(AF)) {
                    al -= 6;
                    ah = ah - 1 & 0xff;
                    setFlag(CF, true);
                    setFlag(AF, true);
                } else {
                    setFlag(CF, false);
                    setFlag(AF, false);
                }
                al &= 0xf;
                setFlags(B, al);
                clocks += 4;
                break;
            case 0x2f: // DAS
                const oldAL = al;
                const oldCF = getFlag(CF);
                setFlag(CF, false);
                if ((al & 0xf) > 9 || getFlag(AF)) {
                    al -= 6;
                    setFlag(CF, oldCF || (al & 0xff) > 0);
                    al &= 0xff;
                    setFlag(AF, true);
                } else
                    setFlag(AF, false);
                if (oldAL > 0x99 || oldCF) {
                    al = al - 0x60 & 0xff;
                    setFlag(CF, true);
                } else
                    setFlag(CF, false);
                setFlags(B, al);
                clocks += 4;
                break;
            case 0xd4: // AAM
                src = getMem(B);
                if (src == 0) {
                    ip = ip_start;
                    callInt(0);
                } else {
                    ah = al / src & 0xff;
                    al = al % src & 0xff;
                    setFlags(B, al);
                    clocks += 83;
                }
                break;
            case 0xd5: // AAD
                src = getMem(B);
                al = ah * src + al & 0xff;
                ah = 0;
                setFlags(B, al);
                setFlag(CF, false);
                setFlag(OF, false);
                clocks += 60;
                break;
            case 0x98: // CBW
                if ((al & 0x80) == 0x80)
                    ah = 0xff;
                else
                    ah = 0x00;
                clocks += 2;
                break;
            case 0x99: // CWD
                if ((ah & 0x80) == 0x80)
                    setReg(W, DX, 0xffff);
                else
                    setReg(W, DX, 0x0000);
                clocks += 5;
                break;
            case 0x20: // AND REG8/MEM8,REG8
            case 0x21: // AND REG16/MEM16,REG16
            case 0x22: // AND REG8,REG8/MEM8
            case 0x23: // AND REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = dst & src;
                logic(w, res);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x24: // AND AL,IMMED8
            case 0x25: // AND AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                res = dst & src;
                logic(w, res);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x08: // OR REG8/MEM8,REG8
            case 0x09: // OR REG16/MEM16,REG16
            case 0x0a: // OR REG8,REG8/MEM8
            case 0x0b: // OR REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = dst | src;
                logic(w, res);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x0c: // OR AL,IMMED8
            case 0x0d: // OR AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                res = dst | src;
                logic(w, res);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x30: // XOR REG8/MEM8,REG8
            case 0x31: // XOR REG16/MEM16,REG16
            case 0x32: // XOR REG8,REG8/MEM8
            case 0x33: // XOR REG16,REG16/MEM16
                decode();
                if (d == 0b0) {
                    dst = getRM(w, mod, rm);
                    src = getReg(w, reg);
                } else {
                    dst = getReg(w, reg);
                    src = getRM(w, mod, rm);
                }
                res = dst ^ src;
                logic(w, res);
                if (d == 0b0) {
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 16;
                } else {
                    setReg(w, reg, res);
                    clocks += mod == 0b11 ? 3 : 9;
                }
                break;
            case 0x34: // XOR AL,IMMED8
            case 0x35: // XOR AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                res = dst ^ src;
                logic(w, res);
                setReg(w, AX, res);
                clocks += 4;
                break;
            case 0x84: // TEST REG8/MEM8,REG8
            case 0x85: // TEST REG16/MEM16,REG16
                decode();
                dst = getRM(w, mod, rm);
                src = getReg(w, reg);
                logic(w, dst & src);
                clocks += mod == 0b11 ? 3 : 9;
                break;
            case 0xa8: // TEST AL,IMMED8
            case 0xa9: // TEST AX,IMMED16
                dst = getReg(w, AX);
                src = getMem(w);
                logic(w, dst & src);
                clocks += 4;
                break;
            case 0xa4: // MOVS DEST-STR8,SRC-STR8
            case 0xa5: // MOVS DEST-STR16,SRC-STR16
                src = getMem(w, getAddr(os, si));
                setMem(w, getAddr(es, di), src);
                si = si + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                di = di + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                clocks += 17;
                break;
            case 0xa6: // CMPS DEST-STR8,SRC-STR8
            case 0xa7: // CMPS DEST-STR16,SRC-STR16
                dst = getMem(w, getAddr(es, di));
                src = getMem(w, getAddr(os, si));
                sub(w, src, dst);
                si = si + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                di = di + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                if (rep == 1 && !getFlag(ZF) || rep == 2 && getFlag(ZF))
                    rep = 0;
                clocks += 22;
                break;
            case 0xae: // SCAS DEST-STR8
            case 0xaf: // SCAS DEST-STR16
                dst = getMem(w, getAddr(es, di));
                src = getReg(w, AX);
                sub(w, src, dst);
                di = di + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                if (rep == 1 && !getFlag(ZF) || rep == 2 && getFlag(ZF))
                    rep = 0;
                clocks += 15;
                break;
            case 0xac: // LODS SRC-STR8
            case 0xad: // LODS SRC-STR16
                src = getMem(w, getAddr(os, si));
                setReg(w, AX, src);
                si = si + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                clocks += 13;
                break;
            case 0xaa: // STOS DEST-STR8
            case 0xab: // STOS DEST-STR16
                src = getReg(w, AX);
                setMem(w, getAddr(es, di), src);
                di = di + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                clocks += 10;
                break;
            case 0xe8: // CALL NEAR-PROC
                dst = getMem(W);
                dst = signconv(W, dst);
                push(ip);
                ip = ip + dst & 0xffff;
                clocks += 19;
                break;
            case 0x9a: // CALL FAR-PROC
                dst = getMem(W);
                src = getMem(W);
                push(cs);
                push(ip);
                ip = dst;
                cs = src;
                clocks += 28;
                break;
            case 0xc3: // RET (intrasegment)
                ip = pop();
                clocks += 8;
                break;
            case 0xc2: // RET IMMED16 (intraseg)
                src = getMem(W);
                ip = pop();
                sp += src;
                clocks += 12;
                break;
            case 0xcb: // RET (intersegment)
                ip = pop();
                cs = pop();
                clocks += 18;
                break;
            case 0xca: // RET IMMED16 (intersegment)
                src = getMem(W);
                ip = pop();
                cs = pop();
                sp += src;
                clocks += 17;
                break;
            case 0xe9: // JMP NEAR-LABEL
                dst = getMem(W);
                dst = signconv(W, dst);
                ip = ip + dst & 0xffff;
                clocks += 15;
                break;
            case 0xeb: // JMP SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                ip = ip + dst & 0xffff;
                clocks += 15;
                break;
            case 0xea: // JMP FAR-LABEL
                dst = getMem(W);
                src = getMem(W);
                ip = dst;
                cs = src;
                clocks += 15;
                break;
            case 0x70: // JO SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(OF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x71: // JNO SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!getFlag(OF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x72: // JB/JNAE/JC SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(CF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x73: // JNB/JAE/JNC SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!getFlag(CF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x74: // JE/JZ SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(ZF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x75: // JNE/JNZ SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!getFlag(ZF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x76: // JBE/JNA SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(CF) | getFlag(ZF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x77: // JNBE/JA SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!(getFlag(CF) | getFlag(ZF))) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x78: // JS SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(SF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x79: // JNS SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!getFlag(SF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x7a: // JP/JPE SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(PF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x7b: // JNP/JPO SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!getFlag(PF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x7c: // JL/JNGE SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(SF) ^ getFlag(OF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x7d: // JNL/JGE SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!(getFlag(SF) ^ getFlag(OF))) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x7e: // JLE/JNG SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getFlag(SF) ^ getFlag(OF) | getFlag(ZF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0x7f: // JNLE/JG SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (!(getFlag(SF) ^ getFlag(OF) | getFlag(ZF))) {
                    ip = ip + dst & 0xffff;
                    clocks += 16;
                } else
                    clocks += 4;
                break;
            case 0xe2: // LOOP SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                src = getReg(W, CX) - 1 & 0xffff;
                setReg(W, CX, src);
                if (src != 0) {
                    ip = ip + dst & 0xffff;
                    clocks += 17;
                } else
                    clocks += 5;
                break;
            case 0xe1: // LOOPE/LOOPZ SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                src = getReg(W, CX) - 1 & 0xffff;
                setReg(W, CX, src);
                if (src != 0 && getFlag(ZF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 18;
                } else
                    clocks += 6;
                break;
            case 0xe0: // LOOPNE/LOOPNZ SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                src = getReg(W, CX) - 1 & 0xffff;
                setReg(W, CX, src);
                if (src != 0 && !getFlag(ZF)) {
                    ip = ip + dst & 0xffff;
                    clocks += 19;
                } else
                    clocks += 5;
                break;
            case 0xe3: // JCXZ SHORT-LABEL
                dst = getMem(B);
                dst = signconv(B, dst);
                if (getReg(W, CX) == 0) {
                    ip = ip + dst & 0xffff;
                    clocks += 18;
                } else
                    clocks += 6;
                break;
            case 0xcc: // INT 3
            case 0xcd: // INT IMMED8
                callInt(op == 0xcc ? 3 : getMem(B));
                clocks += op == 0xcc ? 52 : 51;
                break;
            case 0xce: // INTO
                if (getFlag(OF)) {
                    callInt(4);
                    clocks += 53;
                } else
                    clocks += 4;
                break;
            case 0xcf: // IRET
                ip = pop();
                cs = pop();
                flags = (pop() & 0xfd7) | 0x02;
                clocks += 24;
                break;
            case 0xf8: // CLC
                setFlag(CF, false);
                clocks += 2;
                break;
            case 0xf5: // CMC
                setFlag(CF, !getFlag(CF));
                clocks += 2;
                break;
            case 0xf9: // STC
                setFlag(CF, true);
                clocks += 2;
                break;
            case 0xfc: // CLD
                setFlag(DF, false);
                clocks += 2;
                break;
            case 0xfd: // STD
                setFlag(DF, true);
                clocks += 2;
                break;
            case 0xfa: // CLI
                setFlag(IF, false);
                clocks += 2;
                break;
            case 0xfb: // STI
                setFlag(IF, true);
                clocks += 2;
                break;
            case 0xf4: // HLT
                ip = ip_start; // stop execution
                clocks += 2;
                return false;
            case 0x9b: // WAIT
                clocks += 3;
                break;
            case 0xd8: // ESC 0,SOURCE
            case 0xd9: // ESC 1,SOURCE
            case 0xda: // ESC 2,SOURCE
            case 0xdb: // ESC 3,SOURCE
            case 0xdc: // ESC 4,SOURCE
            case 0xdd: // ESC 5,SOURCE
            case 0xde: // ESC 6,SOURCE
            case 0xdf: // ESC 7,SOURCE
                decode();
                clocks += mod == 0b11 ? 2 : 8;
                break;
            case 0xf0: // LOCK
                clocks += 2;
                break;
            case 0x90: // NOP
                clocks += 3;
                break;
            case 0x80:
            case 0x81:
            case 0x82:
            case 0x83:
                decode();
                dst = getRM(w, mod, rm);
                src = getMem(B);
                if (op == 0x81)
                    src |= getMem(B) << 8;
                else if (op == 0x83 && (src & SIGN[B]) > 0)
                    src |= 0xff00;
                switch (reg) {
                case 0b000: // ADD
                    res = add(w, dst, src);
                    setRM(w, mod, rm, res);
                    break;
                case 0b001: // OR
                    res = dst | src;
                    logic(w, res);
                    setRM(w, mod, rm, res);
                    break;
                case 0b010: // ADC
                    res = adc(w, dst, src);
                    setRM(w, mod, rm, res);
                    break;
                case 0b011: // SBB
                    res = sbb(w, dst, src);
                    setRM(w, mod, rm, res);
                    break;
                case 0b100: // AND
                    res = dst & src;
                    logic(w, res);
                    setRM(w, mod, rm, res);
                    break;
                case 0b101: // SUB
                    res = sub(w, dst, src);
                    setRM(w, mod, rm, res);
                    break;
                case 0b110: // XOR
                    res = dst ^ src;
                    logic(w, res);
                    setRM(w, mod, rm, res);
                    break;
                case 0b111: // CMP
                    sub(w, dst, src);
                    if (mod == 0b11)
                        clocks -= 7;
                    break;
                }
                clocks += mod == 0b11 ? 4 : 17;
                break;
            case 0x8f:
                decode();
                switch (reg) {
                case 0b000: // POP
                    src = pop();
                    setRM(w, mod, rm, src);
                    break;
                }
                clocks += mod == 0b11 ? 8 : 17;
                break;
            case 0xc0:
            case 0xc1:
                if (CPU_186 === 0)
                    throw new Error(`8086: ${op.toString(16).padStart(2, '0')}`);
            case 0xd0:
            case 0xd1:
            case 0xd2:
            case 0xd3:
                decode();
                dst = getRM(w, mod, rm);
                if (op === 0xc0 || op === 0xc1)
                    src = getMem(B);
                else
                    src = op == 0xd0 || op == 0xd1 ? 1 : cl & 0b11111;
                let tempCF;
                switch (reg) {
                case 0b000: // ROL
                    for (let cnt = 0; cnt < src; ++cnt) {
                        tempCF = msb(w, dst);
                        dst <<= 1;
                        dst |= tempCF ? 0b1 : 0b0;
                        dst &= MASK[w];
                    }
                    if (src > 0) {
                        setFlag(CF, (dst & 0b1) == 0b1);
                        setFlag(OF, msb(w, dst) ^ getFlag(CF));
                    }
                    break;
                case 0b001: // ROR
                    for (let cnt = 0; cnt < src; ++cnt) {
                        tempCF = (dst & 0b1) == 0b1;
                        dst >>>= 1;
                        dst |= (tempCF ? 1 : 0) * SIGN[w];
                        dst &= MASK[w];
                    }
                    if (src > 0) {
                        setFlag(CF, msb(w, dst));
                        setFlag(OF, msb(w, dst) ^ msb(w, dst << 1));
                    }
                    break;
                case 0b010: // RCL
                    for (let cnt = 0; cnt < src; ++cnt) {
                        tempCF = msb(w, dst);
                        dst <<= 1;
                        dst |= getFlag(CF) ? 0b1 : 0b0;
                        dst &= MASK[w];
                        setFlag(CF, tempCF);
                    }
                    if (src > 0)
                        setFlag(OF, msb(w, dst) ^ getFlag(CF));
                    break;
                case 0b011: // RCR
                    for (let cnt = 0; cnt < src; ++cnt) {
                        tempCF = (dst & 0b1) == 0b1;
                        dst >>>= 1;
                        dst |= (getFlag(CF) ? 1 : 0) * SIGN[w];
                        dst &= MASK[w];
                        setFlag(CF, tempCF);
                    }
                    if (src > 0)
                        setFlag(OF, msb(w, dst) ^ msb(w, dst << 1));
                    break;
                case 0b100: // SAL/SHL
                    for (let cnt = 0; cnt < src; ++cnt) {
                        setFlag(CF, (dst & SIGN[w]) == SIGN[w]);
                        dst <<= 1;
                        dst &= MASK[w];
                    }
                    if (src > 0) {
                        setFlag(OF, (dst & SIGN[w]) == SIGN[w] ^ getFlag(CF));
                        setFlags(w, dst);
                    }
                    break;
                case 0b101: // SHR
                    if (src > 0)
                        setFlag(OF, (dst & SIGN[w]) == SIGN[w]);
                    for (let cnt = 0; cnt < src; ++cnt) {
                        setFlag(CF, (dst & 0b1) == 0b1);
                        dst >>>= 1;
                        dst &= MASK[w];
                    }
                    if (src > 0)
                        setFlags(w, dst);
                    break;
                case 0b111: // SAR
                    for (let cnt = 0; cnt < src; ++cnt) {
                        setFlag(CF, (dst & 0b1) == 0b1);
                        dst = signconv(w, dst);
                        dst >>= 1;
                        dst &= MASK[w];
                    }
                    if (src > 0) {
                        setFlag(OF, false);
                        setFlags(w, dst);
                    }
                    break;
                }
                setRM(w, mod, rm, dst);
                if (op == 0xd0 || op == 0xd1)
                    clocks += mod == 0b11 ? 2 : 15;
                else
                    clocks += mod == 0b11 ? 8 + 4 * src : 20 + 4 * src;
                break;
            case 0xf6:
            case 0xf7:
                decode();
                src = getRM(w, mod, rm);
                switch (reg) {
                case 0b000: // TEST
                    dst = getMem(w);
                    logic(w, dst & src);
                    clocks += mod == 0b11 ? 5 : 11;
                    break;
                case 0b010: // NOT
                    setRM(w, mod, rm, ~src);
                    clocks += mod == 0b11 ? 3 : 16;
                    break;
                case 0b011: // NEG
                    dst = sub(w, 0, src);
                    setFlag(CF, dst > 0);
                    setRM(w, mod, rm, dst);
                    clocks += mod == 0b11 ? 3 : 16;
                    break;
                case 0b100: // MUL
                    if (w == B) {
                        dst = al;
                        res = dst * src & 0xffff;
                        setReg(W, AX, res);
                        if (ah > 0) {
                            setFlag(CF, true);
                            setFlag(OF, true);
                        } else {
                            setFlag(CF, false);
                            setFlag(OF, false);
                        }
                        clocks += mod == 0b11 ? 70 : 70;
                    } else {
                        dst = getReg(W, AX);
                        const lres = dst * src & 0xffffffff;
                        setReg(W, AX, lres & 0xffff);
                        setReg(W, DX, (lres >>> 16));
                        if (getReg(W, DX) > 0) {
                            setFlag(CF, true);
                            setFlag(OF, true);
                        } else {
                            setFlag(CF, false);
                            setFlag(OF, false);
                        }
                        clocks += mod == 0b11 ? 118 : 118;
                    }
                    break;
                case 0b101: // IMUL
                    if (w == B) {
                        src = signconv(B, src);
                        dst = al;
                        dst = signconv(B, dst);
                        res = dst * src & 0xffff;
                        setReg(W, AX, res);
                        if (res > 127 || res < -128) {
                            setFlag(CF, true);
                            setFlag(OF, true);
                        } else {
                            setFlag(CF, false);
                            setFlag(OF, false);
                        }
                        clocks += mod == 0b11 ? 80 : 80;
                    } else {
                        src = signconv(W, src);
                        dst = ah << 8 | al;
                        dst = signconv(W, dst);
                        const lres = dst * src & 0xffffffff;
                        setReg(W, AX, lres & 0xffff);
                        setReg(W, DX, (lres >>> 16));
                        const dx = getReg(W, DX);
                        if (lres > 32767 || lres < -32768) {
                            setFlag(CF, true);
                            setFlag(OF, true);
                        } else {
                            setFlag(CF, false);
                            setFlag(OF, false);
                        }
                        clocks += mod == 0b11 ? 128 : 128;
                    }
                    break;
                case 0b110: // DIV
                    if (src == 0) {
                        ip = ip_start;
                        callInt(0);
                    } else if (w == B) {
                        dst = ah << 8 | al;
                        const z = dst / src, m = dst % src;
                        if ((z & 0xff00) != 0) {
                            ip = ip_start;
                            callInt(0);
                        } else {
                            al = z & 0xff;
                            ah = m & 0xff;
                        }
                        clocks += 80;
                    } else {
                        dst = getReg(W, DX) << 16 | getReg(W, AX);
                        let z = ((dst >>> 1) / src) << 1, m = (((dst >>> 1) % src) << 1) + (dst & 1);
                        z += m / src;
                        m = m % src;
                        if ((z & 0xffff0000) != 0) {
                            ip = ip_start;
                            callInt(0);
                        } else {
                            setReg(W, AX, z & 0xffff);
                            setReg(W, DX, m & 0xffff);
                        }
                        clocks += 144;
                    }
                    break;
                case 0b111: // IDIV
                    if (src == 0) {
                        ip = ip_start;
                        callInt(0);
                    } else if (w == B) {
                        src = signconv(B, src);
                        dst = getReg(W, AX);
                        dst = signconv(W, dst);
                        const z = dst / src, m = dst % src;
                        if ((z & 0xffffff00) + ((z & 0x0080) << 1) != 0) {
                            ip = ip_start;
                            callInt(0);
                        } else {
                            al = z & 0xff;
                            ah = m & 0xff;
                        }
                        clocks += 101;
                    } else {
                        src = signconv(W, src);
                        dst = getReg(W, DX) << 16 | getReg(W, AX);
                        const z = dst / src, m = dst % src;
                        if ((z & 0xffff0000) + ((z & 0x8000) << 1) != 0) {
                            ip = ip_start;
                            callInt(0);
                        } else {
                            setReg(W, AX, z & 0xffff);
                            setReg(W, DX, m & 0xffff);
                        }
                        clocks += 165;
                    }
                    break;
                }
                break;
            case 0xfe:
                decode();
                src = getRM(w, mod, rm);
                switch (reg) {
                case 0b000: // INC
                    res = inc(w, src);
                    setRM(w, mod, rm, res);
                    break;
                case 0b001: // DEC
                    res = dec(w, src);
                    setRM(w, mod, rm, res);
                    break;
                }
                clocks += mod == 0b11 ? 3 : 15;
                break;
            case 0xff:
                decode();
                src = getRM(w, mod, rm);
                switch (reg) {
                case 0b000: // INC
                    res = inc(w, src);
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 15;
                    break;
                case 0b001: // DEC
                    res = dec(w, src);
                    setRM(w, mod, rm, res);
                    clocks += mod == 0b11 ? 3 : 15;
                    break;
                case 0b010: // CALL
                    push(ip);
                    ip = src;
                    clocks += mod == 0b11 ? 16 : 21;
                    break;
                case 0b011: // CALL
                    push(cs);
                    push(ip);
                    dst = getEA(mod, rm);
                    ip = getMem(W, dst);
                    cs = getMem(W, dst + 2);
                    clocks += 37;
                    break;
                case 0b100: // JMP
                    ip = src;
                    clocks += mod == 0b11 ? 11 : 18;
                    break;
                case 0b101: // JMP
                    dst = getEA(mod, rm);
                    ip = getMem(W, dst);
                    cs = getMem(W, dst + 2);
                    clocks += 24;
                    break;
                case 0b110: // PUSH
                    push(src);
                    clocks += mod == 0b11 ? 11 : 16;
                    break;
                }
                break;
            default:
                if (CPU_186 !== 0) {
                    switch (op) {
                    case 0x60: // PUSHA
                        src = sp;
                        push(getReg(W, AX));
                        push(getReg(W, CX));
                        push(getReg(W, DX));
                        push(getReg(W, BX));
                        push(src);
                        push(bp);
                        push(si);
                        push(di);
                        clocks += 19;
                        break;
                    case 0x61: // POPA
                        di = pop() & 0xffff;
                        si = pop() & 0xffff;
                        bp = pop() & 0xffff;
                        pop();
                        setReg(W, BX, pop());
                        setReg(W, DX, pop());
                        setReg(W, CX, pop());
                        setReg(W, AX, pop());
                        clocks += 19;
                        break;
                    case 0x62: // BOUND
                        decode();
                        src = (getReg(W, reg) << 16) >> 16;
                        dst = getEA(mod, rm);
                        res = (getMem(W, dst) << 16) >> 16;
                        if (src < res) {
                            ip = ip_start;
                            callInt(5);
                        } else {
                            res = (getMem(W, dst + 2) << 16) >> 16;
                            if (src > res) {
                                ip = ip_start;
                                callInt(5);
                            }
                        }
                        clocks += 13;
                        break;
                    case 0x68: // PUSH
                    case 0x6a:
                        push((op === 0x68) ? getMem(W) : getMem(B));
                        clocks += 3;
                        break;
                    case 0x69: // IMUL
                    case 0x6b:
                        decode();
                        dst = (getRM(W, mod, rm) << 16) >> 16;
                        src = (((op === 0x6b) ? getMem(B) : getMem(W)) << 16) >> 16;
                        res = dst * src;
                        setReg(W, reg, res & 0xffff);
                        if (res > 32767 || res < -32768) {
                            setFlag(CF, true);
                            setFlag(OF, true);
                        } else {
                            setFlag(CF, false);
                            setFlag(OF, false);
                        }
                        clocks += 21;
                        break;
                    case 0x6c: // INS
                    case 0x6d:
                        setMem(w, getAddr(es, di), portIn(w, getReg(W, DX)));
                        di = di + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                        clocks += 4;
                        break;
                    case 0x6e: // OUTS
                    case 0x6f:
                        portOut(w, getReg(W, DX), getMem(w, getAddr(os, si)));
                        si = si + (getFlag(DF) ? -1 : 1) * (1 + w) & 0xffff;
                        clocks += 4;
                        break;
                    case 0xc8: // ENTER
                        dst = getMem(W) & 0x7f;
                        src = getMem(B) & 0x1f;
                        push(bp);
                        res = sp;
                        if (src > 0) {
                            while (--src) {
                                bp -= 2;
                                push(getMem(W, getAddr(ss, bp)));
                            }
                            push(res);
                        }
                        bp = res;
                        sp = sp - dst & 0xffff;
                        clocks += 12 + 4 * src;
                        break;
                    case 0xc9: // LEAVE
                        sp = bp;
                        bp = pop();
                        clocks += 8;
                        break;
                    default:
                        throw new Error(`80186: ${op.toString(16).padStart(2, '0')}`);
                    }
                    break;
                }
                throw new Error(`8086: ${op.toString(16).padStart(2, '0')}`);
            }
        } while (rep > 0);
        return true;
    }

    function reset() {
        ah = 0, al = 0;
        ch = 0, cl = 0;
        dh = 0, dl = 0;
        bh = 0, bl = 0;
        sp = 0;
        bp = 0;
        si = 0;
        di = 0;
        cs = 0xffff;
        ds = 0;
        ss = 0;
        es = 0;
        os = null;
        ip = 0;
        flags = 0x02;
        for (let i = 0; i < 6; i++)
            queue[i] = 0;
        clocks = 0;
    }

    function getRegs() {
        return {
            ah, al, ch, cl, dh, dl, bh, bl, sp, bp, si, di, cs, ds, ss, es, ip, flags
        };
    }

    function setRegs(regs) {
        if (regs.ah !== undefined) ah = regs.ah & 0xff;
        if (regs.al !== undefined) al = regs.al & 0xff;
        if (regs.ch !== undefined) ch = regs.ch & 0xff;
        if (regs.cl !== undefined) cl = regs.cl & 0xff;
        if (regs.dh !== undefined) dh = regs.dh & 0xff;
        if (regs.dl !== undefined) dl = regs.dl & 0xff;
        if (regs.bh !== undefined) bh = regs.bh & 0xff;
        if (regs.bl !== undefined) bl = regs.bl & 0xff;
        if (regs.sp !== undefined) sp = regs.sp & 0xffff;
        if (regs.bp !== undefined) bp = regs.bp & 0xffff;
        if (regs.si !== undefined) si = regs.si & 0xffff;
        if (regs.di !== undefined) di = regs.di & 0xffff;
        if (regs.cs !== undefined) cs = regs.cs & 0xffff;
        if (regs.ds !== undefined) ds = regs.ds & 0xffff;
        if (regs.ss !== undefined) ss = regs.ss & 0xffff;
        if (regs.es !== undefined) es = regs.es & 0xffff;
        if (regs.ip !== undefined) ip = regs.ip & 0xffff;
        if (regs.flags !== undefined) flags = regs.flags & 0xfd7 | 0x02;
    }

    function getClocks() {
        return clocks;
    }

    function setClocks(value) {
        clocks = value;
    }

    function getPC() {
        return getAddr(cs, ip);
    }

    function setPC(addr) {
        cs = addr >>> 4 & 0xf000;
        ip = addr & 0xffff;
    }

    function Ap(op) { //call_inter
        const o = Iv(op);
        return Iv(op) + ':' + o;
    }

    function Eb(op) { //rm8
        return readRMReg8(op);
    }

    function Ev(op) { //rm16
        return readRMReg16(op);
    }

    function Gb(op) { //r8
        return readRegVal(op, 0);
    }

    function Gv(op) { //r16
        return readRegVal(op, 1);
    }

    function Ib(op) { //imm8
        op.addr++;
        return m_read(op.addr).toString(16).padStart(2, '0');
    }

    function Iv(op) { //imm16
        op.addr++;
        let o = m_read(op.addr);
        op.addr++;
        o = (m_read(op.addr) << 8) | o;
        return o.toString(16).padStart(4, '0');
    }

    function Jb(op) { //rel8
        op.addr++;
        return ((op.addr + m_read(op.addr) + 1) & 0xFF).toString(16).padStart(2, '0');
    }

    function Jv(op) { //rel16
        op.addr++;
        let rel = m_read(op.addr);
        op.addr++;
        rel = (m_read(op.addr) << 8) | rel;
        return ((op.addr + rel + 1) & 0xFFFF).toString(16).padStart(4, '0');
    }

    function Ov(op) { //moffs16
        return '[' + Iv(op) + ']';
    }

    function GEv(op) { //r16, rm16
        const o1 = Gv(op),
              o2 = Ev(op);
        return (o1 === o2) ? o1 : o1 + ', ' + o2;
    }

    const sregs = ['ES', 'CS', 'SS', 'DS'];

    function Sw(op) { //sreg
        return sregs[op.reg];
    }

    function readRMReg8(op) {
        if (op.mod === 0b11)
            return readRegVal(op, 0, true);
        return calcRMAddr(op);
    }

    function readRMReg16(op) {
        if (op.mod === 0b11)
            return readRegVal(op, 1, true);
        return calcRMAddr(op);
    }

    function calcRMAddr(op) {
        switch (op.mod) {
            case 0b00:
                return calcRMAddrNoDisp(op);
            case 0b01:
            case 0b10:
                return calcRMAddrDisp(op);
            case 0b11:
                return null;
        }
        throw new Error('invalid operand MOD value');
    }

    function calcRMAddrNoDisp(op) {
        switch (op.rm) {
            case 0b000:
                return '[BX + SI]';
            case 0b001:
                return '[BX + DI]';
            case 0b010:
                return '[BP + SI]';
            case 0b011:
                return '[BP + DI]';
            case 0b100:
                return '[SI]';
            case 0b101:
                return '[DI]';
            case 0b110:
                return Ov(op);
            case 0b111:
                return '[BX]';
        }
        throw new Error('invalid operand RM value');
    }

    function calcRMAddrDisp(op) {
        let disp;
        switch (op.mod) {
            case 0b01:
                disp = Ib(op);
                break;
            case 0b10:
                disp = Iv(op);
                break;
        }
        if (op.rm === 0b110)
            return '[BP + ' + disp + ']';
        const res = calcRMAddrNoDisp(op);
        return res.substr(0, res.length - 1) + ' + ' + disp + ']';
    }

    const regs8  = ['AL', 'CL', 'DL', 'BL', 'AH', 'CH', 'DH', 'BH'];
    const regs16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];

    function readRegVal(op, w, useRM = false) {
        const rmReg = (useRM) ? op.rm : op.reg;
        if (w === 0)
            return regs8[rmReg];
        return regs16[rmReg];
    }

    const inst = [];
    inst[0x00]    = ['add',    2, Eb, Gb];
    inst[0x01]    = ['add',    2, Ev, Gv];
    inst[0x02]    = ['add',    2, Gb, Eb];
    inst[0x03]    = ['add',    2, Gv, Ev];
    inst[0x04]    = ['add',    1, 'AL', Ib];
    inst[0x05]    = ['add',    1, 'AX', Iv];
    inst[0x06]    = ['push',   1, 'ES'];
    inst[0x07]    = ['pop',    1, 'ES'];
    inst[0x08]    = ['or',     2, Eb, Gb];
    inst[0x09]    = ['or',     2, Ev, Gv];
    inst[0x0A]    = ['or',     2, Gb, Eb];
    inst[0x0B]    = ['or',     2, Gv, Ev];
    inst[0x0C]    = ['or',     1, 'AL', Ib];
    inst[0x0D]    = ['or',     1, 'AX', Iv];
    inst[0x0E]    = ['push',   1, 'CS'];
    inst[0x0F]    = ['notimp', 0];
    inst[0x10]    = ['adc',    2, Eb, Gb];
    inst[0x11]    = ['adc',    2, Ev, Gv];
    inst[0x12]    = ['adc',    2, Gb, Eb];
    inst[0x13]    = ['adc',    2, Gv, Ev];
    inst[0x14]    = ['adc',    1, 'AL', Ib];
    inst[0x15]    = ['adc',    1, 'AX', Iv];
    inst[0x16]    = ['push',   1, 'SS'];
    inst[0x17]    = ['pop',    1, 'SS'];
    inst[0x18]    = ['sbb',    2, Eb, Gb];
    inst[0x19]    = ['sbb',    2, Ev, Gv];
    inst[0x1A]    = ['sbb',    2, Gb, Eb];
    inst[0x1B]    = ['sbb',    2, Gv, Ev];
    inst[0x1C]    = ['sbb',    1, 'AL', Ib];
    inst[0x1D]    = ['sbb',    1, 'AX', Iv];
    inst[0x1E]    = ['push',   1, 'DS'];
    inst[0x1F]    = ['pop',    1, 'DS'];
    inst[0x20]    = ['and',    2, Eb, Gb];
    inst[0x21]    = ['and',    2, Ev, Gv];
    inst[0x22]    = ['and',    2, Gb, Eb];
    inst[0x23]    = ['and',    2, Gv, Ev];
    inst[0x24]    = ['and',    1, 'AL', Ib];
    inst[0x25]    = ['and',    1, 'AX', Iv];
    inst[0x26]    = ['es',     1];
    inst[0x27]    = ['daa',    1];
    inst[0x28]    = ['sub',    2, Eb, Gb];
    inst[0x29]    = ['sub',    2, Ev, Gv];
    inst[0x2A]    = ['sub',    2, Gb, Eb];
    inst[0x2B]    = ['sub',    2, Gv, Ev];
    inst[0x2C]    = ['sub',    1, 'AL', Ib];
    inst[0x2D]    = ['sub',    1, 'AX', Iv];
    inst[0x2E]    = ['cs',     1];
    inst[0x2F]    = ['das',    1];
    inst[0x30]    = ['xor',    2, Eb, Gb];
    inst[0x31]    = ['xor',    2, Ev, Gv];
    inst[0x32]    = ['xor',    2, Gb, Eb];
    inst[0x33]    = ['xor',    2, Gv, Ev];
    inst[0x34]    = ['xor',    1, 'AL', Ib];
    inst[0x35]    = ['xor',    1, 'AX', Iv];
    inst[0x36]    = ['ss',     1];
    inst[0x37]    = ['aaa',    1];
    inst[0x38]    = ['cmp',    2, Eb, Gb];
    inst[0x39]    = ['cmp',    2, Ev, Gv];
    inst[0x3A]    = ['cmp',    2, Gb, Eb];
    inst[0x3B]    = ['cmp',    2, Gv, Ev];
    inst[0x3C]    = ['cmp',    1, 'AL', Ib];
    inst[0x3D]    = ['cmp',    1, 'AX', Iv];
    inst[0x3E]    = ['ds',     1];
    inst[0x3F]    = ['aas',    1];
    inst[0x40]    = ['inc',    1, 'AX'];
    inst[0x41]    = ['inc',    1, 'CX'];
    inst[0x42]    = ['inc',    1, 'DX'];
    inst[0x43]    = ['inc',    1, 'BX'];
    inst[0x44]    = ['inc',    1, 'SP'];
    inst[0x45]    = ['inc',    1, 'BP'];
    inst[0x46]    = ['inc',    1, 'SI'];
    inst[0x47]    = ['inc',    1, 'DI'];
    inst[0x48]    = ['dec',    1, 'AX'];
    inst[0x49]    = ['dec',    1, 'CX'];
    inst[0x4A]    = ['dec',    1, 'DX'];
    inst[0x4B]    = ['dec',    1, 'BX'];
    inst[0x4C]    = ['dec',    1, 'SP'];
    inst[0x4D]    = ['dec',    1, 'BP'];
    inst[0x4E]    = ['dec',    1, 'SI'];
    inst[0x4F]    = ['dec',    1, 'DI'];
    inst[0x50]    = ['push',   1, 'AX'];
    inst[0x51]    = ['push',   1, 'CX'];
    inst[0x52]    = ['push',   1, 'DX'];
    inst[0x53]    = ['push',   1, 'BX'];
    inst[0x54]    = ['push',   1, 'SP'];
    inst[0x55]    = ['push',   1, 'BP'];
    inst[0x56]    = ['push',   1, 'SI'];
    inst[0x57]    = ['push',   1, 'DI'];
    inst[0x58]    = ['pop',    1, 'AX'];
    inst[0x59]    = ['pop',    1, 'CX'];
    inst[0x5A]    = ['pop',    1, 'DX'];
    inst[0x5B]    = ['pop',    1, 'BX'];
    inst[0x5C]    = ['pop',    1, 'SP'];
    inst[0x5D]    = ['pop',    1, 'BP'];
    inst[0x5E]    = ['pop',    1, 'SI'];
    inst[0x5F]    = ['pop',    1, 'DI'];
    inst[0x60]    = ['notimp', 0];
    inst[0x61]    = ['notimp', 0];
    inst[0x62]    = ['notimp', 0];
    inst[0x63]    = ['notimp', 0];
    inst[0x64]    = ['notimp', 0];
    inst[0x65]    = ['notimp', 0];
    inst[0x66]    = ['notimp', 0];
    inst[0x67]    = ['notimp', 0];
    inst[0x68]    = ['notimp', 0];
    inst[0x69]    = ['notimp', 0];
    inst[0x6A]    = ['notimp', 0];
    inst[0x6B]    = ['notimp', 0];
    inst[0x6C]    = ['notimp', 0];
    inst[0x6D]    = ['notimp', 0];
    inst[0x6E]    = ['notimp', 0];
    inst[0x6F]    = ['notimp', 0];
    inst[0x70]    = ['jo',     1, Jb];
    inst[0x71]    = ['jno',    1, Jb];
    inst[0x72]    = ['jc',     1, Jb];
    inst[0x73]    = ['jnb',    1, Jb];
    inst[0x74]    = ['jz',     1, Jb];
    inst[0x75]    = ['jnz',    1, Jb];
    inst[0x76]    = ['jbe',    1, Jb];
    inst[0x77]    = ['ja',     1, Jb];
    inst[0x78]    = ['js',     1, Jb];
    inst[0x79]    = ['jns',    1, Jb];
    inst[0x7A]    = ['jpe',    1, Jb];
    inst[0x7B]    = ['jpo',    1, Jb];
    inst[0x7C]    = ['jl',     1, Jb];
    inst[0x7D]    = ['jge',    1, Jb];
    inst[0x7E]    = ['jle',    1, Jb];
    inst[0x7F]    = ['jg',     1, Jb];
    inst[0x80] = [];
    inst[0x80][0] = ['add',    2, Eb, Ib];
    inst[0x80][1] = ['or',     2, Eb, Ib];
    inst[0x80][2] = ['adc',    2, Eb, Ib];
    inst[0x80][3] = ['sbb',    2, Eb, Ib];
    inst[0x80][4] = ['and',    2, Eb, Ib];
    inst[0x80][5] = ['sub',    2, Eb, Ib];
    inst[0x80][6] = ['xor',    2, Eb, Ib];
    inst[0x80][7] = ['cmp',    2, Eb, Ib];
    inst[0x81] = [];
    inst[0x81][0] = ['add',    2, Ev, Iv];
    inst[0x81][1] = ['or',     2, Ev, Iv];
    inst[0x81][2] = ['adc',    2, Ev, Iv];
    inst[0x81][3] = ['sbb',    2, Ev, Iv];
    inst[0x81][4] = ['and',    2, Ev, Iv];
    inst[0x81][5] = ['sub',    2, Ev, Iv];
    inst[0x81][6] = ['xor',    2, Ev, Iv];
    inst[0x81][7] = ['cmp',    2, Ev, Iv];
    inst[0x82] = [];
    inst[0x82][0] = ['add',    2, Eb, Ib];
    inst[0x82][1] = ['or',     2, Eb, Ib];
    inst[0x82][2] = ['adc',    2, Eb, Ib];
    inst[0x82][3] = ['sbb',    2, Eb, Ib];
    inst[0x82][4] = ['and',    2, Eb, Ib];
    inst[0x82][5] = ['sub',    2, Eb, Ib];
    inst[0x82][6] = ['xor',    2, Eb, Ib];
    inst[0x82][7] = ['cmp',    2, Eb, Ib];
    inst[0x83] = [];
    inst[0x83][0] = ['add',    2, Ev, Ib];
    inst[0x83][1] = ['or',     2, Ev, Ib];
    inst[0x83][2] = ['adc',    2, Ev, Ib];
    inst[0x83][3] = ['sbb',    2, Ev, Ib];
    inst[0x83][4] = ['and',    2, Ev, Ib];
    inst[0x83][5] = ['sub',    2, Ev, Ib];
    inst[0x83][6] = ['xor',    2, Ev, Ib];
    inst[0x83][7] = ['cmp',    2, Ev, Ib];
    inst[0x84]    = ['test',   2, Gb, Eb];
    inst[0x85]    = ['test',   2, Gv, Ev];
    inst[0x86]    = ['xchg',   2, Gb, Eb];
    inst[0x87]    = ['xchg',   2, Gv, Ev];
    inst[0x88]    = ['mov',    2, Eb, Gb];
    inst[0x89]    = ['mov',    2, Ev, Gv];
    inst[0x8A]    = ['mov',    2, Gb, Eb];
    inst[0x8B]    = ['mov',    2, Gv, Ev];
    inst[0x8C]    = ['mov',    2, Ev, Sw];
    inst[0x8D]    = ['lea',    2, Gv, Ev];
    inst[0x8E]    = ['mov',    2, Sw, Ev];
    inst[0x8F]    = ['pop',    2, Ev];
    inst[0x90]    = ['nop',    1];
    inst[0x91]    = ['xchg',   1, 'CX', 'AX'];
    inst[0x92]    = ['xchg',   1, 'DX', 'AX'];
    inst[0x93]    = ['xchg',   1, 'BX', 'AX'];
    inst[0x94]    = ['xchg',   1, 'SP', 'AX'];
    inst[0x95]    = ['xchg',   1, 'BP', 'AX'];
    inst[0x96]    = ['xchg',   1, 'SI', 'AX'];
    inst[0x97]    = ['xchg',   1, 'DI', 'AX'];
    inst[0x98]    = ['cbw',    1];
    inst[0x99]    = ['cwd',    1];
    inst[0x9A]    = ['call',   1, Ap];
    inst[0x9B]    = ['wait',   1];
    inst[0x9C]    = ['pushf',  1];
    inst[0x9D]    = ['popf',   1];
    inst[0x9E]    = ['sahf',   1];
    inst[0x9F]    = ['lahf',   1];
    inst[0xA0]    = ['mov',    1, 'AL', Ov];
    inst[0xA1]    = ['mov',    1, 'AX', Ov];
    inst[0xA2]    = ['mov',    1, Ov, 'AL'];
    inst[0xA3]    = ['mov',    1, Ov, 'AX'];
    inst[0xA4]    = ['movsb',  1];
    inst[0xA5]    = ['movsw',  1];
    inst[0xA6]    = ['cmpsb',  1];
    inst[0xA7]    = ['cmpsw',  1];
    inst[0xA8]    = ['test',   1, 'AL', Ib];
    inst[0xA9]    = ['test',   1, 'AX', Iv];
    inst[0xAA]    = ['stosb',  1];
    inst[0xAB]    = ['stosw',  1];
    inst[0xAC]    = ['lodsb',  1];
    inst[0xAD]    = ['lodsw',  1];
    inst[0xAE]    = ['scasb',  1];
    inst[0xAF]    = ['scasw',  1];
    inst[0xB0]    = ['mov',    1, 'AL', Ib];
    inst[0xB1]    = ['mov',    1, 'CL', Ib];
    inst[0xB2]    = ['mov',    1, 'DL', Ib];
    inst[0xB3]    = ['mov',    1, 'BL', Ib];
    inst[0xB4]    = ['mov',    1, 'AH', Ib];
    inst[0xB5]    = ['mov',    1, 'CH', Ib];
    inst[0xB6]    = ['mov',    1, 'DH', Ib];
    inst[0xB7]    = ['mov',    1, 'BH', Ib];
    inst[0xB8]    = ['mov',    1, 'AX', Iv];
    inst[0xB9]    = ['mov',    1, 'CX', Iv];
    inst[0xBA]    = ['mov',    1, 'DX', Iv];
    inst[0xBB]    = ['mov',    1, 'BX', Iv];
    inst[0xBC]    = ['mov',    1, 'SP', Iv];
    inst[0xBD]    = ['mov',    1, 'BP', Iv];
    inst[0xBE]    = ['mov',    1, 'SI', Iv];
    inst[0xBF]    = ['mov',    1, 'DI', Iv];
    inst[0xC0]    = ['notimp', 0];
    inst[0xC1]    = ['notimp', 0];
    inst[0xC2]    = ['ret',    1, Iv];
    inst[0xC3]    = ['ret',    1];
    inst[0xC4]    = ['les',    2, Gv, Ev];
    inst[0xC5]    = ['lds',    2, Gv, Ev];
    inst[0xC6]    = ['mov',    2, Eb, Ib];
    inst[0xC7]    = ['mov',    2, Ev, Iv];
    inst[0xC8]    = ['notimp', 0];
    inst[0xC9]    = ['notimp', 0];
    inst[0xCA]    = ['retf',   1, Iv];
    inst[0xCB]    = ['retf',   1];
    inst[0xCC]    = ['int',    1, '3'];
    inst[0xCD]    = ['int',    1, Ib];
    inst[0xCE]    = ['into',   1];
    inst[0xCF]    = ['iret',   1];
    inst[0xD0] = [];
    inst[0xD0][0] = ['rol',    2, Eb, '1'];
    inst[0xD0][1] = ['ror',    2, Eb, '1'];
    inst[0xD0][2] = ['rcl',    2, Eb, '1'];
    inst[0xD0][3] = ['rcr',    2, Eb, '1'];
    inst[0xD0][4] = ['shl',    2, Eb, '1'];
    inst[0xD0][5] = ['shr',    2, Eb, '1'];
    inst[0xD0][6] = ['notimp', 0];
    inst[0xD0][7] = ['sar',    2, Eb, '1'];
    inst[0xD1] = [];
    inst[0xD1][0] = ['rol',    2, Ev, '1'];
    inst[0xD1][1] = ['ror',    2, Ev, '1'];
    inst[0xD1][2] = ['rcl',    2, Ev, '1'];
    inst[0xD1][3] = ['rcr',    2, Ev, '1'];
    inst[0xD1][4] = ['shl',    2, Ev, '1'];
    inst[0xD1][5] = ['shr',    2, Ev, '1'];
    inst[0xD1][6] = ['notimp', 0];
    inst[0xD1][7] = ['sar',    2, Ev, '1'];
    inst[0xD2] = [];
    inst[0xD2][0] = ['rol',    2, Eb, 'CL'];
    inst[0xD2][1] = ['ror',    2, Eb, 'CL'];
    inst[0xD2][2] = ['rcl',    2, Eb, 'CL'];
    inst[0xD2][3] = ['rcr',    2, Eb, 'CL'];
    inst[0xD2][4] = ['shl',    2, Eb, 'CL'];
    inst[0xD2][5] = ['shr',    2, Eb, 'CL'];
    inst[0xD2][6] = ['notimp', 0];
    inst[0xD2][7] = ['sar',    2, Eb, 'CL'];
    inst[0xD3] = [];
    inst[0xD3][0] = ['rol',    2, Ev, 'CL'];
    inst[0xD3][1] = ['ror',    2, Ev, 'CL'];
    inst[0xD3][2] = ['rcl',    2, Ev, 'CL'];
    inst[0xD3][3] = ['rcr',    2, Ev, 'CL'];
    inst[0xD3][4] = ['shl',    2, Ev, 'CL'];
    inst[0xD3][5] = ['shr',    2, Ev, 'CL'];
    inst[0xD3][6] = ['notimp', 0];
    inst[0xD3][7] = ['sar',    2, Ev, 'CL'];
    inst[0xD4]    = ['aam',    1, Ib];
    inst[0xD5]    = ['aad',    1, Ib];
    inst[0xD6]    = ['notimp', 0];
    inst[0xD7]    = ['xlat',   1];
    inst[0xD8]    = ['notimp', 0];
    inst[0xD9]    = ['notimp', 0];
    inst[0xDA]    = ['notimp', 0];
    inst[0xDB]    = ['notimp', 0];
    inst[0xDC]    = ['notimp', 0];
    inst[0xDD]    = ['notimp', 0];
    inst[0xDE]    = ['notimp', 0];
    inst[0xDF]    = ['notimp', 0];
    inst[0xE0]    = ['loopnz', 1, Jb];
    inst[0xE1]    = ['loopz',  1, Jb];
    inst[0xE2]    = ['loop',   1, Jb];
    inst[0xE3]    = ['jcxz',   1, Jb];
    inst[0xE4]    = ['in',     1, 'AL', Ib];
    inst[0xE5]    = ['in',     1, 'AX', Ib];
    inst[0xE6]    = ['out',    1, Ib, 'AL'];
    inst[0xE7]    = ['out',    1, Ib, 'AX'];
    inst[0xE8]    = ['call',   1, Jv];
    inst[0xE9]    = ['jmp',    1, Jv];
    inst[0xEA]    = ['jmp',    1, Ap];
    inst[0xEB]    = ['jmp',    1, Jb];
    inst[0xEC]    = ['in',     1, 'AL', 'DX'];
    inst[0xED]    = ['in',     1, 'AX', 'DX'];
    inst[0xEE]    = ['out',    1, 'DX', 'AL'];
    inst[0xEF]    = ['out',    1, 'DX', 'AX'];
    inst[0xF0]    = ['lock',   1];
    inst[0xF1]    = ['notimp', 0];
    inst[0xF2]    = ['repnz',  1];
    inst[0xF3]    = ['repz',   1];
    inst[0xF4]    = ['hlt',    1];
    inst[0xF5]    = ['cmc',    1];
    inst[0xF6] = [];
    inst[0xF6][0] = ['test',   2, Eb, Ib];
    inst[0xF6][1] = ['notimp', 0];
    inst[0xF6][2] = ['not',    2, Eb];
    inst[0xF6][3] = ['neg',    2, Eb];
    inst[0xF6][4] = ['mul',    2, Eb];
    inst[0xF6][5] = ['imul',   2, Eb];
    inst[0xF6][6] = ['div',    2, Eb];
    inst[0xF6][7] = ['idiv',   2, Eb];
    inst[0xF7] = [];
    inst[0xF7][0] = ['test',   2, Ev, Iv];
    inst[0xF7][1] = ['notimp', 0];
    inst[0xF7][2] = ['not',    2, Ev];
    inst[0xF7][3] = ['neg',    2, Ev];
    inst[0xF7][4] = ['mul',    2, Ev];
    inst[0xF7][5] = ['imul',   2, Ev];
    inst[0xF7][6] = ['div',    2, Ev];
    inst[0xF7][7] = ['idiv',   2, Ev];
    inst[0xF8]    = ['clc',    1];
    inst[0xF9]    = ['stc',    1];
    inst[0xFA]    = ['cli',    1];
    inst[0xFB]    = ['sti',    1];
    inst[0xFC]    = ['cld',    1];
    inst[0xFD]    = ['std',    1];
    inst[0xFE] = [];
    inst[0xFE][0] = ['inc',    2, Eb];
    inst[0xFE][1] = ['dec',    2, Eb];
    inst[0xFE][2] = ['notimp', 0];
    inst[0xFE][3] = ['notimp', 0];
    inst[0xFE][4] = ['notimp', 0];
    inst[0xFE][5] = ['notimp', 0];
    inst[0xFE][6] = ['notimp', 0];
    inst[0xFE][7] = ['notimp', 0];
    inst[0xFF] = [];
    inst[0xFF][0] = ['inc',    2, Ev];
    inst[0xFF][1] = ['dec',    2, Ev];
    inst[0xFF][2] = ['call',   2, Ev];
    inst[0xFF][3] = ['call',   2, Ev];
    inst[0xFF][4] = ['jmp',    2, Ev];
    inst[0xFF][5] = ['jmp',    2, Ev];
    inst[0xFF][6] = ['push',   2, Ev];
    inst[0xFF][7] = ['notimp', 0];
    if (CPU_186 !== 0) {
        inst[0x60] = ['pusha',  1];
        inst[0x61] = ['popa',   1];
        inst[0x62] = ['bound',  2, Gv, Iv];
        inst[0x68] = ['push',   1, Iv];
        inst[0x69] = ['imul',   2, GEv, Iv];
        inst[0x6a] = ['push',   1, Ib];
        inst[0x6b] = ['imul',   2, GEv, Ib];
        inst[0x6c] = ['insb',   1];
        inst[0x6d] = ['insw',   1];
        inst[0x6e] = ['outsb',  1];
        inst[0x6f] = ['outsw',  1];
        inst[0xC0] = [];
        inst[0xC0][0] = ['rol',    2, Eb, Ib];
        inst[0xC0][1] = ['ror',    2, Eb, Ib];
        inst[0xC0][2] = ['rcl',    2, Eb, Ib];
        inst[0xC0][3] = ['rcr',    2, Eb, Ib];
        inst[0xC0][4] = ['shl',    2, Eb, Ib];
        inst[0xC0][5] = ['shr',    2, Eb, Ib];
        inst[0xC0][6] = ['notimp', 0];
        inst[0xC0][7] = ['sar',    2, Eb, Ib];
        inst[0xC1] = [];
        inst[0xC1][0] = ['rol',    2, Ev, Ib];
        inst[0xC1][1] = ['ror',    2, Ev, Ib];
        inst[0xC1][2] = ['rcl',    2, Ev, Ib];
        inst[0xC1][3] = ['rcr',    2, Ev, Ib];
        inst[0xC1][4] = ['shl',    2, Ev, Ib];
        inst[0xC1][5] = ['shr',    2, Ev, Ib];
        inst[0xC1][6] = ['notimp', 0];
        inst[0xC1][7] = ['sar',    2, Ev, Ib];
        inst[0xC8] = ['enter',  1, Iv, Ib];
        inst[0xc9] = ['leave',  1];
    }

    function disassembleInstruction(addr) {
        const op = {};
        op.addr = addr;
        let opcode_byte, reps = '      ', segs = null;
        prefixes: do {
            opcode_byte = m_read(op.addr);
            switch (opcode_byte) {
                case 0x26: segs = 'ES:'; break;
                case 0x2e: segs = 'CS:'; break;
                case 0x36: segs = 'SS:'; break;
                case 0x3e: segs = 'DS:'; break;
                case 0xf2: reps = 'repnz '; break;
                case 0xf3: reps = 'repz  '; break;
                default: break prefixes;
            }
            op.addr++;
        } while (true);
        op.d = (opcode_byte & 0x02) >>> 1;
        op.w = opcode_byte & 0x01;
        op.mod = null;
        op.reg = null;
        op.rm = null;
        let instruction = inst[opcode_byte];
        const isGroup = Array.isArray(instruction[0]);
        if (isGroup || instruction[1] > 1) {
            op.addr++;
            const opcode_addressing_byte = m_read(op.addr);
            op.mod = (opcode_addressing_byte & 0xC0) >>> 6;
            op.reg = (opcode_addressing_byte & 0x38) >>> 3;
            op.rm = opcode_addressing_byte & 0x07;
            if (isGroup)
                instruction = instruction[op.reg];
        }
        let [opcode, sz, dst, src] = instruction;
        let oper = opcode;
        oper = reps + oper;
        if (dst !== undefined) {
            let dststr = (typeof dst === 'string') ? dst : dst(op);
            if (segs && dststr[0] === '[')
                dststr = segs + dststr;
            while (oper.length < 12)
                oper += ' ';
            oper += dststr;
        }
        if (src !== undefined) {
            let srcstr = (typeof src === 'string') ? src : src(op);
            if (segs && srcstr[0] === '[')
                srcstr = segs + srcstr;
            oper += ', ' + srcstr;
        }
        return [op.addr + 1, oper];
    }

    function setRegisters(regs) {
        let s = '';
        for (let i = 1; i < regs.length; i += 2) {
            const reg = regs[i].toLowerCase(),
                  n = parseInt(regs[i + 1], 16);
            switch (reg) {
                case 'ah': ah = n & 0xff; break;
                case 'al': al = n & 0xff; break;
                case 'ch': ch = n & 0xff; break;
                case 'cl': cl = n & 0xff; break;
                case 'dh': dh = n & 0xff; break;
                case 'dl': dl = n & 0xff; break;
                case 'bh': bh = n & 0xff; break;
                case 'bl': bl = n & 0xff; break;
                case 'sp': sp = n & 0xffff; break;
                case 'bp': bp = n & 0xffff; break;
                case 'si': si = n & 0xffff; break;
                case 'di': di = n & 0xffff; break;
                case 'cs': cs = n & 0xffff; break;
                case 'ds': ds = n & 0xffff; break;
                case 'ss': ss = n & 0xffff; break;
                case 'es': es = n & 0xffff; break;
                case 'ip': ip = n & 0xffff; break;
                case 'fc': if (n & 1) flags |= (1 << 0); else flags &= ~(1 << 0) & 0xffff; break;
                case 'fp': if (n & 1) flags |= (1 << 2); else flags &= ~(1 << 2) & 0xffff; break;
                case 'fa': if (n & 1) flags |= (1 << 4); else flags &= ~(1 << 4) & 0xffff; break;
                case 'fz': if (n & 1) flags |= (1 << 6); else flags &= ~(1 << 6) & 0xffff; break;
                case 'fs': if (n & 1) flags |= (1 << 7); else flags &= ~(1 << 7) & 0xffff; break;
                case 'ft': if (n & 1) flags |= (1 << 8); else flags &= ~(1 << 8) & 0xffff; break;
                case 'fi': if (n & 1) flags |= (1 << 9); else flags &= ~(1 << 9) & 0xffff; break;
                case 'fd': if (n & 1) flags |= (1 << 10); else flags &= ~(1 << 10) & 0xffff; break;
                case 'fo': if (n & 1) flags |= (1 << 11); else flags &= ~(1 << 11) & 0xffff; break;
                default: s += ' ' + reg; break;
            }
        }
        return (s.length > 0) ? 'unknown register(s): ' + s : s;
    }

    function cpuStatus() {
        let s = 'F:' + flags.toString(16).padStart(4, '0') + ' ' + (flags & (1 << 11) ? 'O' : '.') +
                (flags & (1 << 10) ? 'D' : '.') + (flags & (1 << 9) ? 'I' : '.') +
                (flags & (1 << 8) ? 'T' : '.') + (flags & (1 << 7) ? 'S' : '.') +
                (flags & (1 << 6) ? 'Z' : '.') + (flags & (1 << 4) ? 'A' : '.') +
                (flags & (1 << 2) ? 'P' : '.') + (flags & (1 << 0) ? 'C' : '.') +
                '    AX:' + (ah << 8 | al).toString(16).padStart(4, '0');
        s += '|';
        s += 'BX:' + (bh << 8 | bl).toString(16).padStart(4, '0') +
                '   CX:' + (ch << 8 | cl).toString(16).padStart(4, '0') +
                '   DX:' + (dh << 8 | dl).toString(16).padStart(4, '0');
        s += '|';
        s += 'SI:' + si.toString(16).padStart(4, '0') +
                '   DI:' + di.toString(16).padStart(4, '0') +
                '   BP:' + bp.toString(16).padStart(4, '0');
        s += '#';
        s += 'DS:' + ds.toString(16).padStart(4, '0') +
                '   ES:' + es.toString(16).padStart(4, '0') +
                '   SS:' + ss.toString(16).padStart(4, '0');
        s += '|';
        s += 'SP:' + sp.toString(16).padStart(4, '0') +
                '   CS:' + cs.toString(16).padStart(4, '0') +
                '   IP:' + ip.toString(16).padStart(4, '0');
        return s;
    }

    function getSP() {
        return [ss, sp];
    }

    return {
        peripherals,
        getAddr,
        step,
        reset,
        getRegs,
        setRegs,
        getClocks,
        setClocks,
        getPC,
        setPC,
        disassembleInstruction,
        setRegisters,
        cpuStatus,
        getSP
    };
}
