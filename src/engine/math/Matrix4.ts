import { Vector3 } from './Vector3';

/** Homogeneous (clip-space) point. */
export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Matrix4 — 4x4 matrix in COLUMN-MAJOR order (OpenGL standard).
 *
 * Memory layout (index = column * 4 + row):
 *
 *     | m[0] m[4] m[8]  m[12] |      m[12], m[13], m[14] = translation
 *     | m[1] m[5] m[9]  m[13] |
 *     | m[2] m[6] m[10] m[14] |
 *     | m[3] m[7] m[11] m[15] |
 *
 * We use column vectors, so a point is transformed as  p' = M * p,
 * and a chain "A then B then C" is written  C * B * A.
 */
export class Matrix4 {
  public readonly m: Float64Array;

  constructor() {
    this.m = new Float64Array(16);
    this.m[0] = 1;
    this.m[5] = 1;
    this.m[10] = 1;
    this.m[15] = 1;
  }

  private get(i: number): number {
    return this.m[i] ?? 0;
  }

  public static identity(): Matrix4 {
    return new Matrix4();
  }

  /** Returns this * other  (other is applied FIRST, this is applied second). */
  public multiply(other: Matrix4): Matrix4 {
    const out = new Matrix4();
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += this.get(k * 4 + r) * other.get(c * 4 + k);
        }
        out.m[c * 4 + r] = sum;
      }
    }
    return out;
  }

  public static translation(x: number, y: number, z: number): Matrix4 {
    const r = new Matrix4();
    r.m[12] = x;
    r.m[13] = y;
    r.m[14] = z;
    return r;
  }

  /** Rotation around the X axis (used for the camera pitch). */
  public static rotationX(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const r = new Matrix4();
    // y' = c*y - s*z ;  z' = s*y + c*z
    r.m[5] = c;
    r.m[6] = s;
    r.m[9] = -s;
    r.m[10] = c;
    return r;
  }

  /** Rotation around the Y axis (camera yaw / player facing). */
  public static rotationY(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const r = new Matrix4();
    // x' = c*x + s*z ;  z' = -s*x + c*z
    r.m[0] = c;
    r.m[2] = -s;
    r.m[8] = s;
    r.m[10] = c;
    return r;
  }

  /**
   * OpenGL-style perspective projection.
   * The camera looks down -Z. The matrix puts  w_clip = -z_view  (the distance
   * in front of the camera), so dividing by w later gives the "far things look
   * smaller" effect.
   *
   * @param fovY   vertical field of view in radians
   * @param aspect PHYSICAL width/height of the screen (not columns/rows!)
   */
  public static perspective(fovY: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    const r = new Matrix4();
    r.m[0] = f / aspect;
    r.m[5] = f;
    r.m[10] = (far + near) * nf;
    r.m[11] = -1; // <- copies -z into w
    r.m[14] = 2 * far * near * nf;
    r.m[15] = 0;
    return r;
  }

  /**
   * Transforms a point (w assumed 1) and returns only X,Y,Z.
   * Meant for affine matrices (rotation/translation): world-space vertices,
   * normals and lighting. NO perspective divide happens here.
   */
  public transformPoint(v: Vector3): Vector3 {
    const m = this;
    return new Vector3(
      m.get(0) * v.x + m.get(4) * v.y + m.get(8) * v.z + m.get(12),
      m.get(1) * v.x + m.get(5) * v.y + m.get(9) * v.z + m.get(13),
      m.get(2) * v.x + m.get(6) * v.y + m.get(10) * v.z + m.get(14)
    );
  }

  /**
   * Transforms a point and keeps the 4th component W.
   * Used with the projection matrix: the caller divides x,y by w to get
   * normalized device coordinates, and uses 1/w for perspective-correct depth.
   */
  public transformPointWithW(v: Vector3): Vec4 {
    const m = this;
    return {
      x: m.get(0) * v.x + m.get(4) * v.y + m.get(8) * v.z + m.get(12),
      y: m.get(1) * v.x + m.get(5) * v.y + m.get(9) * v.z + m.get(13),
      z: m.get(2) * v.x + m.get(6) * v.y + m.get(10) * v.z + m.get(14),
      w: m.get(3) * v.x + m.get(7) * v.y + m.get(11) * v.z + m.get(15),
    };
  }
}