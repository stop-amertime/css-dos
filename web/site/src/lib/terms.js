// terms.js - the dictionary behind the inline <Term> underlines.
// One or two sentences each: these render in a small hover card, not
// a paragraph. Keep ids lowercase; usage is <Term t="id">word</Term>.
// These replace the old GLOSSARY callouts - a word defines itself at
// the point of use instead of in a box the reader may never meet.
export const TERMS = {
  cabinet: 'The .css file the builder produces: the machine and the ' +
    'program’s floppy disk fused into one runnable stylesheet - ' +
    'named for arcade cabinets, a computer and one game sold as a single box.',
  cart: 'The program you feed in: a folder of DOS-era files, picked or ' +
    'uploaded on the Build page.',
  register: 'One of the fourteen 16-bit cells (AX, BX, IP…) a ' +
    'processor keeps directly to hand instead of in memory. Here, each ' +
    'register is one CSS variable.',
  tick: 'One beat of the machine: every formula in the file ' +
    're-evaluates once, and one CPU instruction executes.',
  floppy: 'The 1.44 MB disk image baked into the cabinet - DOS plus ' +
    'the program’s files, byte for byte, served from CSS variables.',
  opcode: 'The number that names an instruction: the byte the CPU ' +
    'fetches each tick decides what the tick does - 184 means ' +
    '“load a value into AX”.',
  dos: 'Disk Operating System - the 1980s PC operating system ' +
    '(a DR-DOS descendant here, EDR-DOS) that boots inside the machine ' +
    'and runs the program.',
  css: 'The language that describes how web pages look: the page’s ' +
    'HTML holds the words and pictures, and CSS is the list of rules ' +
    'saying what colour, size and position everything gets. It was ' +
    'never meant to compute anything.',
  sector: 'The unit a floppy drive reads and writes: 512 bytes. ' +
    'A 1.44 MB floppy is 2,880 of them.',
  bios: 'The firmware a PC runs at power-on: it sets the machine up, ' +
    'offers basic screen/disk/keyboard services, then boots the ' +
    'operating system from disk.',
  i8086: 'Intel’s 1978 16-bit processor - the chip in the original ' +
    'IBM PC, and the CPU this machine implements.',
  jit: '“Just in time” - a compiler that translates a program into ' +
    'fast machine code at the moment it loads, instead of ' +
    'interpreting the source line by line.',
  wasm: 'WebAssembly: a fast, portable binary format browsers can ' +
    'run - how compiled languages like Rust execute inside a web page.',
  fat12: 'The floppy-era filing system DOS uses: a File Allocation ' +
    'Table mapping which 512-byte sectors belong to which file.',
  mode13h: 'The VGA graphics mode DOS games loved: 320×200 pixels, ' +
    'one byte per pixel, 256 colours from a programmable palette.',
};
