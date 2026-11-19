export type ShadeFn = (z: number) => string | null;

const BG = '#000805';
const UI_MIN_LUMA = 140;
const STALE = '\u0001';

export class AsciiRenderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private readonly fontSize: number;
  public charW: number;
  public charH: number;

  public cols: number;
  public rows: number;
  public offsetX: number;
  public offsetY: number;

  public drawnCells: number;
  public dirtyCells: number;

  public zBuffer: Float32Array;
  private chars: string[];
  private colors: string[];
  private bgs: string[];
  private bold: Uint8Array;

  private prevChars: string[];
  private prevColors: string[];
  private prevBgs: string[];
  private prevBold: Uint8Array;
  private dirty: Int32Array;

  private dpr: number;
  private dcw: number;
  private dch: number;
  private dox: number;
  private doy: number;
  private devW: number;
  private devH: number;
  private fontNormal: string;
  private fontBold: string;

  private readonly liftCache: Map<string, string>;

  constructor(canvas: HTMLCanvasElement, fontSize: number = 7) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;

    this.fontSize = fontSize;
    this.charW = fontSize * 0.6;
    this.charH = Math.ceil(fontSize * 1.2);
    this.cols = 0;
    this.rows = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.drawnCells = 0;
    this.dirtyCells = 0;
    this.zBuffer = new Float32Array(0);
    this.chars = [];
    this.colors = [];
    this.bgs = [];
    this.bold = new Uint8Array(0);
    this.prevChars = [];
    this.prevColors = [];
    this.prevBgs = [];
    this.prevBold = new Uint8Array(0);
    this.dirty = new Int32Array(0);
    this.dpr = 1;
    this.dcw = fontSize * 0.6;
    this.dch = Math.ceil(fontSize * 1.2);
    this.dox = 0;
    this.doy = 0;
    this.devW = 0;
    this.devH = 0;
    this.fontNormal = '';
    this.fontBold = '';
    this.liftCache = new Map<string, string>();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.dpr = dpr;
    this.devW = Math.floor(cssW * dpr);
    this.devH = Math.floor(cssH * dpr);

    this.canvas.width = this.devW;
    this.canvas.height = this.devH;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    const fs = this.fontSize * dpr;
    this.fontNormal = `${fs}px "Courier New", monospace`;
    this.fontBold = `bold ${fs}px "Courier New", monospace`;

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.font = this.fontNormal;
    ctx.textBaseline = 'top';

    this.dcw = fs * 0.6;
    this.dch = Math.ceil(fs * 1.2);
    this.charW = this.dcw / dpr;
    this.charH = this.dch / dpr;

    this.cols = Math.max(1, Math.floor(this.devW / this.dcw));
    this.rows = Math.max(1, Math.floor(this.devH / this.dch));
    this.dox = Math.round((this.devW - this.cols * this.dcw) / 2);
    this.doy = Math.round((this.devH - this.rows * this.dch) / 2);
    this.offsetX = this.dox / dpr;
    this.offsetY = this.doy / dpr;

    const size = this.cols * this.rows;
    this.zBuffer = new Float32Array(size);
    this.zBuffer.fill(Infinity);
    this.chars = new Array<string>(size).fill('');
    this.colors = new Array<string>(size).fill('#0f0');
    this.bgs = new Array<string>(size).fill('');
    this.bold = new Uint8Array(size);
    this.prevChars = new Array<string>(size).fill(STALE);
    this.prevColors = new Array<string>(size).fill('');
    this.prevBgs = new Array<string>(size).fill(STALE);
    this.prevBold = new Uint8Array(size);
    this.dirty = new Int32Array(size);

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.devW, this.devH);
  }

  public getAspect(): number {
    return (this.cols * this.charW) / (this.rows * this.charH);
  }

  public clear(): void {
    this.zBuffer.fill(Infinity);
    this.chars.fill('');
    this.bgs.fill('');
    this.bold.fill(0);
    this.drawnCells = 0;
  }

  public drawChar(x: number, y: number, char: string, color: string, z: number): void {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || px >= this.cols || py < 0 || py >= this.rows) return;

    const index = py * this.cols + px;
    const current = this.zBuffer[index] ?? Infinity;
    if (z < current) {
      this.zBuffer[index] = z;
      this.chars[index] = char;
      this.colors[index] = color;
      this.drawnCells++;
    }
  }

  public drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    char: string,
    color: string,
    z0: number,
    z1: number = z0,
    shade?: ShadeFn
  ): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);

    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;

    const steps = Math.max(dx, -dy);
    const invZ0 = 1 / z0;
    const invZ1 = 1 / z1;
    let i = 0;

    for (;;) {
      const t = steps === 0 ? 0 : i / steps;
      const z = 1 / (invZ0 + (invZ1 - invZ0) * t);

      if (shade) {
        const c = shade(z);
        if (c !== null) this.drawChar(x, y, char, c, z);
      } else {
        this.drawChar(x, y, char, color, z);
      }

      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      i++;
    }
  }

  public drawLineFogged(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    char: string,
    z0: number,
    z1: number,
    palette: string[],
    fogStart: number,
    invRange: number
  ): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);

    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;

    const steps = Math.max(dx, -dy);
    const invZ0 = 1 / z0;
    const invZ1 = 1 / z1;
    const levels = palette.length;
    let i = 0;

    for (;;) {
      const t = steps === 0 ? 0 : i / steps;
      const z = 1 / (invZ0 + (invZ1 - invZ0) * t);
      const fade = 1 - (z - fogStart) * invRange;
      if (fade > 0) {
        const idx = Math.min(levels - 1, Math.floor(Math.min(1, fade) * levels));
        const c = palette[idx];
        if (c !== undefined) this.drawChar(x, y, char, c, z);
      }

      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      i++;
    }
  }

  public fillRect(x: number, y: number, w: number, h: number, color: string): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.cols, Math.ceil(x + w));
    const y1 = Math.min(this.rows, Math.ceil(y + h));
    if (x1 <= x0 || y1 <= y0) return;

    for (let row = y0; row < y1; row++) {
      const base = row * this.cols;
      for (let col = x0; col < x1; col++) {
        this.chars[base + col] = '';
        this.bgs[base + col] = color;
        this.bold[base + col] = 0;
        this.zBuffer[base + col] = -Infinity;
      }
    }
  }

  private lift(color: string): string {
    const cached = this.liftCache.get(color);
    if (cached !== undefined) return cached;
    let out = color;
    if (color.length === 7 && color.charAt(0) === '#') {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        const m = Math.max(r, g, b);
        if (m > 0 && m < UI_MIN_LUMA) {
          const k = UI_MIN_LUMA / m;
          out = `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`;
        }
      }
    }
    this.liftCache.set(color, out);
    return out;
  }

  public drawRawText(col: number, row: number, text: string, color: string): void {
    if (row < 0 || row >= this.rows) return;
    const c = this.lift(color);
    for (let i = 0; i < text.length; i++) {
      const cx = col + i;
      if (cx < 0 || cx >= this.cols) continue;
      const index = row * this.cols + cx;
      this.zBuffer[index] = -Infinity;
      this.chars[index] = text.charAt(i);
      this.colors[index] = c;
      this.bold[index] = 1;
    }
  }

  public glitchRows(count: number, maxShift: number): void {
    for (let i = 0; i < count; i++) {
      const row = Math.floor(Math.random() * this.rows);
      const shift = Math.round((Math.random() * 2 - 1) * maxShift);
      if (shift === 0) continue;
      const base = row * this.cols;
      const rowChars = this.chars.slice(base, base + this.cols);
      const rowColors = this.colors.slice(base, base + this.cols);
      const rowBold = this.bold.slice(base, base + this.cols);
      for (let col = 0; col < this.cols; col++) {
        const src = col - shift;
        if (src < 0 || src >= this.cols) {
          this.chars[base + col] = '';
          this.bold[base + col] = 0;
        } else {
          this.chars[base + col] = rowChars[src] ?? '';
          this.colors[base + col] = rowColors[src] ?? '#0f0';
          this.bold[base + col] = rowBold[src] ?? 0;
        }
      }
    }
  }

  public present(): void {
    const ctx = this.ctx;
    const cols = this.cols;
    const n = cols * this.rows;
    const dirty = this.dirty;
    let dc = 0;

    for (let i = 0; i < n; i++) {
      let ch = this.chars[i] ?? '';
      if (ch === ' ') ch = '';
      const bg = this.bgs[i] ?? '';
      const col = ch === '' ? '' : (this.colors[i] ?? '#0f0');
      const b = ch === '' ? 0 : (this.bold[i] ?? 0);
      if (
        ch === this.prevChars[i] &&
        col === this.prevColors[i] &&
        bg === this.prevBgs[i] &&
        b === this.prevBold[i]
      ) {
        continue;
      }
      this.prevChars[i] = ch;
      this.prevColors[i] = col;
      this.prevBgs[i] = bg;
      this.prevBold[i] = b;
      dirty[dc++] = i;
    }

    this.dirtyCells = dc;
    if (dc === 0) return;

    const dcw = this.dcw;
    const dch = this.dch;
    const dox = this.dox;
    const doy = this.doy;

    let fill = '';
    for (let k = 0; k < dc; k++) {
      const idx = dirty[k] ?? 0;
      const col = idx % cols;
      const row = (idx - col) / cols;
      const x0 = Math.round(dox + col * dcw);
      const x1 = Math.round(dox + (col + 1) * dcw);
      const y0 = Math.round(doy + row * dch);
      const bg = this.prevBgs[idx] || BG;
      if (bg !== fill) {
        ctx.fillStyle = bg;
        fill = bg;
      }
      ctx.fillRect(x0, y0, x1 - x0, dch);
    }

    let textColor = '';
    let fb = -1;
    for (let k = 0; k < dc; k++) {
      const idx = dirty[k] ?? 0;
      const ch = this.prevChars[idx] ?? '';
      if (ch === '') continue;
      const col = idx % cols;
      const row = (idx - col) / cols;
      const b = this.prevBold[idx] ?? 0;
      if (b !== fb) {
        ctx.font = b === 1 ? this.fontBold : this.fontNormal;
        fb = b;
      }
      const color = this.prevColors[idx] ?? '#0f0';
      if (color !== textColor) {
        ctx.fillStyle = color;
        textColor = color;
      }
      ctx.fillText(ch, Math.round(dox + col * dcw), Math.round(doy + row * dch));
    }
  }
}