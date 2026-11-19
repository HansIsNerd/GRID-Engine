import { Vector3 } from './Vector3';

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class Matrix4 {
  public readonly elements: Float32Array;

  constructor() {
    this.elements = new Float32Array(16);
    this.elements[0] = 1;
    this.elements[5] = 1;
    this.elements[10] = 1;
    this.elements[15] = 1;
  }

  public multiply(other: Matrix4): Matrix4 {
    const a = this.elements;
    const b = other.elements;
    const out = new Matrix4();
    const o = out.elements;
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0);
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

  public setTRS(
    px: number,
    py: number,
    pz: number,
    angleY: number,
    sx: number,
    sy: number,
    sz: number
  ): void {
    const e = this.elements;
    const c = Math.cos(angleY);
    const s = Math.sin(angleY);
    e[0] = c * sx;
    e[1] = 0;
    e[2] = -s * sx;
    e[3] = 0;
    e[4] = 0;
    e[5] = sy;
    e[6] = 0;
    e[7] = 0;
    e[8] = s * sz;
    e[9] = 0;
    e[10] = c * sz;
    e[11] = 0;
    e[12] = px;
    e[13] = py;
    e[14] = pz;
    e[15] = 1;
  }

  public transformPoint(v: Vector3): Vector3 {
    const e = this.elements;
    return new Vector3(
      (e[0] ?? 0) * v.x + (e[4] ?? 0) * v.y + (e[8] ?? 0) * v.z + (e[12] ?? 0),
      (e[1] ?? 0) * v.x + (e[5] ?? 0) * v.y + (e[9] ?? 0) * v.z + (e[13] ?? 0),
      (e[2] ?? 0) * v.x + (e[6] ?? 0) * v.y + (e[10] ?? 0) * v.z + (e[14] ?? 0)
    );
  }

  public transformPointWithW(v: Vector3): Vec4 {
    const e = this.elements;
    return {
      x: (e[0] ?? 0) * v.x + (e[4] ?? 0) * v.y + (e[8] ?? 0) * v.z + (e[12] ?? 0),
      y: (e[1] ?? 0) * v.x + (e[5] ?? 0) * v.y + (e[9] ?? 0) * v.z + (e[13] ?? 0),
      z: (e[2] ?? 0) * v.x + (e[6] ?? 0) * v.y + (e[10] ?? 0) * v.z + (e[14] ?? 0),
      w: (e[3] ?? 0) * v.x + (e[7] ?? 0) * v.y + (e[11] ?? 0) * v.z + (e[15] ?? 0),
    };
  }

  public transformAffineInto(x: number, y: number, z: number, out: Float64Array, offset: number): void {
    const e = this.elements;
    out[offset] = (e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0);
    out[offset + 1] = (e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0);
    out[offset + 2] = (e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 0) * z + (e[14] ?? 0);
  }

  public transformInto(x: number, y: number, z: number, out: Float64Array, offset: number): void {
    const e = this.elements;
    out[offset] = (e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0);
    out[offset + 1] = (e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0);
    out[offset + 2] = (e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 0) * z + (e[14] ?? 0);
    out[offset + 3] = (e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 0);
  }
}