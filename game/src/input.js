// Shadow Veil — keyboard and mouse input.
// Keys are tracked as a live Set so holding W and Shift together just works.
// Mouse clicks on the canvas become world coordinates for pebble throws and
// for the buttons the screens draw. The page never scrolls on game keys.

export function createInput() {
  return {
    keys: new Set(),
    mouse: { x: 0, y: 0, inside: false },
    click: null, // {x, y} in canvas pixels, consumed by the game each frame
    pressed: new Set(), // keys pressed since the last frame (edge-triggered)
  };
}

const GAME_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'shift', ' ',
]);

// Attach listeners to the window and the canvas. Returns a detach function
// for tests that mount the game more than once.
export function attachInput(input, canvas) {
  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (GAME_KEYS.has(key)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(key);
      input.pressed.add(key);
    }
  }

  function onKeyUp(e) {
    input.keys.delete(e.key.toLowerCase());
  }

  function onBlur() {
    input.keys.clear();
  }

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onMouseMove(e) {
    const p = toCanvas(e);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    input.mouse.inside = true;
  }

  function onMouseLeave() {
    input.mouse.inside = false;
  }

  function onClick(e) {
    input.click = toCanvas(e);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('click', onClick);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('click', onClick);
  };
}

// Was this key pressed since the last frame? Edge-triggered actions (start,
// pause, restart, mute) read this; held movement reads `keys`.
export function wasPressed(input, key) {
  return input.pressed.has(key.toLowerCase());
}

// Clear the per-frame edges: call once per frame after the game has read them.
export function endFrameInput(input) {
  input.pressed.clear();
  input.click = null;
}
