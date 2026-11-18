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

const GRAVITY = 9.8;
const SPARK_MIN = 5;
const SPARK_MAX = 8;
const SPARK_LIFE = 0.6;
const INDICATOR_LIFE = 0.9;
const PARTICLE_DEPTH_BIAS = 0.3;
const MAX_PARTICLES = 512;
const SPARK_COLORS: string[] = ['#ffffff', '#ffee55', '#ffd028'];

const PLAYER_RGB: Rgb = { r: 40, g: 255, b: 170 };
const NPC_RGB: Rgb = { r: 255, g: 40, b: 160 };
const FLASH_RGB: Rgb = { r: 255, g: 255, b: 255 };

export class Engine {
  private readonly renderer: AsciiRenderer;
  private readonly input: Input;

  private readonly playerPos: Vector3;
  private facing: number;
  private playerHealth: number;

  private readonly npcPos: Vector3;
  private npcHealth: number;
  private npcHitTimer: number;

  private readonly particles: Particle[];

  private readonly pitch: number;
  private readonly yaw: number;
  private readonly cameraOffset: Vector3;
  private cameraPos: Vector3;

  private readonly fogStart: number;
  private readonly fogEnd: number;
  private readonly majorPalette: string[];
  private readonly minorPalette: string[];

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

    this.npcPos = new Vector3(6, 0, -4);
    this.npcHealth = NPC_MAX_HP;
    this.npcHitTimer = 0;

    this.particles = [];

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

  private distanceToNpc(): number {
    const dx = this.npcPos.x - this.playerPos.x;
    const dz = this.npcPos.z - this.playerPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private spawnHitEffect(pos: Vector3): void {
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
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)] ?? '#ffffff',
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

  private update(dt: number): void {
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
        this.spawnHitEffect(this.npcPos);
      }
    }
    this.input.actionJustPressed = false;

    if (this.npcHitTimer > 0) this.npcHitTimer = Math.max(0, this.npcHitTimer - dt);

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

    this.drawFloor(viewProj);
    if (this.npcAlive()) {
      const npcColor = this.npcHitTimer > 0 ? FLASH_RGB : NPC_RGB;
      this.drawCube(viewProj, this.npcPos, 0, npcColor);
    }
    this.drawCube(viewProj, this.playerPos, this.facing, PLAYER_RGB);
    this.drawParticles(viewProj);
    this.drawUI();

    r.present();
  }

  private drawParticles(viewProj: Matrix4): void {
    for (const p of this.particles) {
      const clip = viewProj.transformPointWithW(p.pos);
      if (clip.w <= NEAR) continue;
      const s = this.toScreen(clip);
      this.renderer.drawChar(s.x, s.y, p.char, p.color, s.z - PARTICLE_DEPTH_BIAS);
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

    const palette = major ? this.majorPalette : this.minorPalette;
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

  private drawUI(): void {
    const r = this.renderer;

    r.fillRect(0, 0, 30, 6, '#000000');

    r.drawRawText(1, 0, `FPS: ${Math.round(this.fps)}`, '#00ff9c');
    r.drawRawText(
      1,
      1,
      `POS: X ${this.playerPos.x.toFixed(1)}  Z ${this.playerPos.z.toFixed(1)}`,
      '#00d4ff'
    );
    r.drawRawText(1, 2, `PLAYER HP: ${this.playerHealth}/${PLAYER_MAX_HP}`, '#00ff9c');

    if (this.npcAlive()) {
      if (this.distanceToNpc() < TARGET_UI_RANGE) {
        r.drawRawText(1, 3, `ENEMY HP:  ${this.npcHealth}/${NPC_MAX_HP}`, '#ff2fa0');
      }
    } else {
      r.drawRawText(1, 3, 'ENEMY DEFEATED', '#2a7a5a');
    }

    r.drawRawText(1, 4, 'MOVE: WASD  ATTACK: left mouse button', '#2a7a5a');
  }
}