const screen = document.querySelector('#screen');
const touchLayer = document.createElement('div');
let touchMap = new Map();
let isChoosing = false;
let choiceId = null;
let beepInterval = null;
let finishTimeout = null;

const MIN_TOUCHES = 1;
const MAX_TOUCHES = 6;

touchLayer.className = 'touch-layer';
touchLayer.style.pointerEvents = 'none';
screen.appendChild(touchLayer);

function createTouchPoint(id, x, y) {
  const point = document.createElement('div');
  point.className = 'touch-point';
  point.dataset.id = id;
  point.style.left = `${x}px`;
  point.style.top = `${y}px`;

  const halo = document.createElement('div');
  halo.className = 'halo';
  const core = document.createElement('div');
  core.className = 'core';

  point.appendChild(halo);
  point.appendChild(core);
  touchLayer.appendChild(point);

  touchMap.set(id, { point, x, y });
}

function updateTouchPoint(id, x, y) {
  const entry = touchMap.get(id);
  if (!entry) return;
  entry.x = x;
  entry.y = y;
  entry.point.style.left = `${x}px`;
  entry.point.style.top = `${y}px`;
}

function removeTouchPoint(id) {
  const entry = touchMap.get(id);
  if (!entry) return;
  entry.point.remove();
  touchMap.delete(id);
}

function clearAllTouchPoints() {
  touchMap.forEach(({ point }) => point.remove());
  touchMap.clear();
}

function playBeep() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 320;
  gain.gain.value = 0.16;

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.15);

  oscillator.onended = () => audioContext.close();
}

function triggerVibration(pattern) {
  if (!navigator.vibrate) return;
  navigator.vibrate(0);
  setTimeout(() => navigator.vibrate(pattern), 20);
}

function reset() {
  clearInterval(beepInterval);
  clearTimeout(finishTimeout);
  beepInterval = null;
  finishTimeout = null;
  isChoosing = false;
  choiceId = null;
  clearAllTouchPoints();
}

function highlightChoice(id) {
  const chosenEntry = touchMap.get(id);
  if (!chosenEntry) return;

  touchMap.forEach((entry, touchId) => {
    if (touchId !== id) {
      entry.point.remove();
    }
  });

  touchMap = new Map([[id, chosenEntry]]);
  chosenEntry.point.classList.add('selected');
}

function finishSequence() {
  if (touchMap.size === 0) {
    reset();
    return;
  }

  const ids = Array.from(touchMap.keys());
  const selectedId = ids[Math.floor(Math.random() * ids.length)];
  highlightChoice(selectedId);
  choiceId = selectedId;
  isChoosing = false;

  triggerVibration([160, 40, 200]);
}

function startSequence() {
  if (isChoosing || choiceId !== null || touchMap.size < MIN_TOUCHES) return;

  isChoosing = true;
  let beepCount = 0;
  const hesitateVibration = [60, 30, 60];

  playBeep();
  triggerVibration(hesitateVibration);

  beepInterval = setInterval(() => {
    beepCount += 1;
    if (beepCount >= 2) {
      clearInterval(beepInterval);
      beepInterval = null;
      finishTimeout = setTimeout(finishSequence, 600);
    } else {
      playBeep();
      triggerVibration(hesitateVibration);
    }
  }, 700);
}

function handleTouches(event) {
  event.preventDefault();

  const touches = Array.from(event.touches).slice(0, MAX_TOUCHES);
  const activeIds = new Set(touches.map((touch) => touch.identifier));

  if (choiceId !== null) {
    if (touches.length === 0) {
      reset();
    } else if (touchMap.has(choiceId)) {
      const selectedTouch = touches.find((touch) => touch.identifier === choiceId);
      if (selectedTouch) {
        const rect = screen.getBoundingClientRect();
        const x = selectedTouch.clientX - rect.left;
        const y = selectedTouch.clientY - rect.top;
        updateTouchPoint(choiceId, x, y);
      }
    }
    return;
  }

  touches.forEach((touch) => {
    const rect = screen.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (!touchMap.has(touch.identifier)) {
      createTouchPoint(touch.identifier, x, y);
    } else {
      updateTouchPoint(touch.identifier, x, y);
    }
  });

  touchMap.forEach((entry, id) => {
    if (!activeIds.has(id)) {
      removeTouchPoint(id);
    }
  });

  if (touches.length === 0) {
    reset();
    return;
  }

  if (touches.length >= MIN_TOUCHES && !isChoosing && choiceId === null) {
    startSequence();
  }
}

['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((eventName) => {
  screen.addEventListener(eventName, handleTouches, { passive: false });
});

window.addEventListener('load', reset);
