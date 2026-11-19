interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export type ShadeFn = (z: number) => string | null;

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

  public zBuffer: Float32Array;
  private chars: string[];
  private colors: string[];

  private readonly panels: Panel[];

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
    this.panels = [];
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

  public getAspect(): number {
    return (this.cols * this.charW) / (this.rows * this.charH);
  }

  public clear(): void {
    this.zBuffer.fill(Infinity);
    this.chars.fill('');
    this.panels.length = 0;
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

  public glitchRows(count: number, maxShift: number): void {
    for (let i = 0; i < count; i++) {
      const row = Math.floor(Math.random() * this.rows);
      const shift = Math.round((Math.random() * 2 - 1) * maxShift);
      if (shift === 0) continue;
      const base = row * this.cols;
      const rowChars = this.chars.slice(base, base + this.cols);
      const rowColors = this.colors.slice(base, base + this.cols);
      for (let col = 0; col < this.cols; col++) {
        const src = col - shift;
        if (src < 0 || src >= this.cols) {
          this.chars[base + col] = '';
        } else {
          this.chars[base + col] = rowChars[src] ?? '';
          this.colors[base + col] = rowColors[src] ?? '#0f0';
        }
      }
    }
  }

  public present(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000805';
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

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