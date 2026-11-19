export class Input {
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;

  public action: boolean = false;
  public actionJustPressed: boolean = false;

  public spaceJustPressed: boolean = false;
  public inventoryJustPressed: boolean = false;
  public saveJustPressed: boolean = false;

  public qJustPressed: boolean = false;
  public eJustPressed: boolean = false;
  public rJustPressed: boolean = false;

  public mouseX: number = 0;
  public mouseY: number = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'KeyI') this.inventoryJustPressed = true;
        if (e.code === 'KeyP') this.saveJustPressed = true;
        if (e.code === 'Space') this.spaceJustPressed = true;
        if (e.code === 'KeyQ') this.qJustPressed = true;
        if (e.code === 'KeyE') this.eJustPressed = true;
        if (e.code === 'KeyR') this.rJustPressed = true;
      }
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
    this.spaceJustPressed = false;
    this.inventoryJustPressed = false;
    this.saveJustPressed = false;
    this.qJustPressed = false;
    this.eJustPressed = false;
    this.rJustPressed = false;
  }
}