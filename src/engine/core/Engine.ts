import { Vector3 } from '../math/Vector3';
import { Matrix4, type Vec4 } from '../math/Matrix4';
import { AsciiRenderer } from '../renderer/AsciiRenderer';
import { Input } from './Input';

interface ScreenVertex {
  x: number;
  y: number;
  z: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Particle {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
  char: string;
  color: string;
  gravity: number;
}

interface InventoryItem {
  name: string;
  char: string;
  color: string;
  detail: string;
}

interface InventoryLayout {
  panelX: number;
  panelY: number;
  panelW: number;
  panelH: number;
  gridX: number;
  gridY: number;
}

type NpcState = 'idle' | 'chase';

const ASCII_RAMP = ' .:-=+*#%@';

const NEAR = 0.5;
const FAR = 100;
const FOV = Math.PI / 3;

const GRID_HALF = 40;
const MOVE_SPEED = 6;

const CAMERA_PITCH = -Math.PI / 3;
const CAMERA_HEIGHT = 10;

const FOG_LEVELS = 24;

const CUBE_HALF = 0.5;
const ATTACK_RANGE = 2.5;
const ATTACK_DAMAGE = 10;
const HIT_FLASH_TIME = 0.2;
const PLAYER_MAX_HP = 100;
const NPC_MAX_HP = 100;
const TARGET_UI_RANGE = 8;

const NPC_START_X = 6;
const NPC_START_Z = -4;
const NPC_CHASE_RANGE = 12;
const NPC_ATTACK_RANGE = 1.8;
const NPC_STOP_DISTANCE = 1.2;
const NPC_SPEED = 3.5;
const NPC_ATTACK_DAMAGE = 10;
const NPC_ATTACK_COOLDOWN = 1;

const GRAVITY = 9.8;
const SPARK_MIN = 5;
const SPARK_MAX = 8;
const SPARK_LIFE = 0.6;
const INDICATOR_LIFE = 0.9;
const PARTICLE_DEPTH_BIAS = 0.3;
const MAX_PARTICLES = 512;
const SPARK_COLORS: string[] = ['#ffffff', '#ffee55', '#ffd028'];
const BLOOD_COLORS: string[] = ['#ff0000', '#ff2020', '#ff5555'];

const PLAYER_RGB: Rgb = { r: 40, g: 255, b: 170 };
const NPC_RGB: Rgb = { r: 255, g: 40, b: 160 };
const FLASH_RGB: Rgb = { r: 255, g: 255, b: 255 };

const INV_COLS = 4;
const INV_ROWS = 3;
const SLOT_W = 9;
const SLOT_H = 5;
const SLOT_GAP = 1;
const PANEL_PAD_X = 3;
const PANEL_PAD_TOP = 3;
const PANEL_PAD_BOTTOM = 4;
const DIM_FACTOR = 0.3;

const HP_BAR_COL = 21;
const HP_BAR_WIDTH = 16;

const INV_PANEL_BG = '#000f08';
const INV_SLOT_HOVER_BG = '#0a3a2a';
const INV_BORDER = '#1f8a62';
const INV_BORDER_HOVER = '#ffffff';
const INV_TITLE = '#00ff9c';
const INV_INFO = '#00d4ff';

export class Engine {
  private readonly renderer: AsciiRenderer;
  private readonly input: Input;

  private readonly playerPos: Vector3;
  private facing: number;
  private playerHealth: number;

  private readonly npcPos: Vector3;
  private npcHealth: number;
  private npcHitTimer: number;
  private npcState: NpcState;
  private npcAttackCooldown: number;
  private npcFacing: number;

  private readonly particles: Particle[];

  private isInventoryOpen: boolean;
  private readonly inventoryItems: Array<InventoryItem | null>;
  private hoverSlot: number;

  private readonly pitch: number;
  private readonly yaw: number;
  private readonly cameraOffset: Vector3;
  private cameraPos: Vector3;

  private readonly fogStart: number;
  private readonly fogEnd: number;
  private readonly majorPalette: string[];
  private readonly minorPalette: string[];
  private readonly dimMajorPalette: string[];
  private readonly dimMinorPalette: string[];

  private readonly cubeVertices: Vector3[];
  private readonly cubeFaces: number[][];

  private readonly lightDir: Vector3;

  private lastTime: number;
  private fps: number;
  private running: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new AsciiRenderer(canvas, 10);
    this.input = new Input();

    this.playerPos = new Vector3(0, 0, 0);
    this.facing = 0;
    this.playerHealth = PLAYER_MAX_HP;

    this.npcPos = new Vector3(NPC_START_X, 0, NPC_START_Z);
    this.npcHealth = NPC_MAX_HP;
    this.npcHitTimer = 0;
    this.npcState = 'idle';
    this.npcAttackCooldown = 0;
    this.npcFacing = 0;

    this.particles = [];

    this.isInventoryOpen = false;
    this.hoverSlot = -1;
    this.inventoryItems = new Array<InventoryItem | null>(INV_COLS * INV_ROWS).fill(null);
    this.inventoryItems[0] = { name: 'Iron Sword', char: 'S', color: '#e8e8e8', detail: 'ATK +12' };
    this.inventoryItems[1] = { name: 'Health Potion', char: 'P', color: '#ff3355', detail: 'Restores 40 HP' };
    this.inventoryItems[2] = { name: 'Gold Coins', char: '$', color: '#ffd028', detail: 'x 120' };
    this.inventoryItems[5] = { name: 'Mana Potion', char: 'P', color: '#33aaff', detail: 'Restores 25 MP' };
    this.inventoryItems[7] = { name: 'Oak Shield', char: 'O', color: '#c8863a', detail: 'DEF +6' };
    this.inventoryItems[10] = { name: 'Ancient Key', char: 'k', color: '#b266ff', detail: 'Opens something' };

    this.pitch = CAMERA_PITCH;
    this.yaw = 0;
    const tilt = -this.pitch;
    const backDist = CAMERA_HEIGHT / Math.tan(tilt);
    this.cameraOffset = new Vector3(0, CAMERA_HEIGHT, backDist);
    this.cameraPos = this.playerPos.add(this.cameraOffset);

    const playerDepth = CAMERA_HEIGHT * Math.sin(tilt) + backDist * Math.cos(tilt);
    const topAngle = tilt - FOV / 2;
    const topDepth =
      topAngle > 0.05
        ? CAMERA_HEIGHT * Math.sin(tilt) + (CAMERA_HEIGHT / Math.tan(topAngle)) * Math.cos(tilt)
        : FAR;
    this.fogStart = playerDepth;
    this.fogEnd = Math.max(playerDepth + 1, topDepth * 0.95);
    this.majorPalette = Engine.buildPalette(150);
    this.minorPalette = Engine.buildPalette(70);
    this.dimMajorPalette = Engine.buildPalette(150 * DIM_FACTOR);
    this.dimMinorPalette = Engine.buildPalette(70 * DIM_FACTOR);

    const h = CUBE_HALF;
    this.cubeVertices = [
      new Vector3(-h, -h, -h),
      new Vector3(h, -h, -h),
      new Vector3(h, h, -h),
      new Vector3(-h, h, -h),
      new Vector3(-h, -h, h),
      new Vector3(h, -h, h),
      new Vector3(h, h, h),
      new Vector3(-h, h, h),
    ];
    this.cubeFaces = [
      [4, 5, 6, 7],
      [1, 0, 3, 2],
      [5, 1, 2, 6],
      [0, 4, 7, 3],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ];

    this.lightDir = new Vector3(-0.4, 1.0, 0.6).normalize();

    this.lastTime = 0;
    this.fps = 60;
    this.running = false;
  }

  private static buildPalette(base: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < FOG_LEVELS; i++) {
      const f = (i + 1) / FOG_LEVELS;
      out.push(`rgb(0,${Math.floor(base * f)},${Math.floor(base * 0.7 * f)})`);
    }
    return out;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.running = false;
  }

  private readonly loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);
    this.render();
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    requestAnimationFrame(this.loop);
  };

  private npcAlive(): boolean {
    return this.npcHealth > 0;
  }

  private collidesWithNpc(x: number, z: number): boolean {
    if (!this.npcAlive()) return false;
    const limit = CUBE_HALF * 2;
    return Math.abs(x - this.npcPos.x) < limit && Math.abs(z - this.npcPos.z) < limit;
  }

  private npcCollidesWithPlayer(x: number, z: number): boolean {
    const limit = CUBE_HALF * 2;
    return Math.abs(x - this.playerPos.x) < limit && Math.abs(z - this.playerPos.z) < limit;
  }

  private distanceToNpc(): number {
    const dx = this.npcPos.x - this.playerPos.x;
    const dz = this.npcPos.z - this.playerPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private spawnHitEffect(pos: Vector3, colors: string[]): void {
    const origin = new Vector3(pos.x, pos.y + CUBE_HALF * 2, pos.z);
    const count = SPARK_MIN + Math.floor(Math.random() * (SPARK_MAX - SPARK_MIN + 1));

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const life = SPARK_LIFE * (0.6 + Math.random() * 0.4);
      this.particles.push({
        pos: origin.clone(),
        vel: new Vector3(Math.cos(angle) * speed, 3 + Math.random() * 3, Math.sin(angle) * speed),
        life,
        maxLife: life,
        char: '*',
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff',
        gravity: GRAVITY,
      });
    }

    if (this.particles.length < MAX_PARTICLES) {
      this.particles.push({
        pos: new Vector3(origin.x, origin.y + 0.5, origin.z),
        vel: new Vector3(0, 1.8, 0),
        life: INDICATOR_LIFE,
        maxLife: INDICATOR_LIFE,
        char: '-',
        color: '#ff2020',
        gravity: 0,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;

      p.life -= dt;
      if (p.life <= 0) {
        const last = this.particles[this.particles.length - 1];
        if (last) this.particles[i] = last;
        this.particles.pop();
        continue;
      }

      p.vel.y -= p.gravity * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;

      if (p.pos.y < 0 && p.gravity > 0) {
        p.pos.y = 0;
        p.vel.y = 0;
        p.vel.x *= 0.5;
        p.vel.z *= 0.5;
      }
    }
  }

  private updateNpc(dt: number): void {
    if (!this.npcAlive()) return;

    if (this.npcAttackCooldown > 0) this.npcAttackCooldown = Math.max(0, this.npcAttackCooldown - dt);

    const dist = this.distanceToNpc();
    this.npcState = dist < NPC_CHASE_RANGE ? 'chase' : 'idle';
    if (this.npcState !== 'chase') return;

    const toX = this.playerPos.x - this.npcPos.x;
    const toZ = this.playerPos.z - this.npcPos.z;
    const dir = new Vector3(toX, 0, toZ).normalize();

    if (dist > NPC_STOP_DISTANCE) {
      const nextX = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.npcPos.x + dir.x * NPC_SPEED * dt));
      if (!this.npcCollidesWithPlayer(nextX, this.npcPos.z)) this.npcPos.x = nextX;

      const nextZ = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.npcPos.z + dir.z * NPC_SPEED * dt));
      if (!this.npcCollidesWithPlayer(this.npcPos.x, nextZ)) this.npcPos.z = nextZ;
    } else {
      const push = (NPC_STOP_DISTANCE - dist) * 0.5;
      this.npcPos.x -= dir.x * push;
      this.npcPos.z -= dir.z * push;
    }

    const target = Math.atan2(dir.x, dir.z);
    let diff = target - this.npcFacing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.npcFacing += diff * (1 - Math.exp(-10 * dt));

    if (this.distanceToNpc() < NPC_ATTACK_RANGE && this.npcAttackCooldown <= 0) {
      this.playerHealth = Math.max(0, this.playerHealth - NPC_ATTACK_DAMAGE);
      this.npcAttackCooldown = NPC_ATTACK_COOLDOWN;
      this.spawnHitEffect(this.playerPos, BLOOD_COLORS);
    }
  }

  private respawn(): void {
    this.playerHealth = PLAYER_MAX_HP;
    this.playerPos.x = 0;
    this.playerPos.y = 0;
    this.playerPos.z = 0;
    this.facing = 0;
    this.cameraPos = this.playerPos.add(this.cameraOffset);

    this.npcHealth = NPC_MAX_HP;
    this.npcPos.x = NPC_START_X;
    this.npcPos.y = 0;
    this.npcPos.z = NPC_START_Z;
    this.npcState = 'idle';
    this.npcAttackCooldown = 0;
    this.npcHitTimer = 0;
    this.npcFacing = 0;
  }

  private getInventoryLayout(): InventoryLayout {
    const r = this.renderer;
    const gridW = INV_COLS * SLOT_W + (INV_COLS - 1) * SLOT_GAP;
    const gridH = INV_ROWS * SLOT_H + (INV_ROWS - 1) * SLOT_GAP;
    const panelW = gridW + PANEL_PAD_X * 2;
    const panelH = gridH + PANEL_PAD_TOP + PANEL_PAD_BOTTOM;
    const panelX = Math.floor((r.cols - panelW) / 2);
    const panelY = Math.floor((r.rows - panelH) / 2);
    return {
      panelX,
      panelY,
      panelW,
      panelH,
      gridX: panelX + PANEL_PAD_X,
      gridY: panelY + PANEL_PAD_TOP,
    };
  }

  private slotAtMouse(): number {
    const r = this.renderer;
    const layout = this.getInventoryLayout();
    const col = Math.floor((this.input.mouseX - r.offsetX) / r.charW);
    const row = Math.floor((this.input.mouseY - r.offsetY) / r.charH);

    const gx = col - layout.gridX;
    const gy = row - layout.gridY;
    if (gx < 0 || gy < 0) return -1;

    const sc = Math.floor(gx / (SLOT_W + SLOT_GAP));
    const sr = Math.floor(gy / (SLOT_H + SLOT_GAP));
    if (sc >= INV_COLS || sr >= INV_ROWS) return -1;

    if (gx - sc * (SLOT_W + SLOT_GAP) >= SLOT_W) return -1;
    if (gy - sr * (SLOT_H + SLOT_GAP) >= SLOT_H) return -1;

    return sr * INV_COLS + sc;
  }

  private update(dt: number): void {
    if (this.input.inventoryJustPressed) {
      this.isInventoryOpen = !this.isInventoryOpen;
      this.hoverSlot = -1;
    }
    this.input.inventoryJustPressed = false;

    if (this.isInventoryOpen) {
      this.hoverSlot = this.slotAtMouse();
      this.input.actionJustPressed = false;
      return;
    }

    let dx = 0;
    let dz = 0;
    if (this.input.forward) dz -= 1;
    if (this.input.backward) dz += 1;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const dir = new Vector3(dx, 0, dz).normalize();

      const nextX = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.playerPos.x + dir.x * MOVE_SPEED * dt));
      if (!this.collidesWithNpc(nextX, this.playerPos.z)) this.playerPos.x = nextX;

      const nextZ = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.playerPos.z + dir.z * MOVE_SPEED * dt));
      if (!this.collidesWithNpc(this.playerPos.x, nextZ)) this.playerPos.z = nextZ;

      const target = Math.atan2(dir.x, dir.z);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * (1 - Math.exp(-14 * dt));
    }

    if (this.input.actionJustPressed && this.npcAlive()) {
      if (this.distanceToNpc() < ATTACK_RANGE) {
        this.npcHealth = Math.max(0, this.npcHealth - ATTACK_DAMAGE);
        this.npcHitTimer = HIT_FLASH_TIME;
        this.spawnHitEffect(this.npcPos, SPARK_COLORS);
      }
    }
    this.input.actionJustPressed = false;

    if (this.npcHitTimer > 0) this.npcHitTimer = Math.max(0, this.npcHitTimer - dt);

    this.updateNpc(dt);

    if (this.playerHealth <= 0) this.respawn();

    this.updateParticles(dt);

    const desired = this.playerPos.add(this.cameraOffset);
    const k = 1 - Math.exp(-8 * dt);
    this.cameraPos = this.cameraPos.add(desired.subtract(this.cameraPos).multiply(k));
  }

  private render(): void {
    const r = this.renderer;
    r.clear();

    const proj = Matrix4.perspective(FOV, r.getAspect(), NEAR, FAR);
    const rotX = Matrix4.rotationX(-this.pitch);
    const rotY = Matrix4.rotationY(-this.yaw);
    const trans = Matrix4.translation(-this.cameraPos.x, -this.cameraPos.y, -this.cameraPos.z);
    const viewProj = proj.multiply(rotX).multiply(rotY).multiply(trans);

    const dim = this.isInventoryOpen ? DIM_FACTOR : 1;

    this.drawFloor(viewProj);
    if (this.npcAlive()) {
      const base = this.npcHitTimer > 0 ? FLASH_RGB : NPC_RGB;
      this.drawCube(viewProj, this.npcPos, this.npcFacing, { r: base.r * dim, g: base.g * dim, b: base.b * dim });
    }
    this.drawCube(viewProj, this.playerPos, this.facing, {
      r: PLAYER_RGB.r * dim,
      g: PLAYER_RGB.g * dim,
      b: PLAYER_RGB.b * dim,
    });
    this.drawParticles(viewProj);
    this.drawUI();
    if (this.isInventoryOpen) this.drawInventory();

    r.present();
  }

  private drawParticles(viewProj: Matrix4): void {
    const dimmed = this.isInventoryOpen;
    for (const p of this.particles) {
      const clip = viewProj.transformPointWithW(p.pos);
      if (clip.w <= NEAR) continue;
      const s = this.toScreen(clip);
      this.renderer.drawChar(s.x, s.y, p.char, dimmed ? '#0a3a2a' : p.color, s.z - PARTICLE_DEPTH_BIAS);
    }
  }

  private toScreen(c: Vec4): ScreenVertex {
    const invW = 1 / c.w;
    return {
      x: (c.x * invW * 0.5 + 0.5) * this.renderer.cols,
      y: (1 - (c.y * invW * 0.5 + 0.5)) * this.renderer.rows,
      z: c.w,
    };
  }

  private drawFloor(viewProj: Matrix4): void {
    for (let i = -GRID_HALF; i <= GRID_HALF; i++) {
      const major = i % 5 === 0;
      this.drawWorldLine(new Vector3(-GRID_HALF, 0, i), new Vector3(GRID_HALF, 0, i), viewProj, major);
      this.drawWorldLine(new Vector3(i, 0, -GRID_HALF), new Vector3(i, 0, GRID_HALF), viewProj, major);
    }
  }

  private drawWorldLine(a: Vector3, b: Vector3, viewProj: Matrix4, major: boolean): void {
    let ca = viewProj.transformPointWithW(a);
    let cb = viewProj.transformPointWithW(b);
    if (ca.w <= NEAR && cb.w <= NEAR) return;

    if (ca.w <= NEAR) {
      const t = (NEAR - ca.w) / (cb.w - ca.w);
      ca = viewProj.transformPointWithW(a.add(b.subtract(a).multiply(t)));
    } else if (cb.w <= NEAR) {
      const t = (NEAR - cb.w) / (ca.w - cb.w);
      cb = viewProj.transformPointWithW(b.add(a.subtract(b).multiply(t)));
    }

    if (ca.w >= this.fogEnd && cb.w >= this.fogEnd) return;

    const sa = this.toScreen(ca);
    const sb = this.toScreen(cb);

    const dimmed = this.isInventoryOpen;
    const palette = major
      ? dimmed
        ? this.dimMajorPalette
        : this.majorPalette
      : dimmed
        ? this.dimMinorPalette
        : this.minorPalette;
    const fogStart = this.fogStart;
    const invRange = 1 / (this.fogEnd - this.fogStart);
    const shade = (z: number): string | null => {
      const fade = 1 - (z - fogStart) * invRange;
      if (fade <= 0) return null;
      const idx = Math.min(FOG_LEVELS - 1, Math.floor(Math.min(1, fade) * FOG_LEVELS));
      return palette[idx] ?? null;
    };
    const fallback = palette[FOG_LEVELS - 1] ?? '#00ff9c';

    const bias = 0.02;
    this.renderer.drawLine(
      sa.x,
      sa.y,
      sb.x,
      sb.y,
      major ? '+' : '.',
      fallback,
      sa.z + bias,
      sb.z + bias,
      shade
    );
  }

  private drawCube(viewProj: Matrix4, pos: Vector3, facing: number, rgb: Rgb): void {
    const model = Matrix4.translation(pos.x, pos.y + CUBE_HALF, pos.z).multiply(Matrix4.rotationY(facing));

    const world: Vector3[] = [];
    const screen: Array<ScreenVertex | null> = [];
    for (const v of this.cubeVertices) {
      const wv = model.transformPoint(v);
      const clip = viewProj.transformPointWithW(wv);
      world.push(wv);
      screen.push(clip.w > NEAR ? this.toScreen(clip) : null);
    }

    for (const face of this.cubeFaces) {
      const [i0, i1, i2, i3] = face;
      if (i0 === undefined || i1 === undefined || i2 === undefined || i3 === undefined) continue;

      const w0 = world[i0];
      const w1 = world[i1];
      const w2 = world[i2];
      const w3 = world[i3];
      const s0 = screen[i0];
      const s1 = screen[i1];
      const s2 = screen[i2];
      const s3 = screen[i3];
      if (!w0 || !w1 || !w2 || !w3 || !s0 || !s1 || !s2 || !s3) continue;

      const normal = w1.subtract(w0).cross(w2.subtract(w0)).normalize();

      const center = w0.add(w1).add(w2).add(w3).multiply(0.25);
      if (normal.dot(this.cameraPos.subtract(center)) <= 0) continue;

      const diffuse = Math.max(0, normal.dot(this.lightDir));
      const intensity = Math.min(1, 0.15 + 0.85 * diffuse);

      const rampIndex = Math.min(ASCII_RAMP.length - 1, Math.floor(intensity * ASCII_RAMP.length));
      const char = ASCII_RAMP.charAt(rampIndex);
      const color = `rgb(${Math.floor(rgb.r * intensity)},${Math.floor(rgb.g * intensity)},${Math.floor(
        rgb.b * intensity
      )})`;

      this.drawTriangle(s0, s1, s2, char, color);
      this.drawTriangle(s0, s2, s3, char, color);
    }
  }

  private drawTriangle(p0: ScreenVertex, p1: ScreenVertex, p2: ScreenVertex, char: string, color: string): void {
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (Math.abs(area) < 0.0001) return;

    const r = this.renderer;
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(r.cols - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(r.rows - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

    const invZ0 = 1 / p0.z;
    const invZ1 = 1 / p1.z;
    const invZ2 = 1 / p2.z;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;

        const w0 = (p1.x - p0.x) * (py - p0.y) - (px - p0.x) * (p1.y - p0.y);
        const w1 = (p2.x - p1.x) * (py - p1.y) - (px - p1.x) * (p2.y - p1.y);
        const w2 = (p0.x - p2.x) * (py - p2.y) - (px - p2.x) * (p0.y - p2.y);

        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          const weightP0 = w1 / area;
          const weightP1 = w2 / area;
          const weightP2 = w0 / area;

          const invZ = invZ0 * weightP0 + invZ1 * weightP1 + invZ2 * weightP2;
          const finalZ = 1.0 / invZ;
          r.drawChar(x, y, char, color, finalZ);
        }
      }
    }
  }

  private drawInventory(): void {
    const r = this.renderer;
    const layout = this.getInventoryLayout();
    const horizontal = '+' + '-'.repeat(SLOT_W - 2) + '+';
    const middle = '|' + ' '.repeat(SLOT_W - 2) + '|';

    r.fillRect(layout.panelX, layout.panelY, layout.panelW, layout.panelH, INV_PANEL_BG);

    const title = '[ INVENTORY ]';
    r.drawRawText(
      layout.panelX + Math.floor((layout.panelW - title.length) / 2),
      layout.panelY + 1,
      title,
      INV_TITLE
    );

    for (let i = 0; i < INV_COLS * INV_ROWS; i++) {
      const sc = i % INV_COLS;
      const sr = Math.floor(i / INV_COLS);
      const sx = layout.gridX + sc * (SLOT_W + SLOT_GAP);
      const sy = layout.gridY + sr * (SLOT_H + SLOT_GAP);
      const hovered = i === this.hoverSlot;

      if (hovered) r.fillRect(sx, sy, SLOT_W, SLOT_H, INV_SLOT_HOVER_BG);

      const border = hovered ? INV_BORDER_HOVER : INV_BORDER;
      r.drawRawText(sx, sy, horizontal, border);
      for (let row = 1; row < SLOT_H - 1; row++) {
        r.drawRawText(sx, sy + row, middle, border);
      }
      r.drawRawText(sx, sy + SLOT_H - 1, horizontal, border);

      const item = this.inventoryItems[i];
      if (item) {
        r.drawRawText(sx + Math.floor(SLOT_W / 2), sy + Math.floor(SLOT_H / 2), item.char, item.color);
      }
    }

    const infoY = layout.panelY + layout.panelH - 2;
    const hovered = this.hoverSlot >= 0 ? this.inventoryItems[this.hoverSlot] : null;
    if (hovered) {
      const text = `${hovered.name} - ${hovered.detail}`;
      r.drawRawText(layout.panelX + Math.floor((layout.panelW - text.length) / 2), infoY - 1, text, hovered.color);
    }

    const hint = 'CLOSE: I';
    r.drawRawText(layout.panelX + Math.floor((layout.panelW - hint.length) / 2), infoY, hint, INV_INFO);
  }

  private drawUI(): void {
    const r = this.renderer;

    r.fillRect(0, 0, 40, 6, '#000000');

    r.drawRawText(1, 0, `FPS: ${Math.round(this.fps)}`, '#00ff9c');
    r.drawRawText(
      1,
      1,
      `POS: X ${this.playerPos.x.toFixed(1)}  Z ${this.playerPos.z.toFixed(1)}`,
      '#00d4ff'
    );

    const ratio = Math.max(0, Math.min(1, this.playerHealth / PLAYER_MAX_HP));
    const filled = Math.round(ratio * HP_BAR_WIDTH);
    const hpColor = ratio > 0.5 ? '#00ff9c' : ratio > 0.25 ? '#ffd028' : '#ff2020';
    r.drawRawText(1, 2, `PLAYER HP: ${this.playerHealth}/${PLAYER_MAX_HP}`, hpColor);
    r.drawRawText(HP_BAR_COL, 2, '[', '#2a7a5a');
    r.drawRawText(HP_BAR_COL + 1, 2, '#'.repeat(filled), hpColor);
    r.drawRawText(HP_BAR_COL + 1 + filled, 2, '-'.repeat(HP_BAR_WIDTH - filled), '#1f3a30');
    r.drawRawText(HP_BAR_COL + 1 + HP_BAR_WIDTH, 2, ']', '#2a7a5a');

    if (this.npcAlive()) {
      if (this.distanceToNpc() < TARGET_UI_RANGE) {
        r.drawRawText(1, 3, `ENEMY HP:  ${this.npcHealth}/${NPC_MAX_HP}`, '#ff2fa0');
      }
    } else {
      r.drawRawText(1, 3, 'ENEMY DEFEATED', '#2a7a5a');
    }

    r.drawRawText(
      1,
      4,
      this.isInventoryOpen ? 'PAUSED  INVENTORY: I' : 'MOVE: WASD  ATTACK: LMB  INVENTORY: I',
      '#2a7a5a'
    );
  }
}