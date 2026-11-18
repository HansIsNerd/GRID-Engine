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

type Item = InventoryItem;

interface Loot {
  pos: Vector3;
  item: Item;
  age: number;
}

interface ExpFragment {
  pos: Vector3;
  value: number;
  age: number;
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
const BASE_ATTACK_DAMAGE = 10;
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

const NPC_RESPAWN_TIME = 5;
const NPC_RESPAWN_HP = 50;
const NPC_RESPAWN_MIN_DIST = 20;
const NPC_RESPAWN_MARGIN = 3;
const NPC_RESPAWN_TRIES = 30;

const LOOT_SCALE = 0.3;
const LOOT_PICKUP_RANGE = 1.2;
const LOOT_BOB_HEIGHT = 0.5;
const LOOT_BOB_AMPLITUDE = 0.15;
const LOOT_BOB_SPEED = 3;
const LOOT_SPIN_SPEED = 2;
const LOOT_GLOW_MIN_INTENSITY = 0.85;
const MAX_LOOT = 64;
const LOOT_RGB: Rgb = { r: 255, g: 220, b: 40 };

const EXP_FRAGMENT_MIN = 3;
const EXP_FRAGMENT_MAX = 5;
const EXP_FRAGMENT_VALUE = 8;
const EXP_FRAGMENT_SCALE = 0.22;
const EXP_FRAGMENT_PICKUP_RANGE = 1.3;
const EXP_FRAGMENT_SCATTER_MIN = 0.6;
const EXP_FRAGMENT_SCATTER_MAX = 1.8;
const EXP_FRAGMENT_BOB_HEIGHT = 0.6;
const EXP_FRAGMENT_BOB_AMPLITUDE = 0.2;
const EXP_FRAGMENT_BOB_SPEED = 4;
const EXP_FRAGMENT_SPIN_SPEED = 3;
const EXP_FRAGMENT_GLOW_MIN_INTENSITY = 0.9;
const MAX_EXP_FRAGMENTS = 64;
const EXP_RGB: Rgb = { r: 0, g: 255, b: 255 };
const EXP_PICKUP_COLORS: string[] = ['#00ffff', '#66ffff', '#ccffff'];

const START_LEVEL = 1;
const START_EXP_TO_NEXT = 20;
const EXP_GROWTH = 1.5;
const CYBER_CORE_ATTACK_BONUS = 5;
const CYBER_CORE_NAME = 'Cyber-Core';

const PULSE_DURATION = 1.0;
const PULSE_MAX_RADIUS = 12;
const PULSE_DAMAGE_BASE = 20;
const PULSE_DAMAGE_PER_LEVEL = 5;
const PULSE_RING_MIN_POINTS = 32;
const PULSE_RING_MAX_POINTS = 180;
const PULSE_RING_HEIGHT = 0.25;
const PULSE_TRAIL_LAG = 0.12;
const PULSE_DEPTH_BIAS = 0.25;

const GRAVITY = 9.8;
const SPARK_MIN = 5;
const SPARK_MAX = 8;
const SPARK_LIFE = 0.6;
const INDICATOR_LIFE = 0.9;
const PICKUP_MIN = 8;
const PICKUP_MAX = 12;
const PICKUP_LIFE = 0.7;
const PARTICLE_DEPTH_BIAS = 0.3;
const MAX_PARTICLES = 512;
const SPARK_COLORS: string[] = ['#ffffff', '#ffee55', '#ffd028'];
const BLOOD_COLORS: string[] = ['#ff0000', '#ff2020', '#ff5555'];
const PICKUP_COLORS: string[] = ['#00ff9c', '#55ff88', '#aaffcc'];

const LOOT_POOL: Item[] = [
  { name: 'Iron Sword', char: 'S', color: '#e8e8e8', detail: 'ATK +12' },
  { name: 'Health Potion', char: 'P', color: '#ff3355', detail: 'Restores 40 HP' },
  { name: 'Mana Potion', char: 'P', color: '#33aaff', detail: 'Restores 25 MP' },
  { name: 'Gold Coins', char: '$', color: '#ffd028', detail: 'x 50' },
  { name: 'Oak Shield', char: 'O', color: '#c8863a', detail: 'DEF +6' },
];

const CYBER_CORE_TEMPLATE: Item = {
  name: CYBER_CORE_NAME,
  char: 'C',
  color: '#00ffff',
  detail: 'Click: ATK +5',
};

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

  private playerExp: number;
  private playerLevel: number;
  private expToNextLevel: number;
  private attackDamage: number;

  private readonly npcPos: Vector3;
  private npcHealth: number;
  private npcMaxHp: number;
  private npcHitTimer: number;
  private npcState: NpcState;
  private npcAttackCooldown: number;
  private npcFacing: number;
  private npcRespawnTimer: number;

  private readonly particles: Particle[];
  private readonly lootItems: Loot[];
  private readonly expFragments: ExpFragment[];

  private pulseTimer: number;
  private readonly pulseOrigin: Vector3;
  private pulseHitNpc: boolean;
  private pulseDamage: number;

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

    this.playerExp = 0;
    this.playerLevel = START_LEVEL;
    this.expToNextLevel = START_EXP_TO_NEXT;
    this.attackDamage = BASE_ATTACK_DAMAGE;

    this.npcPos = new Vector3(NPC_START_X, 0, NPC_START_Z);
    this.npcHealth = NPC_MAX_HP;
    this.npcMaxHp = NPC_MAX_HP;
    this.npcHitTimer = 0;
    this.npcState = 'idle';
    this.npcAttackCooldown = 0;
    this.npcFacing = 0;
    this.npcRespawnTimer = 0;

    this.particles = [];
    this.lootItems = [];
    this.expFragments = [];

    this.pulseTimer = 0;
    this.pulseOrigin = new Vector3(0, 0, 0);
    this.pulseHitNpc = false;
    this.pulseDamage = 0;

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

  private spawnPickupEffect(pos: Vector3, colors: string[] = PICKUP_COLORS): void {
    const origin = new Vector3(pos.x, pos.y + LOOT_BOB_HEIGHT, pos.z);
    const count = PICKUP_MIN + Math.floor(Math.random() * (PICKUP_MAX - PICKUP_MIN + 1));

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      const life = PICKUP_LIFE * (0.6 + Math.random() * 0.4);
      this.particles.push({
        pos: origin.clone(),
        vel: new Vector3(Math.cos(angle) * speed, 2 + Math.random() * 3, Math.sin(angle) * speed),
        life,
        maxLife: life,
        char: '+',
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#00ff9c',
        gravity: GRAVITY * 0.5,
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

  private spawnLoot(pos: Vector3): void {
    if (this.lootItems.length >= MAX_LOOT) return;
    const template = LOOT_POOL[Math.floor(Math.random() * LOOT_POOL.length)] ?? LOOT_POOL[0];
    if (!template) return;
    this.lootItems.push({
      pos: new Vector3(pos.x, 0, pos.z),
      item: { ...template },
      age: 0,
    });
  }

  private spawnExpFragments(pos: Vector3): void {
    const count = EXP_FRAGMENT_MIN + Math.floor(Math.random() * (EXP_FRAGMENT_MAX - EXP_FRAGMENT_MIN + 1));
    for (let i = 0; i < count; i++) {
      if (this.expFragments.length >= MAX_EXP_FRAGMENTS) break;
      const angle = Math.random() * Math.PI * 2;
      const dist = EXP_FRAGMENT_SCATTER_MIN + Math.random() * (EXP_FRAGMENT_SCATTER_MAX - EXP_FRAGMENT_SCATTER_MIN);
      const x = Math.max(-GRID_HALF, Math.min(GRID_HALF, pos.x + Math.cos(angle) * dist));
      const z = Math.max(-GRID_HALF, Math.min(GRID_HALF, pos.z + Math.sin(angle) * dist));
      this.expFragments.push({
        pos: new Vector3(x, 0, z),
        value: EXP_FRAGMENT_VALUE,
        age: Math.random() * Math.PI * 2,
      });
    }
  }

  private killNpc(): void {
    this.spawnLoot(this.npcPos);
    this.spawnExpFragments(this.npcPos);
    this.npcRespawnTimer = NPC_RESPAWN_TIME;
  }

  private firstEmptySlot(): number {
    for (let i = 0; i < this.inventoryItems.length; i++) {
      if (this.inventoryItems[i] === null) return i;
    }
    return -1;
  }

  private grantCyberCore(): void {
    const slot = this.firstEmptySlot();
    if (slot >= 0) {
      this.inventoryItems[slot] = { ...CYBER_CORE_TEMPLATE };
      return;
    }
    if (this.lootItems.length >= MAX_LOOT) return;
    this.lootItems.push({
      pos: new Vector3(this.playerPos.x, 0, this.playerPos.z),
      item: { ...CYBER_CORE_TEMPLATE },
      age: 0,
    });
  }

  private triggerResonancePulse(): void {
    this.pulseTimer = PULSE_DURATION;
    this.pulseOrigin.x = this.playerPos.x;
    this.pulseOrigin.y = 0;
    this.pulseOrigin.z = this.playerPos.z;
    this.pulseHitNpc = false;
    this.pulseDamage = PULSE_DAMAGE_BASE + PULSE_DAMAGE_PER_LEVEL * this.playerLevel;
  }

  private checkLevelUp(): void {
    let leveled = false;
    while (this.playerExp >= this.expToNextLevel) {
      this.playerExp -= this.expToNextLevel;
      this.playerLevel += 1;
      this.expToNextLevel = Math.floor(this.expToNextLevel * EXP_GROWTH);
      this.grantCyberCore();
      leveled = true;
    }
    if (leveled) this.triggerResonancePulse();
  }

  private updateLoot(dt: number): void {
    for (let i = this.lootItems.length - 1; i >= 0; i--) {
      const loot = this.lootItems[i];
      if (!loot) continue;

      loot.age += dt;

      const dx = loot.pos.x - this.playerPos.x;
      const dz = loot.pos.z - this.playerPos.z;
      if (Math.sqrt(dx * dx + dz * dz) >= LOOT_PICKUP_RANGE) continue;

      const slot = this.firstEmptySlot();
      if (slot < 0) continue;

      this.inventoryItems[slot] = loot.item;
      this.spawnPickupEffect(loot.pos);
      this.lootItems.splice(i, 1);
    }
  }

  private updateExpFragments(dt: number): void {
    for (let i = this.expFragments.length - 1; i >= 0; i--) {
      const frag = this.expFragments[i];
      if (!frag) continue;

      frag.age += dt;

      const dx = frag.pos.x - this.playerPos.x;
      const dz = frag.pos.z - this.playerPos.z;
      if (Math.sqrt(dx * dx + dz * dz) >= EXP_FRAGMENT_PICKUP_RANGE) continue;

      this.playerExp += frag.value;
      this.spawnPickupEffect(frag.pos, EXP_PICKUP_COLORS);
      const last = this.expFragments[this.expFragments.length - 1];
      if (last) this.expFragments[i] = last;
      this.expFragments.pop();
    }
    this.checkLevelUp();
  }

  private pulseRadius(): number {
    // t runs 0 -> 1 as pulseTimer counts down from PULSE_DURATION to 0.
    const t = 1 - this.pulseTimer / PULSE_DURATION;
    // Ease-out quadratic: eased = 1 - (1 - t)^2. The ring bursts outward fast
    // (derivative 2 at t=0) and decelerates to zero speed at t=1, which reads
    // as a shockwave losing energy.
    const eased = 1 - (1 - t) * (1 - t);
    // World-space radius in grid units, measured from pulseOrigin on the XZ plane.
    return PULSE_MAX_RADIUS * eased;
  }

  private updatePulse(dt: number): void {
    if (this.pulseTimer <= 0) return;
    this.pulseTimer = Math.max(0, this.pulseTimer - dt);

    if (this.pulseHitNpc || !this.npcAlive()) return;

    // Damage rule: an enemy is hit the first frame the expanding ring's radius
    // reaches its distance from the pulse origin. dist = sqrt(dx^2 + dz^2),
    // compared against the current radius. The flag guarantees one hit per
    // pulse, so the wave "sweeps through" the enemy exactly once.
    const dx = this.npcPos.x - this.pulseOrigin.x;
    const dz = this.npcPos.z - this.pulseOrigin.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.pulseRadius()) return;

    this.pulseHitNpc = true;
    this.npcHealth = Math.max(0, this.npcHealth - this.pulseDamage);
    this.npcHitTimer = HIT_FLASH_TIME;
    this.spawnHitEffect(this.npcPos, EXP_PICKUP_COLORS);
    if (this.npcHealth <= 0) this.killNpc();
  }

  private randomNpcSpawn(): Vector3 {
    const range = GRID_HALF - NPC_RESPAWN_MARGIN;
    let best = new Vector3(-this.playerPos.x, 0, -this.playerPos.z);
    let bestDist = -1;

    for (let i = 0; i < NPC_RESPAWN_TRIES; i++) {
      const x = (Math.random() * 2 - 1) * range;
      const z = (Math.random() * 2 - 1) * range;
      const dx = x - this.playerPos.x;
      const dz = z - this.playerPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= NPC_RESPAWN_MIN_DIST) return new Vector3(x, 0, z);
      if (d > bestDist) {
        bestDist = d;
        best = new Vector3(x, 0, z);
      }
    }
    return best;
  }

  private updateNpcRespawn(dt: number): void {
    if (this.npcAlive()) return;

    this.npcRespawnTimer -= dt;
    if (this.npcRespawnTimer > 0) return;

    const spawn = this.randomNpcSpawn();
    this.npcPos.x = spawn.x;
    this.npcPos.y = 0;
    this.npcPos.z = spawn.z;
    this.npcMaxHp = NPC_RESPAWN_HP;
    this.npcHealth = NPC_RESPAWN_HP;
    this.npcState = 'idle';
    this.npcAttackCooldown = 0;
    this.npcHitTimer = 0;
    this.npcRespawnTimer = 0;
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

    this.npcMaxHp = NPC_MAX_HP;
    this.npcHealth = NPC_MAX_HP;
    this.npcPos.x = NPC_START_X;
    this.npcPos.y = 0;
    this.npcPos.z = NPC_START_Z;
    this.npcState = 'idle';
    this.npcAttackCooldown = 0;
    this.npcHitTimer = 0;
    this.npcFacing = 0;
    this.npcRespawnTimer = 0;

    this.lootItems.length = 0;
    this.expFragments.length = 0;
    this.pulseTimer = 0;
    this.pulseHitNpc = true;
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

  private handleInventoryClick(): void {
    // Click flow, executed only while the inventory is open:
    // 1. hoverSlot was just recomputed from the mouse position (screen px ->
    //    cell col/row -> slot index via slotAtMouse). -1 means the cursor is
    //    over padding, a gap between slots, or outside the grid.
    // 2. actionJustPressed is the one-frame edge flag set by Input on the
    //    left-button mousedown. Using the edge (not the held state) ensures
    //    one click consumes at most ONE item, even if the button is held.
    // 3. We read the item in that slot and only act if it is a Cyber-Core.
    //    Any other item is ignored here (no accidental consumption).
    if (!this.input.actionJustPressed) return;
    if (this.hoverSlot < 0) return;

    const item = this.inventoryItems[this.hoverSlot];
    if (!item || item.name !== CYBER_CORE_NAME) return;

    // 4. Consume: the permanent stat gain is applied, then the slot is set to
    //    null so the core cannot be reused and the slot becomes free for loot.
    this.attackDamage += CYBER_CORE_ATTACK_BONUS;
    this.inventoryItems[this.hoverSlot] = null;

    // 5. Close the inventory and reset hover so no stale highlight remains
    //    when it reopens. The caller clears actionJustPressed afterwards, so
    //    this same click cannot leak into the combat code as an attack.
    this.isInventoryOpen = false;
    this.hoverSlot = -1;
  }

  private update(dt: number): void {
    if (this.input.inventoryJustPressed) {
      this.isInventoryOpen = !this.isInventoryOpen;
      this.hoverSlot = -1;
    }
    this.input.inventoryJustPressed = false;

    if (this.isInventoryOpen) {
      this.hoverSlot = this.slotAtMouse();
      this.handleInventoryClick();
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
        this.npcHealth = Math.max(0, this.npcHealth - this.attackDamage);
        this.npcHitTimer = HIT_FLASH_TIME;
        this.spawnHitEffect(this.npcPos, SPARK_COLORS);
        if (this.npcHealth <= 0) this.killNpc();
      }
    }
    this.input.actionJustPressed = false;

    if (this.npcHitTimer > 0) this.npcHitTimer = Math.max(0, this.npcHitTimer - dt);

    this.updateNpc(dt);
    this.updateNpcRespawn(dt);

    if (this.playerHealth <= 0) this.respawn();

    this.updateLoot(dt);
    this.updateExpFragments(dt);
    this.updatePulse(dt);
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
    this.drawLoot(viewProj, dim);
    this.drawExpFragments(viewProj, dim);
    if (this.npcAlive()) {
      const base = this.npcHitTimer > 0 ? FLASH_RGB : NPC_RGB;
      this.drawCube(viewProj, this.npcPos, this.npcFacing, { r: base.r * dim, g: base.g * dim, b: base.b * dim });
    }
    this.drawCube(viewProj, this.playerPos, this.facing, {
      r: PLAYER_RGB.r * dim,
      g: PLAYER_RGB.g * dim,
      b: PLAYER_RGB.b * dim,
    });
    this.drawPulse(viewProj);
    this.drawParticles(viewProj);
    this.drawUI();
    if (this.isInventoryOpen) this.drawInventory();

    r.present();
  }

  private drawPulseRing(viewProj: Matrix4, radius: number, fade: number, char: string): void {
    if (radius <= 0.05) return;

    // Ring sampling: the circle's circumference is 2*pi*radius. Point count
    // scales linearly with radius (about 8 points per unit of radius) and is
    // clamped, so the ring keeps a constant on-screen density while growing
    // and cost stays bounded.
    const count = Math.max(
      PULSE_RING_MIN_POINTS,
      Math.min(PULSE_RING_MAX_POINTS, Math.floor(radius * 8))
    );
    const step = (Math.PI * 2) / count;

    // Brightness fades linearly with remaining pulse time; the blue/green
    // channels keep the cyan hue, the red channel stays 0.
    const g = Math.floor(255 * fade);
    const color = this.isInventoryOpen ? '#0a3a2a' : `rgb(0,${g},${g})`;

    for (let i = 0; i < count; i++) {
      // Parametric circle on the XZ ground plane:
      // x = ox + R*cos(a), z = oz + R*sin(a), y fixed just above the floor.
      const a = i * step;
      const wp = new Vector3(
        this.pulseOrigin.x + Math.cos(a) * radius,
        PULSE_RING_HEIGHT,
        this.pulseOrigin.z + Math.sin(a) * radius
      );
      const clip = viewProj.transformPointWithW(wp);
      if (clip.w <= NEAR) continue;
      const s = this.toScreen(clip);
      this.renderer.drawChar(s.x, s.y, char, color, s.z - PULSE_DEPTH_BIAS);
    }
  }

  private drawPulse(viewProj: Matrix4): void {
    if (this.pulseTimer <= 0) return;

    const fade = this.pulseTimer / PULSE_DURATION;
    const radius = this.pulseRadius();

    // Leading edge: bright '@' ring at the current radius R(t).
    // Trailing echo: a dimmer 'o' ring at R(t - lag) sampled from the same
    // easing curve, giving the wave visible thickness. Math.max(0, ...) keeps
    // the trail from going negative at the start of the animation.
    const t = 1 - this.pulseTimer / PULSE_DURATION;
    const tTrail = Math.max(0, t - PULSE_TRAIL_LAG);
    const trailRadius = PULSE_MAX_RADIUS * (1 - (1 - tTrail) * (1 - tTrail));

    this.drawPulseRing(viewProj, radius, fade, '@');
    this.drawPulseRing(viewProj, trailRadius, fade * 0.6, 'o');
  }

  private drawLoot(viewProj: Matrix4, dim: number): void {
    for (const loot of this.lootItems) {
      const pulse = 0.8 + 0.2 * Math.sin(loot.age * 6);
      const bob = LOOT_BOB_HEIGHT + Math.sin(loot.age * LOOT_BOB_SPEED) * LOOT_BOB_AMPLITUDE;
      const pos = new Vector3(loot.pos.x, loot.pos.y + bob, loot.pos.z);
      this.drawCube(
        viewProj,
        pos,
        loot.age * LOOT_SPIN_SPEED,
        { r: LOOT_RGB.r * pulse * dim, g: LOOT_RGB.g * pulse * dim, b: LOOT_RGB.b * pulse * dim },
        LOOT_SCALE,
        LOOT_GLOW_MIN_INTENSITY
      );
    }
  }

  private drawExpFragments(viewProj: Matrix4, dim: number): void {
    for (const frag of this.expFragments) {
      const pulse = 0.8 + 0.2 * Math.sin(frag.age * 7);
      const bob = EXP_FRAGMENT_BOB_HEIGHT + Math.sin(frag.age * EXP_FRAGMENT_BOB_SPEED) * EXP_FRAGMENT_BOB_AMPLITUDE;
      const pos = new Vector3(frag.pos.x, frag.pos.y + bob, frag.pos.z);
      this.drawCube(
        viewProj,
        pos,
        frag.age * EXP_FRAGMENT_SPIN_SPEED,
        { r: EXP_RGB.r * pulse * dim, g: EXP_RGB.g * pulse * dim, b: EXP_RGB.b * pulse * dim },
        EXP_FRAGMENT_SCALE,
        EXP_FRAGMENT_GLOW_MIN_INTENSITY
      );
    }
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

  private drawCube(
    viewProj: Matrix4,
    pos: Vector3,
    facing: number,
    rgb: Rgb,
    scale: number = 1,
    minIntensity: number = 0
  ): void {
    const model = Matrix4.translation(pos.x, pos.y + CUBE_HALF * scale, pos.z)
      .multiply(Matrix4.rotationY(facing))
      .multiply(Matrix4.scaling(scale, scale, scale));

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
      const intensity = Math.min(1, Math.max(minIntensity, 0.15 + 0.85 * diffuse));

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
        r.drawRawText(1, 3, `ENEMY HP:  ${this.npcHealth}/${this.npcMaxHp}`, '#ff2fa0');
      }
    } else {
      r.drawRawText(1, 3, `ENEMY DEFEATED  RESPAWN: ${Math.max(0, Math.ceil(this.npcRespawnTimer))}s`, '#2a7a5a');
    }

    r.drawRawText(
      1,
      4,
      this.isInventoryOpen ? 'PAUSED  INVENTORY: I' : 'MOVE: WASD  ATTACK: LMB  INVENTORY: I',
      '#2a7a5a'
    );

    r.drawRawText(
      1,
      5,
      `LV ${this.playerLevel}  EXP ${this.playerExp}/${this.expToNextLevel}  ATK ${this.attackDamage}`,
      '#00ffff'
    );
  }
}