// terms.js — the dictionary behind the inline <Term> underlines.
// One or two sentences each: these render in a small hover card, not
// a paragraph. Keep ids lowercase; usage is <Term t="id">word</Term>.
export const TERMS = {
  cabinet: 'The .css file the builder produces: the machine and the ' +
    'program’s floppy disk fused into one runnable stylesheet — ' +
    'named for arcade cabinets, a computer and one game sold as a single box.',
  cart: 'The program you feed in: a folder of DOS-era files, picked or ' +
    'uploaded on the Build page.',
  register: 'One of the fourteen 16-bit cells (AX, BX, IP…) a ' +
    'processor keeps directly to hand instead of in memory. Here, each ' +
    'register is one CSS variable.',
  tick: 'One beat of the machine: every formula in the file ' +
    're-evaluates once, and one CPU instruction executes.',
  floppy: 'The 1.44 MB disk image baked into the cabinet — DOS plus ' +
    'the program’s files, byte for byte, served from CSS variables.',
  opcode: 'The number that names an instruction: the byte the CPU ' +
    'fetches each tick decides what the tick does — 184 means ' +
    '“load a value into AX”.',
  dos: 'Disk Operating System — the 1980s PC operating system ' +
    '(a DR-DOS descendant here, EDR-DOS) that boots inside the machine ' +
    'and runs the program.',
};
