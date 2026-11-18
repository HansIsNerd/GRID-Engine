export class Input {
  private readonly keys: Set<string>;

  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private readonly onBlur: () => void;

  constructor() {
    this.keys = new Set<string>();

    this.onKeyDown = (e: KeyboardEvent): void => {
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault(); // don't scroll the page
    };
    this.onKeyUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
    // Losing window focus swallows keyup events, so clear to avoid stuck keys.
    this.onBlur = (): void => {
      this.keys.clear();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  public isDown(code: string): boolean {
    return this.keys.has(code);
  }

  public get forward(): boolean {
    return this.isDown('KeyW') || this.isDown('ArrowUp');
  }
  public get backward(): boolean {
    return this.isDown('KeyS') || this.isDown('ArrowDown');
  }
  public get left(): boolean {
    return this.isDown('KeyA') || this.isDown('ArrowLeft');
  }
  public get right(): boolean {
    return this.isDown('KeyD') || this.isDown('ArrowRight');
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.keys.clear();
  }
}