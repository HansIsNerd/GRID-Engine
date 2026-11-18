/**
 * Vector3 — minimal 3D vector.
 *
 * Coordinate system used by the whole engine (OpenGL style, right-handed):
 *   +X = right, +Y = up, +Z = towards the viewer (the camera looks down -Z).
 *
 * All operations return NEW vectors (immutable style). That keeps the math
 * easy to reason about; the engine only creates a few dozen per frame.
 */
export class Vector3 {
  public x: number;
  public y: number;
  public z: number;

  // NOTE: no "parameter properties" (constructor(public x: number)) on purpose.
  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  public add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  public subtract(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  /** Scalar multiplication. */
  public multiply(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  /**
   * Dot product: a·b = |a||b|cos(theta).
   * For two unit vectors it is exactly cos(theta) — we use it for lighting:
   * "how much does this face point towards the light?"
   */
  public dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /**
   * Cross product: a×b is perpendicular to both a and b.
   * With counter-clockwise winding (p1-p0) × (p2-p0) points OUT of the face,
   * which is how we get face normals.
   */
  public cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /** Returns a unit-length copy (or a zero vector if the length is ~0). */
  public normalize(): Vector3 {
    const len = this.length();
    if (len < 1e-8) return new Vector3(0, 0, 0);
    return new Vector3(this.x / len, this.y / len, this.z / len);
  }
}