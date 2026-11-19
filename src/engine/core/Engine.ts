import { Vector3 } from '../math/Vector3';
import { Matrix4, type Vec4 } from '../math/Matrix4';
import { fbm2, hash2 } from '../math/Noise';
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

type ItemKind = 'weapon' | 'armor' | 'potion' | 'ram' | 'core' | 'misc';

interface InventoryItem {
  name: string;
  char: string;
  color: string;
  detail: string;
  kind: ItemKind;
  value: number;
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

interface Obstacle {
  x: number;
  z: number;
  half: number;
  height: number;
  solid: boolean;
  flicker: boolean;
  rgb: Rgb;
  minIntensity: number;
}

type NpcState = 'idle' | 'chase';
const ASCII_RAMP = ' .,:;irsXA253hMHGS#9B&@';

const NEAR = 0.5;
const FAR = 100;
const FOV = Math.PI / 3;

const GRID_HALF = 60;
const GRID_SIZE = GRID_HALF * 2 + 1;
const GRID_STEP = 2;
const GRID_MAJOR = 10;
const FONT_SIZE = 8.5;
const MOVE_SPEED = 6;

const CAMERA_PITCH = -Math.PI / 3;
const CAMERA_HEIGHT = 10;

const FOG_LEVELS = 24;

const BIOME_WASTES = 0;
const BIOME_CITY = 1;
const BIOME_ACID = 2;
const BIOME_GLITCH = 3;
const BIOME_NAMES: string[] = ['DATA WASTES', 'NEON CITY', 'ACID POOL', 'GLITCH ZONE'];
const BIOME_UI_COLORS: string[] = ['#00ff9c', '#00ffff', '#d0ff00', '#ff2040'];
const GLITCH_CHARS = '#$%&@!?0123456789<>/\\';

const WORLD_SEED = 1337;
const SAFE_RADIUS = 9;
const ACID_DAMAGE = 5;
const ACID_TICK = 1;
const MINOR_SCALE = 70 / 150;
const GLITCH_FLICKER_RATE = 12;

const WASTES_RGB: Rgb = { r: 0, g: 150, b: 105 };
const FLOOR_RGB: Rgb[] = [
  WASTES_RGB,
  { r: 0, g: 220, b: 255 },
  { r: 190, g: 255, b: 0 },
  { r: 255, g: 30, b: 50 },
];
const GLITCH_FLASH_RGB: Rgb = { r: 255, g: 90, b: 220 };

const TOWER_RGB: Rgb = { r: 255, g: 40, b: 200 };
const DATA_BLOCK_RGB: Rgb = { r: 0, g: 230, b: 255 };
const DEBRIS_RGB: Rgb = { r: 0, g: 170, b: 100 };
const WASTE_BLOCK_RGB: Rgb = { r: 0, g: 255, b: 130 };
const GLITCH_BLOCK_RGB: Rgb = { r: 255, g: 30, b: 50 };
const ACID_DEBRIS_RGB: Rgb = { r: 170, g: 255, b: 0 };
const ACID_COLORS: string[] = ['#d0ff00', '#a0ff00', '#ffff55'];
const OBSTACLE_CULL_MARGIN = 8;

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

const RAM_MAX = 100;
const RAM_REGEN = 6;
const GLITCH_RAM = 20;
const BOMB_COST = 30;
const BOMB_RADIUS = 6;
const BOMB_DAMAGE_BASE = 40;
const BOMB_DAMAGE_PER_LEVEL = 5;
const BLINK_COST = 20;
const BLINK_DISTANCE = 6;
const BLINK_STEPS = 12;
const OVERCLOCK_COST = 50;
const OVERCLOCK_TIME = 8;
const OVERCLOCK_MULT = 2;
const SHAKE_AMP = 0.3;
const GLITCH_ROWS = 6;
const GLITCH_SHIFT = 3;
const MESSAGE_TIME = 2;
const SAVE_KEY = 'grid_save_v1';
const BOMB_COLORS: string[] = ['#33aaff', '#66ccff', '#ccf0ff'];
const BLINK_COLORS: string[] = ['#b266ff', '#d199ff', '#ffffff'];
const OVERCLOCK_COLORS: string[] = ['#ff9020', '#ffd028', '#ffffff'];

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
  { name: 'Iron Sword', char: 'S', color: '#e8e8e8', detail: 'ATK +12', kind: 'weapon', value: 12 },
  { name: 'Health Potion', char: 'P', color: '#ff3355', detail: 'Restores 40 HP', kind: 'potion', value: 40 },
  { name: 'Mana Potion', char: 'P', color: '#33aaff', detail: 'Restores 25 RAM', kind: 'ram', value: 25 },
  { name: 'Gold Coins', char: '$', color: '#ffd028', detail: 'x 50', kind: 'misc', value: 50 },
  { name: 'Oak Shield', char: 'O', color: '#c8863a', detail: 'DEF +6', kind: 'armor', value: 6 },
];

const CYBER_CORE_TEMPLATE: Item = {
  name: CYBER_CORE_NAME,
  char: 'C',
  color: '#00ffff',
  detail: 'Click: ATK +5',
  kind: 'core',
  value: CYBER_CORE_ATTACK_BONUS,
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

function isItem(v: unknown): v is Item {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['name'] === 'string' &&
    typeof o['char'] === 'string' &&
    typeof o['color'] === 'string' &&
    typeof o['detail'] === 'string' &&
    typeof o['kind'] === 'string' &&
    typeof o['value'] === 'number'
  );
}

export class Engine {
  private readonly renderer: AsciiRenderer;
  private readonly input: Input;

  private readonly playerPos: Vector3;
  private facing: number;
  private playerHealth: number;

  private playerExp: number;
  private playerLevel: number;
  private expToNextLevel: number;
  private coreBonus: number;

  private ram: number;
  private overclockTimer: number;
  private glitching: boolean;
  private message: string;
  private messageTimer: number;

  private equippedWeapon: Item | null;
  private equippedArmor: Item | null;

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
  private readonly floorPalettes: string[][];
  private readonly flashPalettes: string[];

  private readonly biomeGrid: Uint8Array;
  private readonly obstacles: Obstacle[];
  private readonly obstacleGrid: Int16Array;
  private time: number;
  private acidTimer: number;

  private readonly cubeVertices: Vector3[];
  private readonly cubeFaces: number[][];

  private readonly lightDir: Vector3;

  private lastTime: number;
  private fps: number;
  private running: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new AsciiRenderer(canvas, FONT_SIZE);
    this.input = new Input();
    this.playerPos = new Vector3(0, 0, 0);
    this.facing = 0;
    this.playerHealth = PLAYER_MAX_HP;

    this.playerExp = 0;
    this.playerLevel = START_LEVEL;
    this.expToNextLevel = START_EXP_TO_NEXT;
    this.coreBonus = 0;

    this.ram = RAM_MAX;
    this.overclockTimer = 0;
    this.glitching = false;
    this.message = '';
    this.messageTimer = 0;

    this.equippedWeapon = null;
    this.equippedArmor = null;

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
    this.inventoryItems[0] = { name: 'Iron Sword', char: 'S', color: '#e8e8e8', detail: 'ATK +12', kind: 'weapon', value: 12 };
    this.inventoryItems[1] = { name: 'Health Potion', char: 'P', color: '#ff3355', detail: 'Restores 40 HP', kind: 'potion', value: 40 };
    this.inventoryItems[2] = { name: 'Gold Coins', char: '$', color: '#ffd028', detail: 'x 120', kind: 'misc', value: 120 };
    this.inventoryItems[5] = { name: 'Mana Potion', char: 'P', color: '#33aaff', detail: 'Restores 25 RAM', kind: 'ram', value: 25 };
    this.inventoryItems[7] = { name: 'Oak Shield', char: 'O', color: '#c8863a', detail: 'DEF +6', kind: 'armor', value: 6 };
    this.inventoryItems[10] = { name: 'Ancient Key', char: 'k', color: '#b266ff', detail: 'Opens something', kind: 'misc', value: 0 };

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

    this.floorPalettes = [];
    for (let b = 0; b < FLOOR_RGB.length; b++) {
      const c = FLOOR_RGB[b] ?? WASTES_RGB;
      this.floorPalettes.push(Engine.buildPalette(c, MINOR_SCALE));
      this.floorPalettes.push(Engine.buildPalette(c, MINOR_SCALE * DIM_FACTOR));
      this.floorPalettes.push(Engine.buildPalette(c, 1));
      this.floorPalettes.push(Engine.buildPalette(c, DIM_FACTOR));
    }
    this.flashPalettes = [];
    this.flashPalettes.push(Engine.buildFlash(MINOR_SCALE));
    this.flashPalettes.push(Engine.buildFlash(MINOR_SCALE * DIM_FACTOR));
    this.flashPalettes.push(Engine.buildFlash(1));
    this.flashPalettes.push(Engine.buildFlash(DIM_FACTOR));

    this.time = 0;
    this.acidTimer = 0;
    this.biomeGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    for (let iz = 0; iz < GRID_SIZE; iz++) {
      for (let ix = 0; ix < GRID_SIZE; ix++) {
        this.biomeGrid[iz * GRID_SIZE + ix] = Engine.computeBiome(ix - GRID_HALF, iz - GRID_HALF);
      }
    }
    this.obstacles = [];
    this.obstacleGrid = new Int16Array(GRID_SIZE * GRID_SIZE).fill(-1);
    this.buildObstacles();

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

    this.loadGame();
    this.cameraPos = this.playerPos.add(this.cameraOffset);
  }

  private static buildPalette(rgb: Rgb, scale: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < FOG_LEVELS; i++) {
      const f = ((i + 1) / FOG_LEVELS) * scale;
      out.push(`rgb(${Math.floor(rgb.r * f)},${Math.floor(rgb.g * f)},${Math.floor(rgb.b * f)})`);
    }
    return out;
  }

  private static buildFlash(scale: number): string {
    const c = GLITCH_FLASH_RGB;
    return `rgb(${Math.floor(c.r * scale)},${Math.floor(c.g * scale)},${Math.floor(c.b * scale)})`;
  }

  private static computeBiome(x: number, z: number): number {
    if (Math.sqrt(x * x + z * z) < SAFE_RADIUS) return BIOME_WASTES;
    const v = fbm2(x * 0.055, z * 0.055, WORLD_SEED, 3);
    const w = fbm2(x * 0.07 + 41.3, z * 0.07 - 17.9, WORLD_SEED + 1, 3);
    if (v > 0.6) return BIOME_CITY;
    if (w > 0.62) return BIOME_ACID;
    if (w < 0.38) return BIOME_GLITCH;
    return BIOME_WASTES;
  }

  private biomeAtPos(x: number, z: number): number {
    const ix = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(x) + GRID_HALF));
    const iz = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(z) + GRID_HALF));
    return this.biomeGrid[iz * GRID_SIZE + ix] ?? BIOME_WASTES;
  }

  private addObstacle(o: Obstacle): void {
    const ix = o.x + GRID_HALF;
    const iz = o.z + GRID_HALF;
    this.obstacleGrid[iz * GRID_SIZE + ix] = this.obstacles.length;
    this.obstacles.push(o);
  }

  private buildObstacles(): void {
    for (let z = -GRID_HALF + 1; z < GRID_HALF; z++) {
      for (let x = -GRID_HALF + 1; x < GRID_HALF; x++) {
        if (Math.sqrt(x * x + z * z) < SAFE_RADIUS) continue;
        const biome = this.biomeGrid[(z + GRID_HALF) * GRID_SIZE + x + GRID_HALF] ?? BIOME_WASTES;
        const r = hash2(x, z, WORLD_SEED + 7);
        const r2 = hash2(x, z, WORLD_SEED + 13);
        const r3 = hash2(x, z, WORLD_SEED + 29);

        if (biome === BIOME_CITY) {
          if ((x & 1) !== 0 || (z & 1) !== 0) continue;
          if (r >= 0.42) continue;
          if (r2 < 0.75) {
            this.addObstacle({
              x,
              z,
              half: 0.4 + 0.2 * r3,
              height: 3 + 4 * r3,
              solid: true,
              flicker: false,
              rgb: TOWER_RGB,
              minIntensity: 0.35,
            });
          } else {
            this.addObstacle({
              x,
              z,
              half: 0.5,
              height: 1.2,
              solid: true,
              flicker: false,
              rgb: DATA_BLOCK_RGB,
              minIntensity: 0.4,
            });
          }
        } else if (biome === BIOME_WASTES) {
          if (r < 0.04) {
            this.addObstacle({
              x,
              z,
              half: 0.25,
              height: 0.3 + 0.5 * r2,
              solid: false,
              flicker: false,
              rgb: DEBRIS_RGB,
              minIntensity: 0.3,
            });
          } else if (r < 0.055) {
            this.addObstacle({
              x,
              z,
              half: 0.5,
              height: 1,
              solid: true,
              flicker: false,
              rgb: WASTE_BLOCK_RGB,
              minIntensity: 0.3,
            });
          }
        } else if (biome === BIOME_GLITCH) {
          if (r < 0.06) {
            this.addObstacle({
              x,
              z,
              half: 0.5,
              height: 1 + 2 * r2,
              solid: true,
              flicker: true,
              rgb: GLITCH_BLOCK_RGB,
              minIntensity: 0.4,
            });
          }
        } else if (r < 0.02) {
          this.addObstacle({
            x,
            z,
            half: 0.25,
            height: 0.3,
            solid: false,
            flicker: false,
            rgb: ACID_DEBRIS_RGB,
            minIntensity: 0.4,
          });
        }
      }
    }
  }

  private blockedByObstacle(x: number, z: number): boolean {
    const cx = Math.round(x) + GRID_HALF;
    const cz = Math.round(z) + GRID_HALF;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= GRID_SIZE || iz >= GRID_SIZE) continue;
        const idx = this.obstacleGrid[iz * GRID_SIZE + ix] ?? -1;
        if (idx < 0) continue;
        const o = this.obstacles[idx];
        if (!o || !o.solid) continue;
        const lim = o.half + CUBE_HALF;
        if (Math.abs(x - o.x) < lim && Math.abs(z - o.z) < lim) return true;
      }
    }
    return false;
  }

  private showMessage(text: string): void {
    this.message = text;
    this.messageTimer = MESSAGE_TIME;
  }

  private saveGame(): void {
    const data = {
      x: this.playerPos.x,
      z: this.playerPos.z,
      hp: this.playerHealth,
      ram: this.ram,
      level: this.playerLevel,
      exp: this.playerExp,
      expToNext: this.expToNextLevel,
      coreBonus: this.coreBonus,
      inv: this.inventoryItems,
      weapon: this.equippedWeapon,
      armor: this.equippedArmor,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.showMessage('GAME SAVED');
    } catch {
      this.showMessage('SAVE FAILED');
    }
  }

  private loadGame(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return;
      const o = parsed as Record<string, unknown>;
      const num = (k: string, f: number): number => {
        const v = o[k];
        return typeof v === 'number' && Number.isFinite(v) ? v : f;
      };

      this.playerPos.x = Math.max(-GRID_HALF, Math.min(GRID_HALF, num('x', 0)));
      this.playerPos.z = Math.max(-GRID_HALF, Math.min(GRID_HALF, num('z', 0)));
      this.playerHealth = Math.max(1, Math.min(PLAYER_MAX_HP, num('hp', PLAYER_MAX_HP)));
      this.ram = Math.max(0, Math.min(RAM_MAX, num('ram', RAM_MAX)));
      this.playerLevel = Math.max(1, Math.floor(num('level', START_LEVEL)));
      this.playerExp = Math.max(0, num('exp', 0));
      this.expToNextLevel = Math.max(1, num('expToNext', START_EXP_TO_NEXT));
      this.coreBonus = Math.max(0, num('coreBonus', 0));

      const inv = o['inv'];
      if (Array.isArray(inv)) {
        for (let i = 0; i < this.inventoryItems.length; i++) {
          const it: unknown = inv[i];
          this.inventoryItems[i] = isItem(it) ? it : null;
        }
      }
      const w = o['weapon'];
      this.equippedWeapon = isItem(w) && w.kind === 'weapon' ? w : null;
      const a = o['armor'];
      this.equippedArmor = isItem(a) && a.kind === 'armor' ? a : null;
    } catch {
      return;
    }
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

  private currentAttack(): number {
    const base = BASE_ATTACK_DAMAGE + this.coreBonus + (this.equippedWeapon?.value ?? 0);
    return base * (this.overclockTimer > 0 ? OVERCLOCK_MULT : 1);
  }

  private damageNpc(amount: number, colors: string[]): void {
    if (!this.npcAlive()) return;
    this.npcHealth = Math.max(0, this.npcHealth - amount);
    this.npcHitTimer = HIT_FLASH_TIME;
    this.spawnHitEffect(this.npcPos, colors);
    if (this.npcHealth <= 0) this.killNpc();
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
    const t = 1 - this.pulseTimer / PULSE_DURATION;
    const eased = 1 - (1 - t) * (1 - t);
    return PULSE_MAX_RADIUS * eased;
  }

  private updatePulse(dt: number): void {
    if (this.pulseTimer <= 0) return;
    this.pulseTimer = Math.max(0, this.pulseTimer - dt);

    if (this.pulseHitNpc || !this.npcAlive()) return;

    const dx = this.npcPos.x - this.pulseOrigin.x;
    const dz = this.npcPos.z - this.pulseOrigin.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.pulseRadius()) return;

    this.pulseHitNpc = true;
    this.damageNpc(this.pulseDamage, EXP_PICKUP_COLORS);
  }

  private castLogicBomb(): void {
    if (this.ram < BOMB_COST) return;
    this.ram -= BOMB_COST;
    for (let i = 0; i < 3; i++) this.spawnPickupEffect(this.playerPos, BOMB_COLORS);
    if (this.npcAlive() && this.distanceToNpc() <= BOMB_RADIUS) {
      this.damageNpc(BOMB_DAMAGE_BASE + BOMB_DAMAGE_PER_LEVEL * this.playerLevel, BOMB_COLORS);
    }
  }

  private castDataBlink(): void {
    if (this.ram < BLINK_COST) return;
    const dirX = Math.sin(this.facing);
    const dirZ = Math.cos(this.facing);
    const stepLen = BLINK_DISTANCE / BLINK_STEPS;
    const ox = this.playerPos.x;
    const oz = this.playerPos.z;
    let x = ox;
    let z = oz;
    for (let i = 1; i <= BLINK_STEPS; i++) {
      const nx = Math.max(-GRID_HALF, Math.min(GRID_HALF, ox + dirX * stepLen * i));
      const nz = Math.max(-GRID_HALF, Math.min(GRID_HALF, oz + dirZ * stepLen * i));
      if (this.blockedByObstacle(nx, nz) || this.collidesWithNpc(nx, nz)) break;
      x = nx;
      z = nz;
    }
    if (x === ox && z === oz) return;
    this.ram -= BLINK_COST;
    this.spawnPickupEffect(new Vector3(ox, 0, oz), BLINK_COLORS);
    this.playerPos.x = x;
    this.playerPos.z = z;
    this.spawnPickupEffect(this.playerPos, BLINK_COLORS);
    this.cameraPos = this.playerPos.add(this.cameraOffset);
  }

  private castOverclock(): void {
    if (this.ram < OVERCLOCK_COST) return;
    this.ram -= OVERCLOCK_COST;
    this.overclockTimer = OVERCLOCK_TIME;
    this.spawnPickupEffect(this.playerPos, OVERCLOCK_COLORS);
  }

  private randomNpcSpawn(): Vector3 {
    const range = GRID_HALF - NPC_RESPAWN_MARGIN;
    let best = new Vector3(-this.playerPos.x, 0, -this.playerPos.z);
    let bestDist = -1;

    for (let i = 0; i < NPC_RESPAWN_TRIES; i++) {
      const x = (Math.random() * 2 - 1) * range;
      const z = (Math.random() * 2 - 1) * range;
      if (this.blockedByObstacle(x, z) || this.biomeAtPos(x, z) === BIOME_ACID) continue;
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
      if (!this.npcCollidesWithPlayer(nextX, this.npcPos.z) && !this.blockedByObstacle(nextX, this.npcPos.z)) {
        this.npcPos.x = nextX;
      }

      const nextZ = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.npcPos.z + dir.z * NPC_SPEED * dt));
      if (!this.npcCollidesWithPlayer(this.npcPos.x, nextZ) && !this.blockedByObstacle(this.npcPos.x, nextZ)) {
        this.npcPos.z = nextZ;
      }
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
      const dmg = Math.max(1, NPC_ATTACK_DAMAGE - (this.equippedArmor?.value ?? 0));
      this.playerHealth = Math.max(0, this.playerHealth - dmg);
      this.npcAttackCooldown = NPC_ATTACK_COOLDOWN;
      this.spawnHitEffect(this.playerPos, BLOOD_COLORS);
    }
  }

  private updateHazards(dt: number): void {
    if (this.biomeAtPos(this.playerPos.x, this.playerPos.z) !== BIOME_ACID) {
      this.acidTimer = 0;
      return;
    }
    this.acidTimer += dt;
    while (this.acidTimer >= ACID_TICK) {
      this.acidTimer -= ACID_TICK;
      this.playerHealth = Math.max(0, this.playerHealth - ACID_DAMAGE);
      this.spawnHitEffect(this.playerPos, ACID_COLORS);
    }
  }

  private respawn(): void {
    this.playerHealth = PLAYER_MAX_HP;
    this.ram = RAM_MAX;
    this.overclockTimer = 0;
    this.playerPos.x = 0;
    this.playerPos.y = 0;
    this.playerPos.z = 0;
    this.facing = 0;
    this.acidTimer = 0;
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

  private handleInventoryClick(click: boolean): void {
    if (!click || this.hoverSlot < 0) return;

    const slot = this.hoverSlot;
    const item = this.inventoryItems[slot];
    if (!item) return;

    if (item.kind === 'weapon') {
      this.inventoryItems[slot] = this.equippedWeapon;
      this.equippedWeapon = item;
    } else if (item.kind === 'armor') {
      this.inventoryItems[slot] = this.equippedArmor;
      this.equippedArmor = item;
    } else if (item.kind === 'potion') {
      this.playerHealth = Math.min(PLAYER_MAX_HP, this.playerHealth + item.value);
      this.inventoryItems[slot] = null;
    } else if (item.kind === 'ram') {
      this.ram = Math.min(RAM_MAX, this.ram + item.value);
      this.inventoryItems[slot] = null;
    } else if (item.kind === 'core') {
      this.coreBonus += item.value;
      this.inventoryItems[slot] = null;
      this.isInventoryOpen = false;
      this.hoverSlot = -1;
    }
  }

  private update(dt: number): void {
    this.time += dt;

    const inp = this.input;
    const invToggle = inp.inventoryJustPressed;
    const click = inp.actionJustPressed;
    const space = inp.spaceJustPressed;
    const qPressed = inp.qJustPressed;
    const ePressed = inp.eJustPressed;
    const rPressed = inp.rJustPressed;
    const savePressed = inp.saveJustPressed;
    inp.resetJustPressed();

    if (savePressed) this.saveGame();
    if (this.messageTimer > 0) this.messageTimer = Math.max(0, this.messageTimer - dt);

    if (invToggle) {
      this.isInventoryOpen = !this.isInventoryOpen;
      this.hoverSlot = -1;
    }

    if (this.isInventoryOpen) {
      this.hoverSlot = this.slotAtMouse();
      this.handleInventoryClick(click);
      return;
    }

    this.ram = Math.min(RAM_MAX, this.ram + RAM_REGEN * dt);
    this.glitching = this.ram < GLITCH_RAM;
    if (this.overclockTimer > 0) this.overclockTimer = Math.max(0, this.overclockTimer - dt);

    if (qPressed) this.castLogicBomb();
    if (ePressed) this.castDataBlink();
    if (rPressed) this.castOverclock();

    let dx = 0;
    let dz = 0;
    if (inp.forward) dz -= 1;
    if (inp.backward) dz += 1;
    if (inp.left) dx -= 1;
    if (inp.right) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const dir = new Vector3(dx, 0, dz).normalize();
      const speed = MOVE_SPEED * (this.overclockTimer > 0 ? OVERCLOCK_MULT : 1);

      const nextX = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.playerPos.x + dir.x * speed * dt));
      if (!this.collidesWithNpc(nextX, this.playerPos.z) && !this.blockedByObstacle(nextX, this.playerPos.z)) {
        this.playerPos.x = nextX;
      }

      const nextZ = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.playerPos.z + dir.z * speed * dt));
      if (!this.collidesWithNpc(this.playerPos.x, nextZ) && !this.blockedByObstacle(this.playerPos.x, nextZ)) {
        this.playerPos.z = nextZ;
      }

      const target = Math.atan2(dir.x, dir.z);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * (1 - Math.exp(-14 * dt));
    }

    if ((click || space) && this.npcAlive() && this.distanceToNpc() < ATTACK_RANGE) {
      this.damageNpc(this.currentAttack(), SPARK_COLORS);
    }

    if (this.npcHitTimer > 0) this.npcHitTimer = Math.max(0, this.npcHitTimer - dt);

    this.updateNpc(dt);
    this.updateNpcRespawn(dt);
    this.updateHazards(dt);

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

    const shaking = this.glitching && !this.isInventoryOpen;
    const shakeX = shaking ? (Math.random() * 2 - 1) * SHAKE_AMP : 0;
    const shakeY = shaking ? (Math.random() * 2 - 1) * SHAKE_AMP : 0;
    const shakeZ = shaking ? (Math.random() * 2 - 1) * SHAKE_AMP : 0;

    const proj = Matrix4.perspective(FOV, r.getAspect(), NEAR, FAR);
    const rotX = Matrix4.rotationX(-this.pitch);
    const rotY = Matrix4.rotationY(-this.yaw);
    const trans = Matrix4.translation(
      -(this.cameraPos.x + shakeX),
      -(this.cameraPos.y + shakeY),
      -(this.cameraPos.z + shakeZ)
    );
    const viewProj = proj.multiply(rotX).multiply(rotY).multiply(trans);

    const dim = this.isInventoryOpen ? DIM_FACTOR : 1;

    this.drawFloor(viewProj);
    this.drawObstacles(viewProj, dim);
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
    if (shaking) r.glitchRows(GLITCH_ROWS, GLITCH_SHIFT);
    this.drawUI();
    if (this.isInventoryOpen) this.drawInventory();

    r.present();
  }

  private drawPulseRing(viewProj: Matrix4, radius: number, fade: number, char: string): void {
    if (radius <= 0.05) return;

    const count = Math.max(
      PULSE_RING_MIN_POINTS,
      Math.min(PULSE_RING_MAX_POINTS, Math.floor(radius * 8))
    );
    const step = (Math.PI * 2) / count;

    const g = Math.floor(255 * fade);
    const color = this.isInventoryOpen ? '#0a3a2a' : `rgb(0,${g},${g})`;

    for (let i = 0; i < count; i++) {
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

  private drawObstacles(viewProj: Matrix4, dim: number): void {
    const tick = Math.floor(this.time * GLITCH_FLICKER_RATE);
    for (const o of this.obstacles) {
      if (o.flicker && hash2(o.x * 1.7, o.z * 2.3, tick) < 0.18) continue;
      const clip = viewProj.transformPointWithW(new Vector3(o.x, o.height * 0.5, o.z));
      if (clip.w > this.fogEnd + OBSTACLE_CULL_MARGIN) continue;
      this.drawBox(
        viewProj,
        new Vector3(o.x, 0, o.z),
        0,
        { r: o.rgb.r * dim, g: o.rgb.g * dim, b: o.rgb.b * dim },
        o.half * 2,
        o.height,
        o.half * 2,
        o.minIntensity
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
    const tick = Math.floor(this.time * GLITCH_FLICKER_RATE);
    for (let i = -GRID_HALF; i <= GRID_HALF; i += GRID_STEP) {
      const major = i % GRID_MAJOR === 0;
      this.drawFloorLine(viewProj, true, i, major, tick);
      this.drawFloorLine(viewProj, false, i, major, tick);
    }
  }

  private drawFloorLine(viewProj: Matrix4, horizontal: boolean, fixed: number, major: boolean, tick: number): void {
    const base = horizontal ? (fixed + GRID_HALF) * GRID_SIZE : fixed + GRID_HALF;
    const stride = horizontal ? 1 : GRID_SIZE;
    let start = -GRID_HALF;
    let cur = this.biomeGrid[base] ?? BIOME_WASTES;

    for (let t = -GRID_HALF + 1; t <= GRID_HALF; t++) {
      const b = t < GRID_HALF ? (this.biomeGrid[base + (t + GRID_HALF) * stride] ?? BIOME_WASTES) : -1;
      if (b === cur && cur !== BIOME_GLITCH) continue;
      this.emitFloorSegment(viewProj, horizontal, fixed, start, t, cur, major, tick);
      start = t;
      cur = b;
    }
  }

  private emitFloorSegment(
    viewProj: Matrix4,
    horizontal: boolean,
    fixed: number,
    start: number,
    end: number,
    biome: number,
    major: boolean,
    tick: number
  ): void {
    const mi = (major ? 2 : 0) + (this.isInventoryOpen ? 1 : 0);
    let palette = this.floorPalettes[biome * 4 + mi];
    if (!palette) return;

    let ch = major ? '+' : '.';
    if (biome === BIOME_ACID) {
      ch = '~';
    } else if (biome === BIOME_GLITCH) {
      const h = hash2(start * 7.3 + fixed, fixed * 3.1 + start, tick);
      if (h < 0.2) return;
      if (h > 0.9) {
        const flash = this.flashPalettes[mi];
        if (flash) palette = Engine.flatPalette(flash);
      }
      const hc = hash2(start * 3.7 + fixed, fixed * 5.3, tick + 11);
      ch = GLITCH_CHARS.charAt(Math.floor(hc * GLITCH_CHARS.length));
    }

    const a = horizontal ? new Vector3(start, 0, fixed) : new Vector3(fixed, 0, start);
    const b = horizontal ? new Vector3(end, 0, fixed) : new Vector3(fixed, 0, end);
    this.drawWorldLine(a, b, viewProj, ch, palette);
  }

  private static flatPalette(color: string): string[] {
    return new Array<string>(FOG_LEVELS).fill(color);
  }

  private drawWorldLine(a: Vector3, b: Vector3, viewProj: Matrix4, ch: string, palette: string[]): void {
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
    this.renderer.drawLine(sa.x, sa.y, sb.x, sb.y, ch, fallback, sa.z + bias, sb.z + bias, shade);
  }

  private drawCube(
    viewProj: Matrix4,
    pos: Vector3,
    facing: number,
    rgb: Rgb,
    scale: number = 1,
    minIntensity: number = 0
  ): void {
    this.drawBox(viewProj, pos, facing, rgb, scale, scale, scale, minIntensity);
  }

  private drawBox(
    viewProj: Matrix4,
    pos: Vector3,
    facing: number,
    rgb: Rgb,
    sx: number,
    sy: number,
    sz: number,
    minIntensity: number = 0
  ): void {
    const model = Matrix4.translation(pos.x, pos.y + CUBE_HALF * sy, pos.z)
      .multiply(Matrix4.rotationY(facing))
      .multiply(Matrix4.scaling(sx, sy, sz));

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

    const equip = `WPN: ${this.equippedWeapon?.name ?? '-'}  ARM: ${this.equippedArmor?.name ?? '-'}`;
    r.drawRawText(
      layout.panelX + Math.max(0, Math.floor((layout.panelW - equip.length) / 2)),
      layout.panelY + 2,
      equip,
      INV_INFO
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

    const hint = 'CLICK: USE/EQUIP  CLOSE: I';
    r.drawRawText(layout.panelX + Math.floor((layout.panelW - hint.length) / 2), infoY, hint, INV_INFO);
  }

  private drawUI(): void {
    const r = this.renderer;

    r.fillRect(0, 0, 50, 10, '#000000');

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
      this.isInventoryOpen ? 'PAUSED  INVENTORY: I' : 'WASD LMB/SPC Q/E/R I:INV P:SAVE',
      '#2a7a5a'
    );

    r.drawRawText(
      1,
      5,
      `LV ${this.playerLevel}  EXP ${this.playerExp}/${this.expToNextLevel}  ATK ${this.currentAttack()}`,
      '#00ffff'
    );

    const biome = this.biomeAtPos(this.playerPos.x, this.playerPos.z);
    const biomeText =
      biome === BIOME_ACID
        ? `BIOME: ${BIOME_NAMES[biome]}  !! -${ACID_DAMAGE} HP/s`
        : `BIOME: ${BIOME_NAMES[biome] ?? 'UNKNOWN'}`;
    r.drawRawText(1, 6, biomeText, BIOME_UI_COLORS[biome] ?? '#00ff9c');

    const ramRatio = Math.max(0, Math.min(1, this.ram / RAM_MAX));
    const ramFilled = Math.round(ramRatio * HP_BAR_WIDTH);
    const ramColor = this.glitching ? '#ff2040' : '#33aaff';
    r.drawRawText(1, 7, `RAM: ${Math.floor(this.ram)}/${RAM_MAX}`, ramColor);
    r.drawRawText(HP_BAR_COL, 7, '[', '#2a7a5a');
    r.drawRawText(HP_BAR_COL + 1, 7, '#'.repeat(ramFilled), ramColor);
    r.drawRawText(HP_BAR_COL + 1 + ramFilled, 7, '-'.repeat(HP_BAR_WIDTH - ramFilled), '#1f3a30');
    r.drawRawText(HP_BAR_COL + 1 + HP_BAR_WIDTH, 7, ']', '#2a7a5a');
    if (this.glitching) {
      r.drawRawText(HP_BAR_COL + HP_BAR_WIDTH + 3, 7, 'GLITCH', '#ff2040');
    } else if (this.overclockTimer > 0) {
      r.drawRawText(HP_BAR_COL + HP_BAR_WIDTH + 3, 7, `OC ${Math.ceil(this.overclockTimer)}s`, '#ffd028');
    }

    r.drawRawText(
      1,
      8,
      `WPN: ${this.equippedWeapon?.name ?? '-'}  ARM: ${this.equippedArmor?.name ?? '-'}`,
      '#00d4ff'
    );

    if (this.messageTimer > 0) {
      r.drawRawText(1, 9, this.message, '#ffd028');
    } else {
      r.drawRawText(1, 9, `Q BOMB ${BOMB_COST}  E BLINK ${BLINK_COST}  R OVRCLK ${OVERCLOCK_COST}`, '#2a7a5a');
    }
  }
}