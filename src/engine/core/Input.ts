export class Input {
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;

  public action: boolean = false;
  public actionJustPressed: boolean = false;

  public inventoryJustPressed: boolean = false;

  public mouseX: number = 0;
  public mouseY: number = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyI' && !e.repeat) this.inventoryJustPressed = true;
      this.handleKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
    window.addEventListener('blur', () => {
      this.forward = false;
      this.backward = false;
      this.left = false;
      this.right = false;
      this.action = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (e.button === 0) {
        if (!this.action) this.actionJustPressed = true;
        this.action = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.action = false;
    });
  }

  private handleKey(code: string, isDown: boolean): void {
    if (code === 'KeyW' || code === 'ArrowUp') this.forward = isDown;
    if (code === 'KeyS' || code === 'ArrowDown') this.backward = isDown;
    if (code === 'KeyA' || code === 'ArrowLeft') this.left = isDown;
    if (code === 'KeyD' || code === 'ArrowRight') this.right = isDown;
  }

  public resetJustPressed(): void {
    this.actionJustPressed = false;
    this.inventoryJustPressed = false;
  }
}