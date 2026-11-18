/**
 * AsciiRenderer — owns the <canvas>, a grid of character cells and the Z-buffer.
 *
 * Every frame:
 *   1. clear()    -> empties the cells, Z-buffer = Infinity
 *   2. drawChar / drawLine / drawRawText fill the cell buffers (depth tested)
 *   3. present()  -> paints the cell buffers to the canvas with ctx.fillText
 *
 * Rendering into buffers first (instead of calling fillText immediately) means
 * a cell that gets overwritten by a nearer surface is only painted ONCE.
 */
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
    this.cssWidth = 0;
    this.cssHeight = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Recomputes the canvas size and the grid. The grid is CENTERED:
   * leftover pixels (width - cols*charW) are split evenly into offsetX/offsetY.
   */
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

  /**
   * PHYSICAL aspect ratio of the ASCII grid. A character cell is taller than
   * wide, so cols/rows would stretch the image — we use real pixel sizes.
   */
  public getAspect(): number {
    return (this.cols * this.charW) / (this.rows * this.charH);
  }

  /** Call at the start of every frame. */
  public clear(): void {
    this.zBuffer.fill(Infinity);
    this.chars.fill('');
  }

  /**
   * Depth-tested write of one character.
   * z = distance from the camera (smaller = closer). Draws ONLY if z < buffer.
   */
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
   * Bresenham line (integer grid coordinates) with depth testing.
   * z0/z1 are the depths of the two endpoints. If z1 is omitted the line has a
   * constant depth z0 (e.g. the average W). Otherwise depth is interpolated
   * perspective-correctly (1/z is linear in screen space).
   */
  public drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    char: string,
    color: string,
    z0: number,
    z1: number = z0
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
      this.drawChar(x, y, char, color, z);

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

  /** UI text (FPS, coordinates). Always on top: ignores and overwrites the Z-buffer. */
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

    let lastColor = '';
    for (let row = 0; row < this.rows; row++) {
      const base = row * this.cols;
      const py = this.offsetY + row * this.charH;
      for (let col = 0; col < this.cols; col++) {
        const ch = this.chars[base + col];
        if (!ch || ch === ' ') continue;

        const color = this.colors[base + col] ?? '#0f0';
        if (color !== lastColor) {
          ctx.fillStyle = color; // changing fillStyle is slow -> only when needed
          lastColor = color;
        }
        ctx.fillText(ch, this.offsetX + col * this.charW, py);
      }
    }
  }
}