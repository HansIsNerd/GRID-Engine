export class Input {
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;
  public action: boolean = false;
  public actionJustPressed: boolean = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.setKey(e.code, true, e.repeat)) e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.setKey(e.code, false, false)) e.preventDefault();
  };

  private readonly onBlur = (): void => {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.action = false;
    this.actionJustPressed = false;
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private setKey(code: string, down: boolean, repeat: boolean): boolean {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.forward = down;
        return true;
      case 'KeyS':
      case 'ArrowDown':
        this.backward = down;
        return true;
      case 'KeyA':
      case 'ArrowLeft':
        this.left = down;
        return true;
      case 'KeyD':
      case 'ArrowRight':
        this.right = down;
        return true;
      case 'Space':
        if (down && !this.action && !repeat) this.actionJustPressed = true;
        this.action = down;
        return true;
      default:
        return false;
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}   