import { Vector3 } from './Vector3';

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * 4x4 matrix, COLUMN-MAJOR: element (row r, column c) lives at elements[c * 4 + r].
 * Translation therefore sits at indices 12, 13, 14.
 */
export class Matrix4 {
  public readonly elements: Float32Array;

  constructor() {
    this.elements = new Float32Array(16);
    this.elements[0] = 1;
    this.elements[5] = 1;
    this.elements[10] = 1;
    this.elements[15] = 1;
  }

  /** Returns this * other (other is applied first when transforming a point). */
  public multiply(other: Matrix4): Matrix4 {
    const a = this.elements;
    const b = other.elements;
    const out = new Matrix4();
    const o = out.elements;
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + r] * b[c * 4 + k];
        }
        o[c * 4 + r] = sum;
      }
    }
    return out;
  }

  public static rotationX(angle: number): Matrix4 {
    const m = new Matrix4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m.elements[5] = c;
    m.elements[6] = s;
    m.elements[9] = -s;
    m.elements[10] = c;
    return m;
  }

  public static rotationY(angle: number): Matrix4 {
    const m = new Matrix4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m.elements[0] = c;
    m.elements[2] = -s;
    m.elements[8] = s;
    m.elements[10] = c;
    return m;
  }

  public static translation(x: number, y: number, z: number): Matrix4 {
    const m = new Matrix4();
    m.elements[12] = x;
    m.elements[13] = y;
    m.elements[14] = z;
    return m;
  }

  public static scaling(x: number, y: number, z: number): Matrix4 {
    const m = new Matrix4();
    m.elements[0] = x;
    m.elements[5] = y;
    m.elements[10] = z;
    return m;
  }

  /** Right-handed perspective, camera looks down -Z, resulting w = -z_view (positive distance). */
  public static perspective(fovY: number, aspect: number, near: number, far: number): Matrix4 {
    const m = new Matrix4();
    const e = m.elements;
    const f = 1.0 / Math.tan(fovY / 2);
    e[0] = f / aspect;
    e[5] = f;
    e[10] = (far + near) / (near - far);
    e[11] = -1;
    e[14] = (2 * far * near) / (near - far);
    e[15] = 0;
    return m;
  }

  /**
   * Affine transform of a point (w assumed 1, NO perspective divide).
   * Use this for world-space positions, normals and lighting.
   */
  public transformPoint(v: Vector3): Vector3 {
    const e = this.elements;
    return new Vector3(
      e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12],
      e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13],
      e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14]
    );
  }

  /** Full 4D transform. Use this for screen projection and the Z-buffer (w = view depth). */
  public transformPointWithW(v: Vector3): Vec4 {
    const e = this.elements;
    return {
      x: e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12],
      y: e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13],
      z: e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14],
      w: e[3] * v.x + e[7] * v.y + e[11] * v.z + e[15],
    };
  }
}