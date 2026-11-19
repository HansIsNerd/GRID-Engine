export type RenderResolution = 'auto' | '1280x720' | '1600x900' | '1920x1080';
export type CharacterDensity = 'low' | 'medium' | 'high' | 'ultra';
export type RenderingQuality = 'performance' | 'balanced' | 'high' | 'ultra';

export interface RenderConfiguration {
  resolution: RenderResolution;
  characterDensity: CharacterDensity;
  quality: RenderingQuality;
}

export interface OptionDef<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description: string;
}

export interface SettingsSection {
  readonly title: string;
  readonly labels: string[];
  readonly descriptions: string[];
}

export interface RenderProfile {
  devW: number;
  devH: number;
  displayW: number;
  displayH: number;
  left: number;
  top: number;
  pixelRatio: number;
  densityFactor: number;
}

export interface GridMetrics {
  fontPx: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
}

export interface QualityProfile {
  readonly ramp: string;
  readonly colorSteps: number;
  readonly fogSteps: number;
  readonly fogMap: Uint8Array;
}

export type RenderConfigListener = (config: RenderConfiguration) => void;

export const FOG_LEVELS = 24;
export const RENDER_CONFIG_STORAGE_KEY = 'aethergrid.renderConfig.v1';
export const RENDER_CONFIG_VERSION = 1;

export const DEFAULT_RENDER_CONFIGURATION: RenderConfiguration = {
  resolution: 'auto',
  characterDensity: 'medium',
  quality: 'balanced',
};

const MAX_SURFACE_W = 3840;
const MAX_SURFACE_H = 2160;

const BASE_RAMP = ' .,:;irsXA253hMHGS#9B&@';
const FAST_RAMP = ' .:-=+*#%@';
const ULTRA_RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

function sampleRamp(src: string, count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += src.charAt(Math.round((i * (src.length - 1)) / (count - 1)));
  }
  return out;
}

const HIGH_RAMP = sampleRamp(ULTRA_RAMP, 40);

function buildFogMap(steps: number): Uint8Array {
  const out = new Uint8Array(FOG_LEVELS);
  for (let i = 0; i < FOG_LEVELS; i++) {
    const stepIdx = Math.min(steps - 1, Math.floor((i * steps) / FOG_LEVELS));
    out[i] = Math.min(FOG_LEVELS - 1, Math.max(0, Math.floor(((stepIdx + 1) * FOG_LEVELS) / steps) - 1));
  }
  return out;
}

function buildQuality(ramp: string, colorSteps: number, fogSteps: number): QualityProfile {
  return { ramp, colorSteps, fogSteps, fogMap: buildFogMap(fogSteps) };
}

export const QUALITY_PROFILES: Record<RenderingQuality, QualityProfile> = {
  performance: buildQuality(FAST_RAMP, 8, 8),
  balanced: buildQuality(BASE_RAMP, 24, 24),
  high: buildQuality(HIGH_RAMP, 48, 24),
  ultra: buildQuality(ULTRA_RAMP, 0, 24),
};

export const RESOLUTION_OPTIONS: ReadonlyArray<OptionDef<RenderResolution>> = [
  { value: 'auto', label: 'AUTO', description: 'Viewport x pixel ratio, capped at 3840x2160' },
  { value: '1280x720', label: '1280x720', description: 'Fixed 1280x720 surface, scaled to fit window' },
  { value: '1600x900', label: '1600x900', description: 'Fixed 1600x900 surface, scaled to fit window' },
  { value: '1920x1080', label: '1920x1080', description: 'Fixed 1920x1080 surface, scaled to fit window' },
];

export const DENSITY_OPTIONS: ReadonlyArray<OptionDef<CharacterDensity>> = [
  { value: 'low', label: 'LOW', description: '0.70x glyph grid: fewer, larger cells' },
  { value: 'medium', label: 'MEDIUM', description: '1.00x glyph grid: standard cells' },
  { value: 'high', label: 'HIGH', description: '1.25x glyph grid: denser cells' },
  { value: 'ultra', label: 'ULTRA', description: '1.50x glyph grid: densest cells' },
];

export const QUALITY_OPTIONS: ReadonlyArray<OptionDef<RenderingQuality>> = [
  {
    value: 'performance',
    label: 'PERFORMANCE',
    description: `${FAST_RAMP.length}-glyph ramp, 8 color steps, 8 fog steps`,
  },
  {
    value: 'balanced',
    label: 'BALANCED',
    description: `${BASE_RAMP.length}-glyph ramp, 24 color steps, 24 fog steps`,
  },
  {
    value: 'high',
    label: 'HIGH',
    description: `${HIGH_RAMP.length}-glyph ramp, 48 color steps, 24 fog steps`,
  },
  {
    value: 'ultra',
    label: 'ULTRA',
    description: `${ULTRA_RAMP.length}-glyph ramp, continuous color, 24 fog steps`,
  },
];

function toSection<T extends string>(title: string, options: ReadonlyArray<OptionDef<T>>): SettingsSection {
  return {
    title,
    labels: options.map((o) => o.label),
    descriptions: options.map((o) => o.description),
  };
}

export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSection> = [
  toSection('RESOLUTION', RESOLUTION_OPTIONS),
  toSection('CHARACTER DENSITY', DENSITY_OPTIONS),
  toSection('RENDERING QUALITY', QUALITY_OPTIONS),
];

const DENSITY_FACTORS: Record<CharacterDensity, number> = {
  low: 0.7,
  medium: 1,
  high: 1.25,
  ultra: 1.5,
};

const RESOLUTION_DIMENSIONS: Record<RenderResolution, { w: number; h: number } | null> = {
  auto: null,
  '1280x720': { w: 1280, h: 720 },
  '1600x900': { w: 1600, h: 900 },
  '1920x1080': { w: 1920, h: 1080 },
};

function pick<T extends string>(value: unknown, options: ReadonlyArray<OptionDef<T>>, fallback: T): T {
  for (const o of options) {
    if (o.value === value) return o.value;
  }
  return fallback;
}

export function normalizeRenderConfiguration(raw: unknown): RenderConfiguration {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_RENDER_CONFIGURATION };
  const o = raw as Record<string, unknown>;
  return {
    resolution: pick(o['resolution'], RESOLUTION_OPTIONS, DEFAULT_RENDER_CONFIGURATION.resolution),
    characterDensity: pick(o['characterDensity'], DENSITY_OPTIONS, DEFAULT_RENDER_CONFIGURATION.characterDensity),
    quality: pick(o['quality'], QUALITY_OPTIONS, DEFAULT_RENDER_CONFIGURATION.quality),
  };
}

function migrateStoredConfiguration(version: unknown, data: unknown): RenderConfiguration {
  switch (version) {
    case 1:
      return normalizeRenderConfiguration(data);
    default:
      return { ...DEFAULT_RENDER_CONFIGURATION };
  }
}

export function parseStoredRenderConfiguration(text: string | null): RenderConfiguration {
  if (!text) return { ...DEFAULT_RENDER_CONFIGURATION };
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_RENDER_CONFIGURATION };
    const o = parsed as Record<string, unknown>;
    return migrateStoredConfiguration(o['version'], o['config']);
  } catch {
    return { ...DEFAULT_RENDER_CONFIGURATION };
  }
}

export function loadRenderConfiguration(): RenderConfiguration {
  try {
    return parseStoredRenderConfiguration(localStorage.getItem(RENDER_CONFIG_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_RENDER_CONFIGURATION };
  }
}

export function saveRenderConfiguration(config: RenderConfiguration): void {
  try {
    localStorage.setItem(
      RENDER_CONFIG_STORAGE_KEY,
      JSON.stringify({ version: RENDER_CONFIG_VERSION, config })
    );
  } catch {
    return;
  }
}

export function resolveRenderProfile(
  config: RenderConfiguration,
  viewportW: number,
  viewportH: number,
  dpr: number
): RenderProfile {
  const vw = Math.max(1, Math.floor(Number.isFinite(viewportW) ? viewportW : 1));
  const vh = Math.max(1, Math.floor(Number.isFinite(viewportH) ? viewportH : 1));
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const preset = RESOLUTION_DIMENSIONS[config.resolution];

  let devW: number;
  let devH: number;
  let displayW: number;
  let displayH: number;

  if (preset === null) {
    devW = Math.max(1, Math.floor(vw * ratio));
    devH = Math.max(1, Math.floor(vh * ratio));
    const s = Math.min(1, MAX_SURFACE_W / devW, MAX_SURFACE_H / devH);
    if (s < 1) {
      devW = Math.max(1, Math.floor(devW * s));
      devH = Math.max(1, Math.floor(devH * s));
    }
    displayW = vw;
    displayH = vh;
  } else {
    devW = preset.w;
    devH = preset.h;
    const fit = Math.min(vw / devW, vh / devH);
    displayW = Math.max(1, Math.floor(devW * fit));
    displayH = Math.max(1, Math.floor(devH * fit));
  }

  return {
    devW,
    devH,
    displayW,
    displayH,
    left: Math.max(0, Math.floor((vw - displayW) / 2)),
    top: Math.max(0, Math.floor((vh - displayH) / 2)),
    pixelRatio: devW / displayW,
    densityFactor: DENSITY_FACTORS[config.characterDensity],
  };
}

export function resolveGrid(profile: RenderProfile, baseFontSize: number): GridMetrics {
  const fontPx = (baseFontSize * profile.pixelRatio) / profile.densityFactor;
  const cellW = fontPx * 0.6;
  const cellH = Math.ceil(fontPx * 1.2);
  return {
    fontPx,
    cellW,
    cellH,
    cols: Math.max(1, Math.floor(profile.devW / cellW)),
    rows: Math.max(1, Math.floor(profile.devH / cellH)),
  };
}

export function resolveQualityProfile(quality: RenderingQuality): QualityProfile {
  return QUALITY_PROFILES[quality];
}

function sameConfiguration(a: RenderConfiguration, b: RenderConfiguration): boolean {
  return a.resolution === b.resolution && a.characterDensity === b.characterDensity && a.quality === b.quality;
}

export class RenderConfigStore {
  private config: RenderConfiguration;
  private readonly listeners: RenderConfigListener[];

  constructor() {
    this.config = loadRenderConfiguration();
    this.listeners = [];
  }

  public get(): RenderConfiguration {
    return this.config;
  }

  public subscribe(listener: RenderConfigListener): void {
    this.listeners.push(listener);
  }

  public update(patch: Partial<RenderConfiguration>): void {
    const next = normalizeRenderConfiguration({ ...this.config, ...patch });
    if (sameConfiguration(this.config, next)) return;
    this.config = next;
    saveRenderConfiguration(next);
    for (const l of this.listeners) l(next);
  }

  public reset(): void {
    this.update({ ...DEFAULT_RENDER_CONFIGURATION });
  }

  public selectedIndex(section: number): number {
    const c = this.config;
    if (section === 0) return RESOLUTION_OPTIONS.findIndex((o) => o.value === c.resolution);
    if (section === 1) return DENSITY_OPTIONS.findIndex((o) => o.value === c.characterDensity);
    if (section === 2) return QUALITY_OPTIONS.findIndex((o) => o.value === c.quality);
    return -1;
  }

  public selectOption(section: number, option: number): void {
    if (section === 0) {
      const o = RESOLUTION_OPTIONS[option];
      if (o) this.update({ resolution: o.value });
    } else if (section === 1) {
      const o = DENSITY_OPTIONS[option];
      if (o) this.update({ characterDensity: o.value });
    } else if (section === 2) {
      const o = QUALITY_OPTIONS[option];
      if (o) this.update({ quality: o.value });
    }
  }
}