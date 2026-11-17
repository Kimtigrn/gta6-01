// Keyboard and pointer input. Held keys give a move/drive vector; one-shot presses
// (confirm, pause, enter car, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked in logical playfield coordinates for aiming.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  const mouse = { x: 640, y: 360, inside: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
        event.preventDefault();
      }
      return;
    }
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || SPRINT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (ENTER_CAR.has(event.code)) {
      actions |= ACTION_ENTER_CAR;
    } else if (MUTE.has(event.code)) {
      actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
    mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });

  function axis(positive, negative) {
    let value = 0;
    for (const code of positive) if (held.has(code)) value += 1;
    for (const code of negative) if (held.has(code)) value -= 1;
    return Math.max(-1, Math.min(1, value));
  }

  return {
    /** Move vector: x right, y down, each -1, 0 or 1. */
    move() {
      return { x: axis(RIGHT, LEFT), y: axis(DOWN, UP) };
    },
    sprint() {
      for (const code of SPRINT) if (held.has(code)) return true;
      return false;
    },
    /** True while the left mouse button is held (shooting). */
    firing() {
      return firing;
    },
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
