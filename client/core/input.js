// Keyboard and mouse state. Owned by: Integration.
// Keys use KeyboardEvent.code names: 'KeyW', 'Space', 'ArrowUp', 'Digit1', ...

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, active: false, down: new Set(), clicked: new Set() };
  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

  const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  addEventListener('keydown', (e) => {
    if (typing()) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousemove', (e) => { mouse.x = e.offsetX; mouse.y = e.offsetY; mouse.active = true; });
  canvas.addEventListener('mousedown', (e) => { mouse.down.add(e.button); mouse.clicked.add(e.button); });
  addEventListener('mouseup', (e) => mouse.down.delete(e.button));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    mouse,
    /** key held right now */
    down: (code) => down.has(code),
    /** key went down this frame (fires once per press) */
    pressed: (code) => pressed.has(code),
    /** mouse button (0 left, 2 right) clicked this frame */
    clicked: (button = 0) => mouse.clicked.has(button),
    /** mouse button held right now */
    mouseDown: (button = 0) => mouse.down.has(button),
    endFrame() { pressed.clear(); mouse.clicked.clear(); },
  };
}
