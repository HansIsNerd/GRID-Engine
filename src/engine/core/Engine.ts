import { Vector3 } from '../math/Vector3';
import { Matrix4, type Vec4 } from '../math/Matrix4';
import { AsciiRenderer } from '../renderer/AsciiRenderer';
import { Input } from './Input';

/** A vertex after projection: x,y in grid cells, z = view depth (= clip W). */
interface ScreenVertex {
  x: number;
  y: number;
  z: number;
}

const ASCII_RAMP = ' .:-=+*#%@';

/** Anything with w <= NEAR is at/behind the camera plane and is clipped. */
const NEAR = 0.5;
const FAR = 100;
const FOV = Math.PI / 3; // vertical field of view

const GRID_HALF = 40; // CHANGED: floor grid spans -40..40 on X and Z
const MOVE_SPEED = 6; // world units per second

// CHANGED: Project Zomboid style camera (pitch -60 deg)
const CAMERA_PITCH = -Math.PI / 3;
const CAMERA_HEIGHT = 10;

/** CHANGED: number of brightness steps in the pre-built fog palettes. */
const FOG_LEVELS = 24;

export class Engine {
  private readonly renderer: AsciiRenderer;
  private readonly input: Input;

  // ---- Player state ------------------------------------------------------
  private readonly playerPos: Vector3;
  private facing: number; // rotation around Y (radians), purely cosmetic

  // ---- Camera state ------------------------------------------------------
  private readonly pitch: number;
  private readonly yaw: number;
  private readonly cameraOffset: Vector3;
  private cameraPos: Vector3;

  // ---- CHANGED: fog of war -----------------------------------------------
  /** View depth (W) where the fog begins: the player's depth, so the player's surroundings stay bright. */
  private readonly fogStart: number;
  /** View depth where the floor is fully black: just before the top screen edge. */
  private readonly fogEnd: number;
  private readonly majorPalette: string[];
  private readonly minorPalette: string[];

  // ---- Cube model (unit cube centered on the origin) ---------------------
  private readonly cubeVertices: Vector3[];
  /** 4 vertex indices per face, counter-clockwise when seen from OUTSIDE. */
  private readonly cubeFaces: number[][];

  private readonly lightDir: Vector3;

  // ---- Loop --------------------------------------------------------------
  private lastTime: number;
  private fps: number;
  private running: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new AsciiRenderer(canvas, 10);
    this.input = new Input();

    this.playerPos = new Vector3(0, 0, 0);
    this.facing = 0;

    // CHANGED: camera offset is derived from pitch + height, so they can't disagree.
    // Looking down by `tilt`, the camera sits CAMERA_HEIGHT up and
    // CAMERA_HEIGHT / tan(tilt) behind the player (+Z).
    this.pitch = CAMERA_PITCH;
    this.yaw = 0;
    const tilt = -this.pitch;
    const backDist = CAMERA_HEIGHT / Math.tan(tilt);
    this.cameraOffset = new Vector3(0, CAMERA_HEIGHT, backDist);
    this.cameraPos = this.playerPos.add(this.cameraOffset);

    // CHANGED: fog range from camera geometry.
    // View depth of a floor point d units ahead (horizontally) of the camera:
    //   w = dot(point - cam, forward) = H*sin(tilt) + d*cos(tilt)
    // Player: d = backDist.  Top screen edge: its ray points (tilt - FOV/2)
    // below the horizontal, so it hits the floor at d = H / tan(tilt - FOV/2).
    const playerDepth = CAMERA_HEIGHT * Math.sin(tilt) + backDist * Math.cos(tilt);
    const topAngle = tilt - FOV / 2;
    const topDepth =
      topAngle > 0.05
        ? CAMERA_HEIGHT * Math.sin(tilt) + (CAMERA_HEIGHT / Math.tan(topAngle)) * Math.cos(tilt)
        : FAR; // horizon visible: fall back to the far plane
    this.fogStart = playerDepth;
    this.fogEnd = Math.max(playerDepth + 1, topDepth * 0.95);
    this.majorPalette = Engine.buildPalette(150);
    this.minorPalette = Engine.buildPalette(70);

    const h = 0.5;
    this.cubeVertices = [
      new Vector3(-h, -h, -h), // 0
      new Vector3(h, -h, -h), // 1
      new Vector3(h, h, -h), // 2
      new Vector3(-h, h, -h), // 3
      new Vector3(-h, -h, h), // 4
      new Vector3(h, -h, h), // 5
      new Vector3(h, h, h), // 6
      new Vector3(-h, h, h), // 7
    ];
    this.cubeFaces = [
      [4, 5, 6, 7], // front  (+Z)
      [1, 0, 3, 2], // back   (-Z)
      [5, 1, 2, 6], // right  (+X)
      [0, 4, 7, 3], // left   (-X)
      [3, 7, 6, 2], // top    (+Y)
      [0, 1, 5, 4], // bottom (-Y)
    ];

    // Direction TOWARDS the light (unit length). Up, a bit left and to the front.
    this.lightDir = new Vector3(-0.4, 1.0, 0.6).normalize();

    this.lastTime = 0;
    this.fps = 60;
    this.running = false;
  }

  /**
   * CHANGED: pre-builds FOG_LEVELS colors, from near-black to full brightness.
   * Fading to black = scaling the RGB channels towards rgb(0,0,0).
   * Doing this once avoids creating a color string for every pixel.
   */
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
    // deltaTime in seconds, clamped so a tab switch doesn't teleport the player.
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);
    this.render();
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    requestAnimationFrame(this.loop);
  };

  // =======================================================================
  // UPDATE
  // =======================================================================
  private update(dt: number): void {
    // --- WASD -> movement on the X/Z plane --------------------------------
    // The camera looks towards -Z, so "W" (up on screen) = -Z, "D" = +X.
    let dx = 0;
    let dz = 0;
    if (this.input.forward) dz -= 1;
    if (this.input.backward) dz += 1;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const dir = new Vector3(dx, 0, dz).normalize(); // no faster diagonals
      this.playerPos.x += dir.x * MOVE_SPEED * dt;
      this.playerPos.z += dir.z * MOVE_SPEED * dt;
      // World-bounds AABB (the only collision box in the engine right now).
      this.playerPos.x = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.playerPos.x));
      this.playerPos.z = Math.max(-GRID_HALF, Math.min(GRID_HALF, this.playerPos.z));

      // Smoothly turn the cube towards the movement direction (shortest arc).
      // rotationY(a) maps local +Z to (sin a, 0, cos a)  =>  a = atan2(x, z).
      const target = Math.atan2(dir.x, dir.z);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * (1 - Math.exp(-14 * dt));
    }

    // --- Camera follows the player ----------------------------------------
    // Exponential smoothing: independent of the frame rate.
    const desired = this.playerPos.add(this.cameraOffset);
    const k = 1 - Math.exp(-8 * dt);
    this.cameraPos = this.cameraPos.add(desired.subtract(this.cameraPos).multiply(k));
  }

  // =======================================================================
  // RENDER
  // =======================================================================
  private render(): void {
    const r = this.renderer;
    r.clear();

    // ---------------------------------------------------------------------
    // TOP-DOWN CAMERA MATH
    //
    // A camera is the inverse of an object placed in the world, so instead of
    // moving the camera we move the WORLD the opposite way:
    //
    //   1. trans = translation(-cameraPos)   camera -> origin
    //   2. rotY(-yaw)                        undo left/right turn (identity)
    //   3. rotX(-pitch)                      undo the downward tilt.
    //        pitch = -60deg. Example: the player is at (0,-10,-5.77) relative
    //        to the camera; after rotX(+60deg):
    //          y' = y*cos - z*sin = -5 + 5     = 0
    //          z' = y*sin + z*cos = -8.66-2.89 = -11.55
    //        -> centered, 11.55 units straight ahead (camera looks down -Z).
    //   4. proj                              w = -z, so x/w and y/w shrink with distance.
    //
    //   viewProj = proj * rotX * rotY * trans   (rightmost is applied first)
    // ---------------------------------------------------------------------
    const proj = Matrix4.perspective(FOV, r.getAspect(), NEAR, FAR);
    const rotX = Matrix4.rotationX(-this.pitch);
    const rotY = Matrix4.rotationY(-this.yaw);
    const trans = Matrix4.translation(-this.cameraPos.x, -this.cameraPos.y, -this.cameraPos.z);
    const viewProj = proj.multiply(rotX).multiply(rotY).multiply(trans);

    this.drawFloor(viewProj);
    this.drawPlayer(viewProj);
    this.drawUI();

    r.present();
  }

  /**
   * Clip space -> grid cells.
   *   ndc = clip.xy / clip.w          (perspective divide, range -1..1)
   *   cells: x = (ndc.x*0.5+0.5)*cols ;  y = (1 - (ndc.y*0.5+0.5))*rows
   * z is kept as W: view-space distance, always > 0 after near clipping.
   */
  private toScreen(c: Vec4): ScreenVertex {
    const invW = 1 / c.w;
    return {
      x: (c.x * invW * 0.5 + 0.5) * this.renderer.cols,
      y: (1 - (c.y * invW * 0.5 + 0.5)) * this.renderer.rows,
      z: c.w,
    };
  }

  // ---- Floor grid --------------------------------------------------------
  private drawFloor(viewProj: Matrix4): void {
    for (let i = -GRID_HALF; i <= GRID_HALF; i++) {
      const major = i % 5 === 0;
      this.drawWorldLine(
        new Vector3(-GRID_HALF, 0, i),
        new Vector3(GRID_HALF, 0, i),
        viewProj,
        major
      );
      this.drawWorldLine(
        new Vector3(i, 0, -GRID_HALF),
        new Vector3(i, 0, GRID_HALF),
        viewProj,
        major
      );
    }
  }

  /**
   * Projects a 3D line segment and draws it with perspective-correct depth.
   * Near-plane clipping first: W is LINEAR in world position, so the cut
   * point is a simple lerp.
   *
   * CHANGED: FOG OF WAR. The fade is evaluated PER PIXEL from the pixel's own
   * depth (via the `shade` callback), not once per line:
   *
   *   fade = 1 - (w - fogStart) / (fogEnd - fogStart)    clamped to 0..1
   *   fade <= 0  -> pixel skipped (pure void)
   *   color      -> base color * fade (mixes towards rgb(0,0,0))
   */
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

    // CHANGED: W is linear along the segment, so if BOTH ends are past the
    // fog, every pixel is black -> skip the whole line.
    if (ca.w >= this.fogEnd && cb.w >= this.fogEnd) return;

    const sa = this.toScreen(ca);
    const sb = this.toScreen(cb);

    // CHANGED: per-pixel fog shader.
    const palette = major ? this.majorPalette : this.minorPalette;
    const fogStart = this.fogStart;
    const invRange = 1 / (this.fogEnd - this.fogStart);
    const shade = (z: number): string | null => {
      const fade = 1 - (z - fogStart) * invRange;
      if (fade <= 0) return null; // beyond the fog: draw nothing
      const idx = Math.min(FOG_LEVELS - 1, Math.floor(Math.min(1, fade) * FOG_LEVELS));
      return palette[idx] ?? null;
    };
    const fallback = palette[FOG_LEVELS - 1] ?? '#00ff9c'; // unused while `shade` is given

    // Small depth bias pushes the floor slightly "behind" so the cube's base wins.
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

  // ---- Player cube -------------------------------------------------------
  private drawPlayer(viewProj: Matrix4): void {
    // model = translation * rotationY  (rotate first, then move; cube sits ON the floor)
    const model = Matrix4.translation(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z).multiply(
      Matrix4.rotationY(this.facing)
    );

    const world: Vector3[] = [];
    const screen: Array<ScreenVertex | null> = [];
    for (const v of this.cubeVertices) {
      const wv = model.transformPoint(v); // world space (lighting, culling)
      const clip = viewProj.transformPointWithW(wv); // clip space (projection)
      world.push(wv);
      // Ignore vertices at/behind the camera plane (w <= 0 would flip the image).
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

      // Face normal from the cross product (CCW winding => points outwards).
      const normal = w1.subtract(w0).cross(w2.subtract(w0)).normalize();

      // Back-face culling: skip faces that look away from the camera.
      const center = w0.add(w1).add(w2).add(w3).multiply(0.25);
      if (normal.dot(this.cameraPos.subtract(center)) <= 0) continue;

      // Lambert lighting: intensity = max(0, N·L), plus a little ambient light.
      const diffuse = Math.max(0, normal.dot(this.lightDir));
      const intensity = Math.min(1, 0.15 + 0.85 * diffuse);

      const rampIndex = Math.min(ASCII_RAMP.length - 1, Math.floor(intensity * ASCII_RAMP.length));
      const char = ASCII_RAMP.charAt(rampIndex);
      const color = `rgb(${Math.floor(40 * intensity)},${Math.floor(255 * intensity)},${Math.floor(
        170 * intensity
      )})`;

      // Quad -> 2 triangles
      this.drawTriangle(s0, s1, s2, char, color);
      this.drawTriangle(s0, s2, s3, char, color);
    }
  }

  // ---- Triangle rasterizer (UNCHANGED) -------------------------------------
  /**
   * Barycentric rasterizer with PERSPECTIVE-CORRECT depth.
   * 1/z is linear in screen space, so we interpolate 1/z with the barycentric
   * weights and invert it at the end.
   */
  private drawTriangle(p0: ScreenVertex, p1: ScreenVertex, p2: ScreenVertex, char: string, color: string): void {
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (Math.abs(area) < 0.0001) return; // degenerate (edge-on) triangle

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
        // Sample at the CENTER of the character cell.
        const px = x + 0.5;
        const py = y + 0.5;

        const w0 = (p1.x - p0.x) * (py - p0.y) - (px - p0.x) * (p1.y - p0.y);
        const w1 = (p2.x - p1.x) * (py - p1.y) - (px - p1.x) * (p2.y - p1.y);
        const w2 = (p0.x - p2.x) * (py - p2.y) - (px - p2.x) * (p0.y - p2.y);

        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          // Each edge function is the weight of the OPPOSITE vertex.
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

  // ---- UI ------------------------------------------------------------------
  private drawUI(): void {
    const r = this.renderer;

    // CHANGED: solid black panel (40 x 4 cells) BEHIND the text. fillRect also
    // clears the grid characters underneath, so nothing shows through.
    r.fillRect(0, 0, 40, 4, '#000000');

    // Text is drawn AFTER the panel, inside it.
    r.drawRawText(1, 0, `FPS: ${Math.round(this.fps)}`, '#00ff9c');
    r.drawRawText(
      1,
      1,
      `POS: X ${this.playerPos.x.toFixed(1)}  Z ${this.playerPos.z.toFixed(1)}`,
      '#00d4ff'
    );
    r.drawRawText(1, 2, 'MOVE: WASD / ARROWS', '#2a7a5a');
  }
}