// src/engine/core/Input.ts
export class Input {
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;
  
  public action: boolean = false; 
  public actionJustPressed: boolean = false;

  constructor() {
    // --- Keyboard Events (Movement) ---
    window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
    window.addEventListener('keyup', (e) => this.handleKey(e.code, false));

    // --- Mouse Events (Action / Attack) ---
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // 0 adalah Klik Kiri
        if (!this.action) {
          this.actionJustPressed = true; // Trigger sekali saat ditekan
        }
        this.action = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.action = false;
      }
    });
  }

  private handleKey(code: string, isDown: boolean) {
    if (code === 'KeyW' || code === 'ArrowUp') this.forward = isDown;
    if (code === 'KeyS' || code === 'ArrowDown') this.backward = isDown;
    if (code === 'KeyA' || code === 'ArrowLeft') this.left = isDown;
    if (code === 'KeyD' || code === 'ArrowRight') this.right = isDown;
  }

  // Panggil ini di akhir game loop (di Engine.ts)
  public resetJustPressed() {
    this.actionJustPressed = false;
  }
}