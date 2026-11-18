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

const GRID_HALF = 20; // floor grid spans -20..20 on X and Z
const MOVE_SPEED = 6; // world units per second

export class Engine {
  private readonly renderer: AsciiRenderer;
  private readonly input: Input;

  // ---- Player state ------------------------------------------------------
  private readonly playerPos: Vector3;
  private facing: number; // rotation around Y (radians), purely cosmetic

  // ---- Camera state (fixed top-down) -------------------------------------
  private readonly pitch: number;
  private readonly yaw: number;
  private readonly cameraOffset: Vector3;
  private cameraPos: Vector3;

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

    this.pitch = -Math.PI / 4; // look down 45 degrees
    this.yaw = 0;
    this.cameraOffset = new Vector3(0, 8, 8);
    this.cameraPos = this.playerPos.add(this.cameraOffset);

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
    // Exponential smoothing: independent of the frame rate, unlike a fixed lerp factor.
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
    // A camera is just the inverse of an object placed in the world. Instead
    // of moving a camera we move the WORLD in the opposite way:
    //
    //   1. trans = translation(-cameraPos)
    //        Puts the camera at the origin.
    //   2. rotY(-yaw)   (identity here, yaw = 0)
    //        Undoes the camera's left/right turn.
    //   3. rotX(-pitch)
    //        pitch = -45deg means the camera is tilted DOWN. We rotate the
    //        world by +45deg around X so that this tilt becomes "straight
    //        ahead". Example: the player is at (0,-8,-8) relative to the
    //        camera; after rotX(+45deg): y' = y*cos - z*sin = 0,
    //        z' = y*sin + z*cos = -11.3  ->  centered, 11.3 units in front
    //        (the camera looks down -Z).
    //   4. proj
    //        Perspective: w = -z, so x/w and y/w shrink with distance.
    //
    //   viewProj = proj * rotX * rotY * trans   (rightmost is applied first)
    // ---------------------------------------------------------------------
    const proj = Matrix4.perspective(Math.PI / 3, r.getAspect(), NEAR, FAR);
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
   * (Screen Y points DOWN, NDC Y points UP, hence the flip.)
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
   * The segment is clipped against the near plane first: W is a LINEAR function
   * of the world position, so we can find the cut point with simple lerp.
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

    const sa = this.toScreen(ca);
    const sb = this.toScreen(cb);

    // Fade with distance for atmosphere (green/cyan, darker far away).
    const avgW = (sa.z + sb.z) * 0.5;
    const fade = Math.max(0.15, 1 - avgW / 40);
    const base = major ? 150 : 70;
    const color = `rgb(0,${Math.floor(base * fade)},${Math.floor(base * 0.7 * fade)})`;

    // Small depth bias pushes the floor slightly "behind" so the cube's base wins.
    const bias = 0.02;
    this.renderer.drawLine(sa.x, sa.y, sb.x, sb.y, major ? '+' : '.', color, sa.z + bias, sb.z + bias);
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

  // ---- Triangle rasterizer ----------------------------------------------
  /**
   * Barycentric rasterizer with PERSPECTIVE-CORRECT depth.
   *
   * Why 1/z? Perspective projection is not linear in screen space, but 1/z IS.
   * So we interpolate 1/z with the barycentric weights and invert it at the end.
   * (Interpolating z directly makes surfaces "swim" and break the Z-buffer.)
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