/**
 * AsciiRenderer — owns the <canvas>, a grid of character cells and the Z-buffer.
 *
 * Every frame:
 *   1. clear()    -> empties the cells, Z-buffer = Infinity, drops UI panels
 *   2. drawChar / drawLine / fillRect / drawRawText fill the cell buffers
 *   3. present()  -> paints background, panels, then characters (ctx.fillText)
 */

/** CHANGED: a solid background rectangle in CELL coordinates. */
interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** CHANGED: per-pixel color lookup. Return null to skip the pixel (fully fogged). */
export type ShadeFn = (z: number) => string | null;

export class AsciiRenderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  // Font / cell metrics
  private readonly fontSize: number;
  public charW: number;
  public charH: number;

  // Grid
  public cols: number;
  public rows: number;
  public offsetX: number;
  public offsetY: number;

  // Per-cell buffers (index = y * cols + x)
  public zBuffer: Float32Array;
  private chars: string[];
  private colors: string[];

  // CHANGED: solid panels queued for this frame
  private readonly panels: Panel[];

  // CSS pixel size of the canvas
  private cssWidth: number;
  private cssHeight: number;

  constructor(canvas: HTMLCanvasElement, fontSize: number = 10) {
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
    this.zBuffer = new Float32Array(0);
    this.chars = [];
    this.colors = [];
    this.panels = []; // CHANGED
    this.cssWidth = 0;
    this.cssHeight = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = window.innerWidth;
    this.cssHeight = window.innerHeight;

    this.canvas.width = Math.floor(this.cssWidth * dpr);
    this.canvas.height = Math.floor(this.cssHeight * dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    // Setting canvas.width resets the context state -> re-apply everything.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.font = `${this.fontSize}px "Courier New", monospace`;
    this.ctx.textBaseline = 'top';

    this.charW = this.ctx.measureText('M').width || this.fontSize * 0.6;
    this.charH = Math.ceil(this.fontSize * 1.2);

    this.cols = Math.max(1, Math.floor(this.cssWidth / this.charW));
    this.rows = Math.max(1, Math.floor(this.cssHeight / this.charH));
    this.offsetX = (this.cssWidth - this.cols * this.charW) / 2;
    this.offsetY = (this.cssHeight - this.rows * this.charH) / 2;

    const size = this.cols * this.rows;
    this.zBuffer = new Float32Array(size);
    this.chars = new Array<string>(size).fill('');
    this.colors = new Array<string>(size).fill('#0f0');
    this.zBuffer.fill(Infinity);
  }

  /** PHYSICAL aspect ratio of the ASCII grid (cells are taller than wide). */
  public getAspect(): number {
    return (this.cols * this.charW) / (this.rows * this.charH);
  }

  /** Call at the start of every frame. */
  public clear(): void {
    this.zBuffer.fill(Infinity);
    this.chars.fill('');
    this.panels.length = 0; // CHANGED
  }

  /** Depth-tested write of one character. Draws ONLY if z < buffer. (unchanged) */
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
    }
  }

  /**
   * Bresenham line with perspective-correct depth.
   *
   * CHANGED: optional `shade` callback. When given, the color of EACH pixel is
   * shade(z) using that pixel's own interpolated depth (this is what makes the
   * distance fog smooth along a long line). Returning null skips the pixel.
   */
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

  /**
   * CHANGED (new): solid background rectangle, in CELL units (x, y, w, h).
   *
   * Why it is buffered: present() repaints the whole canvas every frame, so an
   * immediate ctx.fillRect would be erased. We queue the panel, wipe the cells
   * under it, and lock their Z to -Infinity so nothing drawn later (e.g. grid
   * lines) can show through. Pixel bounds are computed in present() from
   * offsetX/offsetY/charW/charH, so the panel survives window resizes.
   */
  public fillRect(x: number, y: number, w: number, h: number, color: string): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.cols, Math.ceil(x + w));
    const y1 = Math.min(this.rows, Math.ceil(y + h));
    if (x1 <= x0 || y1 <= y0) return;

    this.panels.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, color });

    for (let row = y0; row < y1; row++) {
      const base = row * this.cols;
      for (let col = x0; col < x1; col++) {
        this.chars[base + col] = '';
        this.zBuffer[base + col] = -Infinity;
      }
    }
  }

  /** UI text. Always on top: ignores and overwrites the Z-buffer. (unchanged) */
  public drawRawText(col: number, row: number, text: string, color: string): void {
    if (row < 0 || row >= this.rows) return;
    for (let i = 0; i < text.length; i++) {
      const cx = col + i;
      if (cx < 0 || cx >= this.cols) continue;
      const index = row * this.cols + cx;
      this.zBuffer[index] = -Infinity;
      this.chars[index] = text.charAt(i);
      this.colors[index] = color;
    }
  }

  /** Paints the cell buffers onto the canvas. Call once per frame, after drawing. */
  public present(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000805';
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // CHANGED: panels go AFTER the background and BEFORE the characters.
    for (const p of this.panels) {
      ctx.fillStyle = p.color;
      ctx.fillRect(
        this.offsetX + p.x * this.charW,
        this.offsetY + p.y * this.charH,
        p.w * this.charW,
        p.h * this.charH
      );
    }

    let lastColor = '';
    for (let row = 0; row < this.rows; row++) {
      const base = row * this.cols;
      const py = this.offsetY + row * this.charH;
      for (let col = 0; col < this.cols; col++) {
        const ch = this.chars[base + col];
        if (!ch || ch === ' ') continue;

        const color = this.colors[base + col] ?? '#0f0';
        if (color !== lastColor) {
          ctx.fillStyle = color;
          lastColor = color;
        }
        ctx.fillText(ch, this.offsetX + col * this.charW, py);
      }
    }
  }
}