// FILE: src/engine/renderer/WebGLRenderer.ts
import {
  DEFAULT_RENDER_CONFIGURATION,
  resolveGrid,
  resolveQualityProfile,
  resolveRenderProfile,
  type QualityProfile,
  type RenderConfiguration,
  type RenderProfile,
} from '../core/RenderConfig';

export type ShadeFn = (z: number) => string | null;

const BG_R = 0;
const BG_G = 8 / 255;
const BG_B = 5 / 255;
const BG_CSS = '#000805';
const UI_MIN_LUMA = 140;
const FLOATS = 11;
const ATLAS_COLS = 16;
const ATLAS_ROWS = 32;
const ATLAS_CELL_W = 32;
const ATLAS_CELL_H = 64;
const ATLAS_FONT_PX = 52;
const COLOR_CACHE_MAX = 16384;
const MAX_DEPTH = 1000;

const VERTEX_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_cell;
layout(location = 2) in vec3 a_color;
layout(location = 3) in float a_glyph;
layout(location = 4) in float a_depth;
layout(location = 5) in vec4 a_bg;
uniform vec2 u_cellSize;
uniform vec2 u_origin;
uniform vec2 u_res;
uniform vec2 u_atlas;
out vec2 v_uv;
out vec3 v_color;
out vec4 v_bg;
flat out float v_glyph;
void main() {
  vec2 p0 = floor(u_origin + a_cell * u_cellSize + 0.5);
  vec2 p1 = floor(u_origin + (a_cell + 1.0) * u_cellSize + 0.5);
  vec2 p = mix(p0, p1, a_corner);
  vec2 ndc = vec2(p.x / u_res.x * 2.0 - 1.0, 1.0 - p.y / u_res.y * 2.0);
  gl_Position = vec4(ndc, clamp(a_depth * 0.001, 0.0, 1.0) * 2.0 - 1.0, 1.0);
  float idx = max(a_glyph, 0.0);
  float col = mod(idx, u_atlas.x);
  float row = floor(idx / u_atlas.x);
  v_uv = (vec2(col, row) + a_corner) / u_atlas;
  v_color = a_color;
  v_bg = a_bg;
  v_glyph = a_glyph;
}
`;

const FRAGMENT_SRC = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_clear;
in vec2 v_uv;
in vec3 v_color;
in vec4 v_bg;
flat in float v_glyph;
out vec4 outColor;
void main() {
  float a = v_glyph >= 0.0 ? texture(u_tex, v_uv).a : 0.0;
  bool hasBg = v_bg.a > 0.5;
  if (!hasBg && a <= 0.0) discard;
  vec3 base = hasBg ? v_bg.rgb : u_clear;
  outColor = vec4(mix(base, v_color, a), 1.0);
}
`;

function sameProfile(a: RenderProfile, b: RenderProfile): boolean {
  return (
    a.devW === b.devW &&
    a.devH === b.devH &&
    a.displayW === b.displayW &&
    a.displayH === b.displayH &&
    a.left === b.left &&
    a.top === b.top &&
    a.pixelRatio === b.pixelRatio &&
    a.densityFactor === b.densityFactor
  );
}

function clamp255(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shader creation failed');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown';
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Program creation failed');
  const v = compileShader(gl, gl.VERTEX_SHADER, vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown';
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(v);
  gl.deleteShader(f);
  return program;
}

export class WebGLRenderer {
  public readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly octx: CanvasRenderingContext2D;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly cornerBuffer: WebGLBuffer;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly atlasTexture: WebGLTexture;
  private readonly uCellSize: WebGLUniformLocation | null;
  private readonly uOrigin: WebGLUniformLocation | null;
  private readonly uRes: WebGLUniformLocation | null;
  private readonly uAtlas: WebGLUniformLocation | null;
  private readonly uTex: WebGLUniformLocation | null;
  private readonly uClear: WebGLUniformLocation | null;

  private readonly fontSize: number;
  public charW: number;
  public charH: number;

  public cols: number;
  public rows: number;
  public offsetX: number;
  public offsetY: number;

  public zBuffer: Float32Array;
  private chars: Uint16Array;
  private colors: Uint32Array;
  private bgs: Int32Array;
  private bold: Uint8Array;
  private instData: Float32Array;

  private config: RenderConfiguration;
  private profile: RenderProfile;
  public quality: QualityProfile;

  private pixelRatio: number;
  private dcw: number;
  private dch: number;
  private dox: number;
  private doy: number;
  public devW: number;
  public devH: number;
  private fontNormal: string;

  private readonly colorCache: Map<string, number>;
  private readonly liftCache: Map<string, number>;

  constructor(
    canvas: HTMLCanvasElement,
    fontSize: number = 7,
    config: RenderConfiguration = DEFAULT_RENDER_CONFIGURATION
  ) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;

    this.overlay = document.createElement('canvas');
    const octx = this.overlay.getContext('2d');
    if (!octx) throw new Error('2D overlay context not available');
    this.octx = octx;
    this.overlay.style.position = 'absolute';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.zIndex = '1';
    const parent = canvas.parentElement ?? document.body;
    parent.appendChild(this.overlay);

    this.program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
    this.uCellSize = gl.getUniformLocation(this.program, 'u_cellSize');
    this.uOrigin = gl.getUniformLocation(this.program, 'u_origin');
    this.uRes = gl.getUniformLocation(this.program, 'u_res');
    this.uAtlas = gl.getUniformLocation(this.program, 'u_atlas');
    this.uTex = gl.getUniformLocation(this.program, 'u_tex');
    this.uClear = gl.getUniformLocation(this.program, 'u_clear');

    const vao = gl.createVertexArray();
    const cornerBuffer = gl.createBuffer();
    const instanceBuffer = gl.createBuffer();
    const atlasTexture = gl.createTexture();
    if (!vao || !cornerBuffer || !instanceBuffer || !atlasTexture) throw new Error('GL resource creation failed');
    this.vao = vao;
    this.cornerBuffer = cornerBuffer;
    this.instanceBuffer = instanceBuffer;
    this.atlasTexture = atlasTexture;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 20);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 28);
    gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null);

    this.buildAtlas();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    this.fontSize = fontSize;
    this.config = config;
    this.quality = resolveQualityProfile(config.quality);
    this.profile = resolveRenderProfile(config, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    this.charW = fontSize * 0.6;
    this.charH = Math.ceil(fontSize * 1.2);
    this.cols = 0;
    this.rows = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.zBuffer = new Float32Array(0);
    this.chars = new Uint16Array(0);
    this.colors = new Uint32Array(0);
    this.bgs = new Int32Array(0);
    this.bold = new Uint8Array(0);
    this.instData = new Float32Array(0);
    this.pixelRatio = 1;
    this.dcw = fontSize * 0.6;
    this.dch = Math.ceil(fontSize * 1.2);
    this.dox = 0;
    this.doy = 0;
    this.devW = 0;
    this.devH = 0;
    this.fontNormal = '';
    this.colorCache = new Map<string, number>();
    this.liftCache = new Map<string, number>();

    this.applyProfile();
    window.addEventListener('resize', () => this.resize());
  }

  public get charWidth(): number {
    return this.charW;
  }

  public get charHeight(): number {
    return this.charH;
  }

  private buildAtlas(): void {
    const gl = this.gl;
    const atlas = document.createElement('canvas');
    atlas.width = ATLAS_COLS * ATLAS_CELL_W;
    atlas.height = ATLAS_ROWS * ATLAS_CELL_H;
    const actx = atlas.getContext('2d');
    if (!actx) throw new Error('Atlas context not available');
    actx.clearRect(0, 0, atlas.width, atlas.height);
    actx.fillStyle = '#ffffff';
    actx.textAlign = 'center';
    actx.textBaseline = 'middle';
    for (let variant = 0; variant < 2; variant++) {
      actx.font = `${variant === 1 ? 'bold ' : ''}${ATLAS_FONT_PX}px "Courier New", monospace`;
      for (let code = 33; code < 127; code++) {
        const idx = code + variant * 256;
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        actx.fillText(
          String.fromCharCode(code),
          col * ATLAS_CELL_W + ATLAS_CELL_W / 2,
          row * ATLAS_CELL_H + ATLAS_CELL_H / 2
        );
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  public setConfig(config: RenderConfiguration): void {
    this.config = config;
    this.quality = resolveQualityProfile(config.quality);
    this.resize();
  }

  public resize(): void {
    const next = resolveRenderProfile(
      this.config,
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio || 1
    );
    if (sameProfile(this.profile, next)) return;
    this.profile = next;
    this.applyProfile();
  }

  private applyProfile(): void {
    const p = this.profile;
    this.pixelRatio = p.pixelRatio;
    this.devW = p.devW;
    this.devH = p.devH;

    for (const c of [this.canvas, this.overlay]) {
      c.width = this.devW;
      c.height = this.devH;
      c.style.position = 'absolute';
      c.style.left = `${p.left}px`;
      c.style.top = `${p.top}px`;
      c.style.width = `${p.displayW}px`;
      c.style.height = `${p.displayH}px`;
    }

    const g = resolveGrid(p, this.fontSize);
    this.fontNormal = `${g.fontPx}px "Courier New", monospace`;

    this.dcw = g.cellW;
    this.dch = g.cellH;
    this.charW = this.dcw / this.pixelRatio;
    this.charH = this.dch / this.pixelRatio;

    this.cols = g.cols;
    this.rows = g.rows;
    this.dox = Math.round((this.devW - this.cols * this.dcw) / 2);
    this.doy = Math.round((this.devH - this.rows * this.dch) / 2);
    this.offsetX = p.left + this.dox / this.pixelRatio;
    this.offsetY = p.top + this.doy / this.pixelRatio;

    const size = this.cols * this.rows;
    this.zBuffer = new Float32Array(size);
    this.zBuffer.fill(Infinity);
    this.chars = new Uint16Array(size);
    this.colors = new Uint32Array(size);
    this.colors.fill(0x00ff00);
    this.bgs = new Int32Array(size);
    this.bgs.fill(-1);
    this.bold = new Uint8Array(size);
    this.instData = new Float32Array(size * FLOATS);

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instData.byteLength, gl.DYNAMIC_DRAW);
    gl.viewport(0, 0, this.devW, this.devH);
    gl.clearColor(BG_R, BG_G, BG_B, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.octx.clearRect(0, 0, this.devW, this.devH);
  }

  public getAspect(): number {
    return (this.cols * this.charW) / (this.rows * this.charH);
  }

  private toPacked(color: string): number {
    const cached = this.colorCache.get(color);
    if (cached !== undefined) return cached;
    let v = 0;
    if (color.charAt(0) === '#') {
      if (color.length === 7) {
        v = parseInt(color.slice(1), 16);
      } else if (color.length === 4) {
        const r = parseInt(color.charAt(1), 16) * 17;
        const g = parseInt(color.charAt(2), 16) * 17;
        const b = parseInt(color.charAt(3), 16) * 17;
        v = (r << 16) | (g << 8) | b;
      }
    } else if (color.startsWith('rgb(')) {
      const parts = color.slice(4, color.length - 1).split(',');
      const r = clamp255(parseFloat(parts[0] ?? '0'));
      const g = clamp255(parseFloat(parts[1] ?? '0'));
      const b = clamp255(parseFloat(parts[2] ?? '0'));
      v = (r << 16) | (g << 8) | b;
    }
    if (Number.isNaN(v)) v = 0;
    if (this.colorCache.size >= COLOR_CACHE_MAX) this.colorCache.clear();
    this.colorCache.set(color, v);
    return v;
  }

  public clear(): void {
    this.zBuffer.fill(Infinity);
    this.chars.fill(0);
    this.bgs.fill(-1);
    this.bold.fill(0);
  }

  public drawChar(x: number, y: number, char: string, color: string, z: number): void {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || px >= this.cols || py < 0 || py >= this.rows) return;

    const index = py * this.cols + px;
    const current = this.zBuffer[index] ?? Infinity;
    if (z < current) {
      let code = char.length === 0 ? 0 : char.charCodeAt(0);
      if (code > 255) code = 63;
      this.zBuffer[index] = z;
      this.chars[index] = code;
      this.colors[index] = this.toPacked(color);
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

    const packed = this.toPacked(color);
    for (let row = y0; row < y1; row++) {
      const base = row * this.cols;
      for (let col = x0; col < x1; col++) {
        this.chars[base + col] = 0;
        this.bgs[base + col] = packed;
        this.bold[base + col] = 0;
        this.zBuffer[base + col] = -Infinity;
      }
    }
  }

  private lift(color: string): number {
    const cached = this.liftCache.get(color);
    if (cached !== undefined) return cached;
    const packed = this.toPacked(color);
    let r = (packed >> 16) & 255;
    let g = (packed >> 8) & 255;
    let b = packed & 255;
    const m = Math.max(r, g, b);
    if (m > 0 && m < UI_MIN_LUMA) {
      const k = UI_MIN_LUMA / m;
      r = Math.min(255, Math.round(r * k));
      g = Math.min(255, Math.round(g * k));
      b = Math.min(255, Math.round(b * k));
    }
    const out = (r << 16) | (g << 8) | b;
    if (this.liftCache.size >= COLOR_CACHE_MAX) this.liftCache.clear();
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
      let code = text.charCodeAt(i);
      if (code > 255) code = 63;
      this.zBuffer[index] = -Infinity;
      this.chars[index] = code;
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
          this.chars[base + col] = 0;
          this.bold[base + col] = 0;
        } else {
          this.chars[base + col] = rowChars[src] ?? 0;
          this.colors[base + col] = rowColors[src] ?? 0x00ff00;
          this.bold[base + col] = rowBold[src] ?? 0;
        }
      }
    }
  }

  public drawHudOverlay(lines: ReadonlyArray<{ readonly text: string; readonly color: string }>): void {
    const ctx = this.octx;
    ctx.clearRect(0, 0, this.devW, this.devH);

    const baseFontPx = Number.parseFloat(this.fontNormal) || this.fontSize;
    const fontPx = Math.max(12, baseFontPx * 1.45);
    const lineHeight = Math.ceil(fontPx * 1.65);
    const padX = Math.ceil(fontPx * 0.9);
    const padY = Math.ceil(fontPx * 0.75);
    const x = Math.max(8, Math.round(this.dox + 8));
    const y = Math.max(8, Math.round(this.doy + 8));
    const maxWidth = Math.max(0, this.devW - x - 16);

    ctx.save();
    ctx.font = `bold ${fontPx}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    let textWidth = 0;
    for (const line of lines) {
      if (line.text.length === 0) continue;
      textWidth = Math.max(textWidth, ctx.measureText(line.text).width);
    }

    const panelW = Math.min(maxWidth, Math.ceil(textWidth + padX * 2));
    const panelH = Math.min(this.devH - y - 8, padY * 2 + lines.length * lineHeight);

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = BG_CSS;
    ctx.fillRect(x, y, panelW, panelH);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#145b43';
    ctx.lineWidth = Math.max(1, fontPx * 0.055);
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, panelW - 1), Math.max(0, panelH - 1));

    ctx.beginPath();
    ctx.rect(x + padX, y + padY, Math.max(0, panelW - padX * 2), Math.max(0, panelH - padY * 2));
    ctx.clip();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.text.length === 0) continue;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, x + padX, y + padY + i * lineHeight);
    }

    ctx.restore();
  }

  public present(): void {
    const gl = this.gl;
    const cols = this.cols;
    const n = cols * this.rows;
    const inst = this.instData;
    let count = 0;

    for (let i = 0; i < n; i++) {
      const code = this.chars[i] ?? 0;
      const bg = this.bgs[i] ?? -1;
      const glyph = code > 32;
      if (!glyph && bg < 0) continue;

      const col = i % cols;
      const row = (i - col) / cols;
      const o = count * FLOATS;
      inst[o] = col;
      inst[o + 1] = row;

      if (glyph) {
        const c = this.colors[i] ?? 0;
        inst[o + 2] = ((c >> 16) & 255) / 255;
        inst[o + 3] = ((c >> 8) & 255) / 255;
        inst[o + 4] = (c & 255) / 255;
        inst[o + 5] = code + ((this.bold[i] ?? 0) === 1 ? 256 : 0);
      } else {
        inst[o + 2] = 0;
        inst[o + 3] = 0;
        inst[o + 4] = 0;
        inst[o + 5] = -1;
      }

      const z = this.zBuffer[i] ?? 0;
      inst[o + 6] = Math.max(0, Math.min(MAX_DEPTH, z));

      if (bg >= 0) {
        inst[o + 7] = ((bg >> 16) & 255) / 255;
        inst[o + 8] = ((bg >> 8) & 255) / 255;
        inst[o + 9] = (bg & 255) / 255;
        inst[o + 10] = 1;
      } else {
        inst[o + 7] = 0;
        inst[o + 8] = 0;
        inst[o + 9] = 0;
        inst[o + 10] = 0;
      }
      count++;
    }

    gl.viewport(0, 0, this.devW, this.devH);
    gl.clearColor(BG_R, BG_G, BG_B, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (count === 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uCellSize, this.dcw, this.dch);
    gl.uniform2f(this.uOrigin, this.dox, this.doy);
    gl.uniform2f(this.uRes, this.devW, this.devH);
    gl.uniform2f(this.uAtlas, ATLAS_COLS, ATLAS_ROWS);
    gl.uniform3f(this.uClear, BG_R, BG_G, BG_B);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.uTex, 0);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, count * FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  }
}