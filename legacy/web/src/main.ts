import { buildCss, type EmbeddedData } from './buildCss';

// ── DOM refs ───────────────────────────────────────────────────────────

const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const memSizeInput = document.getElementById('mem-size') as HTMLInputElement;
const startOffsetInput = document.getElementById('start-offset') as HTMLInputElement;
const dataFileInput = document.getElementById('data-file') as HTMLInputElement;
const dataAddrInput = document.getElementById('data-addr') as HTMLInputElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const filenameEl = document.getElementById('filename') as HTMLSpanElement;
const filesizeEl = document.getElementById('filesize') as HTMLSpanElement;
const outputsizeEl = document.getElementById('outputsize') as HTMLSpanElement;

let currentBinary: Uint8Array | null = null;
let currentFilename = '';
let currentCss = '';

// ── File handling ──────────────────────────────────────────────────────

function handleBinaryFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    currentBinary = new Uint8Array(reader.result as ArrayBuffer);
    currentFilename = file.name.replace(/\.[^.]+$/, '');
    filenameEl.textContent = file.name;
    filesizeEl.textContent = `${currentBinary.length} bytes`;
    statusEl.textContent = `Loaded ${file.name}. Ready to transpile.`;
    statusEl.className = 'status ready';
    dropZone.classList.add('has-file');
    runTranspile();
  };
  reader.readAsArrayBuffer(file);
}

async function runTranspile() {
  if (!currentBinary) return;

  statusEl.textContent = 'Transpiling...';
  statusEl.className = 'status working';
  downloadBtn.disabled = true;

  // Yield to let the UI update
  await new Promise(r => setTimeout(r, 10));

  try {
    const memSize = parseInt(memSizeInput.value, 16) || 0x600;
    const startOffset = parseInt(startOffsetInput.value) || 0;

    const embeddedData: EmbeddedData[] = [];
    if (dataFileInput.files && dataFileInput.files.length > 0) {
      const addr = parseInt(dataAddrInput.value, 16) || 0xC000;
      const buf = await dataFileInput.files[0].arrayBuffer();
      embeddedData.push({ address: addr, data: new Uint8Array(buf) });
    }

    const t0 = performance.now();
    currentCss = buildCss(currentBinary, { memSize, startOffset, embeddedData });
    const elapsed = (performance.now() - t0).toFixed(0);

    const sizeKB = (currentCss.length / 1024).toFixed(1);
    outputsizeEl.textContent = `${sizeKB} KB`;
    statusEl.textContent = `Done in ${elapsed}ms. Output: ${sizeKB} KB CSS.`;
    statusEl.className = 'status done';
    downloadBtn.disabled = false;
  } catch (e: any) {
    statusEl.textContent = `Error: ${e.message}`;
    statusEl.className = 'status error';
  }
}

// ── Events ─────────────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) handleBinaryFile(fileInput.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer?.files[0]) handleBinaryFile(e.dataTransfer.files[0]);
});

downloadBtn.addEventListener('click', () => {
  if (!currentCss) return;
  const blob = new Blob([currentCss], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentFilename}.css`;
  a.click();
  URL.revokeObjectURL(url);
});

// Re-transpile when options change
memSizeInput.addEventListener('change', runTranspile);
startOffsetInput.addEventListener('change', runTranspile);
dataFileInput.addEventListener('change', runTranspile);
dataAddrInput.addEventListener('change', runTranspile);
