import * as THREE from 'three';
window.THREE = THREE;
import { buildRoomScene } from './roomBuilder.js';
import { createPOIMarkers, createNavigationPath, createMeasurementTool } from './poiManager.js';
import { SpatialIngestionEngine } from './spatialIngestion.js';

// Application State
const state = {
  mode: 'first-person', // 'first-person' | 'orbit'
  activeLayer: 'solid', // 'solid' | 'splat' | 'navmesh'
  selectedPOI: null,
  fps: 60,
  moveSpeed: 3.5,
  eyeHeight: 1.65,
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  keys: { w: false, a: false, s: false, d: false }
};

// 1. Scene, Camera, Renderer Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);
scene.fog = new THREE.FogExp2(0x020617, 0.045);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, state.eyeHeight, 1.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

// 2. Build 3D Multi-Layer Scene
const { solidGroup, splatGroup, navmeshGroup, roomBounds, pois } = buildRoomScene(scene);

// 3. POI Markers, Navigation Path, and Laser Measurement
const poiMarkers = createPOIMarkers(scene, pois, (poi) => selectPOI(poi));
const navPath = createNavigationPath(scene);
const measureTool = createMeasurementTool(scene);

// Layer Toggle Handlers
const btnLayerSolid = document.getElementById('btn-layer-solid');
const btnLayerSplat = document.getElementById('btn-layer-splat');
const btnLayerNavmesh = document.getElementById('btn-layer-navmesh');

function setLayer(layer) {
  state.activeLayer = layer;
  solidGroup.visible = (layer === 'solid');
  splatGroup.visible = (layer === 'splat');
  navmeshGroup.visible = (layer === 'navmesh');

  const activeClasses = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5';
  const idleClasses = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 border border-transparent';

  btnLayerSolid.className = (layer === 'solid') ? activeClasses : idleClasses;
  btnLayerSplat.className = (layer === 'splat') ? activeClasses : idleClasses;
  btnLayerNavmesh.className = (layer === 'navmesh') ? activeClasses : idleClasses;
}

btnLayerSolid.addEventListener('click', () => setLayer('solid'));
btnLayerSplat.addEventListener('click', () => setLayer('splat'));
btnLayerNavmesh.addEventListener('click', () => setLayer('navmesh'));

// 4. First-Person Pointer Lock & Controls
let isLocked = false;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

const clickOverlay = document.getElementById('click-overlay');
const crosshair = document.getElementById('crosshair');

const supportsTouchControls = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

function enterFirstPersonControls() {
  if (supportsTouchControls) {
    clickOverlay.style.opacity = '0';
    setTimeout(() => { clickOverlay.style.display = 'none'; }, 300);
    crosshair.classList.remove('hidden');
    const instruction = clickOverlay.querySelector('p');
    if (instruction) instruction.textContent = 'Use the virtual joystick to move and drag the screen to look around.';
    return;
  }
  container.requestPointerLock();
}

clickOverlay.addEventListener('click', () => {
  if (state.mode === 'first-person') {
    enterFirstPersonControls();
  } else {
    clickOverlay.style.opacity = '0';
    setTimeout(() => { clickOverlay.style.display = 'none'; }, 300);
  }
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === container;
  if (isLocked) {
    clickOverlay.style.opacity = '0';
    setTimeout(() => { clickOverlay.style.display = 'none'; }, 300);
    crosshair.classList.remove('hidden');
  } else {
    if (state.mode === 'first-person' && !measureTool.isActive()) {
      clickOverlay.style.display = 'flex';
      clickOverlay.style.opacity = '1';
      crosshair.classList.add('hidden');
    }
  }
});

document.addEventListener('mousemove', (event) => {
  if (!isLocked || state.mode !== 'first-person') return;

  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;

  euler.setFromQuaternion(camera.quaternion);
  euler.y -= movementX * 0.0022;
  euler.x -= movementY * 0.0022;
  euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
  camera.quaternion.setFromEuler(euler);
});

// Mobile touch navigation: a virtual movement joystick plus drag-to-look.
if (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) {
  const joystickStyle = document.createElement('style');
  joystickStyle.textContent = `
    #mobile-joystick {
      position: fixed; left: max(20px, env(safe-area-inset-left)); bottom: max(22px, env(safe-area-inset-bottom));
      width: 136px; height: 136px; border-radius: 50%; z-index: 60; touch-action: none;
      background: rgba(15, 23, 42, .55); border: 1px solid rgba(103, 232, 249, .48);
      box-shadow: 0 8px 28px rgba(2, 6, 23, .35); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
    }
    #mobile-joystick::after {
      content: 'MOVE'; position: absolute; bottom: 13px; color: rgba(207, 250, 254, .72);
      font: 700 9px/1 'JetBrains Mono', monospace; letter-spacing: 1.5px; pointer-events: none;
    }
    #mobile-joystick-knob {
      width: 54px; height: 54px; border-radius: 50%; transform: translate(0, 0);
      background: linear-gradient(145deg, rgba(34, 211, 238, .9), rgba(79, 70, 229, .88));
      border: 1px solid rgba(255,255,255,.65); box-shadow: 0 4px 16px rgba(6, 182, 212, .3);
      pointer-events: none;
    }
    #mobile-look-hint {
      position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(32px, env(safe-area-inset-bottom));
      z-index: 40; padding: 8px 10px; border: 1px solid rgba(148,163,184,.35);
      border-radius: 12px; background: rgba(15,23,42,.6); color: rgba(226,232,240,.82);
      font: 10px/1.4 'JetBrains Mono', monospace; pointer-events: none; text-align: center;
    }
    @media (max-width: 420px) {
      #mobile-joystick { width: 118px; height: 118px; }
      #mobile-joystick-knob { width: 48px; height: 48px; }
      #mobile-look-hint { right: 12px; bottom: 26px; max-width: 104px; }
    }
  `;
  document.head.appendChild(joystickStyle);

  const joystick = document.createElement('div');
  joystick.id = 'mobile-joystick';
  joystick.setAttribute('role', 'group');
  joystick.setAttribute('aria-label', 'Virtual movement joystick');
  const knob = document.createElement('div');
  knob.id = 'mobile-joystick-knob';
  joystick.appendChild(knob);
  document.body.appendChild(joystick);

  const lookHint = document.createElement('div');
  lookHint.id = 'mobile-look-hint';
  lookHint.textContent = 'DRAG SCREEN TO LOOK';
  document.body.appendChild(lookHint);

  container.style.touchAction = 'none';
  const joystickRadius = 42;
  const activeKeys = new Set();
  let joystickTouchId = null;
  let lookTouchId = null;
  let lastLookX = 0;
  let lastLookY = 0;

  function setTouchKeys(nextKeys) {
    for (const key of activeKeys) {
      if (!nextKeys.has(key)) state.keys[key] = false;
    }
    for (const key of nextKeys) state.keys[key] = true;
    activeKeys.clear();
    for (const key of nextKeys) activeKeys.add(key);
  }

  function releaseJoystick() {
    joystickTouchId = null;
    setTouchKeys(new Set());
    knob.style.transform = 'translate(0px, 0px)';
  }

  function updateJoystick(touch) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > joystickRadius) {
      dx = dx / distance * joystickRadius;
      dy = dy / distance * joystickRadius;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const magnitude = Math.hypot(dx, dy);
    const nextKeys = new Set();
    if (magnitude > 10) {
      if (dy < -10) nextKeys.add('w');
      if (dy > 10) nextKeys.add('s');
      if (dx < -10) nextKeys.add('a');
      if (dx > 10) nextKeys.add('d');
    }
    setTouchKeys(nextKeys);
  }

  joystick.addEventListener('touchstart', (event) => {
    event.preventDefault();
    if (joystickTouchId !== null) return;
    const touch = event.changedTouches[0];
    joystickTouchId = touch.identifier;
    updateJoystick(touch);
  }, { passive: false });

  joystick.addEventListener('touchmove', (event) => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (touch.identifier === joystickTouchId) updateJoystick(touch);
    }
  }, { passive: false });

  const endJoystickTouch = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === joystickTouchId) releaseJoystick();
    }
  };
  joystick.addEventListener('touchend', endJoystickTouch);
  joystick.addEventListener('touchcancel', endJoystickTouch);

  container.addEventListener('touchstart', (event) => {
    if (state.mode !== 'first-person' || lookTouchId !== null) return;
    const touch = event.changedTouches[0];
    lookTouchId = touch.identifier;
    lastLookX = touch.clientX;
    lastLookY = touch.clientY;
  }, { passive: true });

  container.addEventListener('touchmove', (event) => {
    if (lookTouchId === null || state.mode !== 'first-person') return;
    for (const touch of event.changedTouches) {
      if (touch.identifier !== lookTouchId) continue;
      const deltaX = touch.clientX - lastLookX;
      const deltaY = touch.clientY - lastLookY;
      lastLookX = touch.clientX;
      lastLookY = touch.clientY;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= deltaX * 0.004;
      euler.x -= deltaY * 0.004;
      euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
      camera.quaternion.setFromEuler(euler);
      event.preventDefault();
    }
  }, { passive: false });

  const endLookTouch = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === lookTouchId) lookTouchId = null;
    }
  };
  container.addEventListener('touchend', endLookTouch);
  container.addEventListener('touchcancel', endLookTouch);

  // Keep virtual movement released when switching away from first-person mode.
  window.__releaseMobileJoystick = releaseJoystick;
  window.__resetMobileLookTouch = () => { lookTouchId = null; };
}

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': state.keys.w = true; break;
    case 'KeyA': state.keys.a = true; break;
    case 'KeyS': state.keys.s = true; break;
    case 'KeyD': state.keys.d = true; break;
    case 'Space':
      setNavigationMode(state.mode === 'first-person' ? 'orbit' : 'first-person');
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': state.keys.w = false; break;
    case 'KeyA': state.keys.a = false; break;
    case 'KeyS': state.keys.s = false; break;
    case 'KeyD': state.keys.d = false; break;
  }
});

// Mode Switching (First-Person vs Dollhouse Orbit)
const btnModeFP = document.getElementById('btn-mode-fp');
const btnModeOrbit = document.getElementById('btn-mode-orbit');

function setNavigationMode(newMode) {
  state.mode = newMode;
  if (newMode !== 'first-person' && window.__releaseMobileJoystick) window.__releaseMobileJoystick();
  if (window.__resetMobileLookTouch) window.__resetMobileLookTouch();
  if (newMode === 'first-person') {
    btnModeFP.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5';
    btnModeOrbit.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 border border-transparent';
    camera.position.set(0, state.eyeHeight, 1.8);
    camera.lookAt(0, state.eyeHeight, -2.5);
    clickOverlay.style.display = 'flex';
    clickOverlay.style.opacity = '1';
  } else {
    btnModeOrbit.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5';
    btnModeFP.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-white flex items-center gap-1.5 border border-transparent';
    if (document.pointerLockElement === container) {
      document.exitPointerLock();
    }
    clickOverlay.style.display = 'none';
    crosshair.classList.add('hidden');
    camera.position.set(3.8, 4.2, 4.5);
    camera.lookAt(0, 0.8, -0.5);
  }
}

btnModeFP.addEventListener('click', () => setNavigationMode('first-person'));
btnModeOrbit.addEventListener('click', () => setNavigationMode('orbit'));

// 5. Populate Left Sidebar POI Directory
const poiListContainer = document.getElementById('poi-list');
pois.forEach((poi) => {
  const item = document.createElement('div');
  item.className = 'p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between text-xs group';
  item.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-sm">${poi.icon}</span>
      <div>
        <div class="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">${poi.name}</div>
        <div class="text-[10px] text-slate-400 font-mono">${poi.category}</div>
      </div>
    </div>
    <span class="text-[10px] text-slate-500 group-hover:text-cyan-400 font-mono">Select →</span>
  `;
  item.addEventListener('click', () => selectPOI(poi));
  poiListContainer.appendChild(item);
});

// Modal Logic
const modal = document.getElementById('poi-modal');
const modalTitle = document.getElementById('modal-title');
const modalCat = document.getElementById('modal-category');
const modalDesc = document.getElementById('modal-desc');
const modalCoords = document.getElementById('modal-coords');
const modalIcon = document.getElementById('modal-icon');
const modalClose = document.getElementById('modal-close');
const modalNavBtn = document.getElementById('modal-nav-btn');
const btnNavigate = document.getElementById('btn-navigate');
const btnClearPath = document.getElementById('btn-clear-path');
const routeDistance = document.getElementById('route-distance');

// Juspay Commerce elements
const juspayBox = document.getElementById('juspay-box');
const btnJuspayPay = document.getElementById('btn-juspay-pay');

function selectPOI(poi) {
  state.selectedPOI = poi;
  modalTitle.textContent = poi.name;
  modalCat.textContent = poi.category;
  modalDesc.textContent = poi.desc;
  modalCoords.textContent = `[${poi.coords.join(', ')}]`;
  modalIcon.textContent = poi.icon;

  if (poi.isMerchant) {
    juspayBox.classList.remove('hidden');
  } else {
    juspayBox.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  calculatePath(poi);
}

modalClose.addEventListener('click', () => modal.classList.add('hidden'));

function calculatePath(poi) {
  const len = navPath.setPath(camera.position, poi.coords);
  routeDistance.textContent = `${len.toFixed(1)} m`;
}

modalNavBtn.addEventListener('click', () => {
  if (state.selectedPOI) {
    calculatePath(state.selectedPOI);
    modal.classList.add('hidden');
    if (state.mode === 'first-person') {
      enterFirstPersonControls();
    }
  }
});

btnNavigate.addEventListener('click', () => {
  if (state.selectedPOI) {
    calculatePath(state.selectedPOI);
  } else {
    selectPOI(pois[0]);
  }
});

btnClearPath.addEventListener('click', () => {
  navPath.clear();
  routeDistance.textContent = 'None';
});

// Juspay Tap-to-Pay Simulation
btnJuspayPay.addEventListener('click', () => {
  btnJuspayPay.textContent = 'Processing...';
  btnJuspayPay.disabled = true;
  setTimeout(() => {
    btnJuspayPay.textContent = '✓ Paid via Juspay';
    btnJuspayPay.className = 'px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs transition-all';
    setTimeout(() => {
      btnJuspayPay.textContent = 'Tap to Pay';
      btnJuspayPay.className = 'px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-500/30';
      btnJuspayPay.disabled = false;
    }, 2500);
  }, 1000);
});

// 6. Laser Distance Measurement Tool
const btnMeasure = document.getElementById('btn-measure');
const measureBadge = document.getElementById('measure-badge');
const measureResult = document.getElementById('measure-result');
const measureValue = document.getElementById('measure-value');

btnMeasure.addEventListener('click', () => {
  const isActive = measureTool.toggle();
  if (isActive) {
    btnMeasure.className = 'w-full py-2 px-3 rounded-xl bg-pink-500 text-white font-bold text-xs transition-all shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2';
    measureBadge.textContent = 'Pick Point A';
    measureBadge.className = 'text-[10px] font-mono text-pink-400 font-bold';
    measureResult.classList.remove('hidden');
    measureValue.textContent = 'Select Point A...';
    if (document.pointerLockElement === container) document.exitPointerLock();
  } else {
    btnMeasure.className = 'w-full py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-pink-300 border border-pink-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2';
    measureBadge.textContent = 'Idle';
    measureBadge.className = 'text-[10px] font-mono text-slate-400';
    measureResult.classList.add('hidden');
  }
});

// 7. Top-Down 2D LiDAR Radar (Minimap) with Sweeping Beam
const minimapCanvas = document.getElementById('minimap-canvas');
const mCtx = minimapCanvas.getContext('2d');
const mapW = minimapCanvas.width;
const mapH = minimapCanvas.height;

let radarSweepAngle = 0;

function drawMinimap(deltaTime) {
  mCtx.clearRect(0, 0, mapW, mapH);

  // Background
  mCtx.fillStyle = '#060911';
  mCtx.fillRect(0, 0, mapW, mapH);

  // Radar circular range rings
  mCtx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  mCtx.lineWidth = 1;
  [30, 60, 90].forEach(r => {
    mCtx.beginPath();
    mCtx.arc(mapW / 2, mapH / 2, r, 0, Math.PI * 2);
    mCtx.stroke();
  });

  const toMapX = (x) => ((x + 2.4) / 4.8) * (mapW - 20) + 10;
  const toMapY = (z) => ((z + 2.7) / 5.4) * (mapH - 20) + 10;

  // Draw Room Outer Bounds
  mCtx.strokeStyle = '#0284c7';
  mCtx.lineWidth = 1.5;
  mCtx.strokeRect(10, 10, mapW - 20, mapH - 20);

  // Draw Furniture Obstacles
  // Desk
  mCtx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  mCtx.fillRect(toMapX(-0.9), toMapY(-2.65), toMapX(0.3) - toMapX(-0.9), toMapY(-2.1) - toMapY(-2.65));
  mCtx.strokeStyle = '#06b6d4';
  mCtx.strokeRect(toMapX(-0.9), toMapY(-2.65), toMapX(0.3) - toMapX(-0.9), toMapY(-2.1) - toMapY(-2.65));

  // Beds
  mCtx.fillStyle = 'rgba(19, 78, 74, 0.8)';
  mCtx.fillRect(toMapX(1.2), toMapY(-0.5), toMapX(2.3) - toMapX(1.2), toMapY(1.5) - toMapY(-0.5));
  mCtx.fillStyle = 'rgba(74, 4, 78, 0.8)';
  mCtx.fillRect(toMapX(-2.3), toMapY(-0.5), toMapX(-1.2) - toMapX(-2.3), toMapY(1.5) - toMapY(-0.5));

  // Door
  mCtx.strokeStyle = '#f59e0b';
  mCtx.lineWidth = 2.5;
  mCtx.beginPath();
  mCtx.moveTo(toMapX(0.9), toMapY(-2.7));
  mCtx.lineTo(toMapX(1.8), toMapY(-2.7));
  mCtx.stroke();

  // POIs
  pois.forEach((poi) => {
    const px = toMapX(poi.coords[0]);
    const py = toMapY(poi.coords[2]);
    mCtx.fillStyle = poi.isMerchant ? '#34d399' : '#38bdf8';
    mCtx.beginPath();
    mCtx.arc(px, py, 4, 0, Math.PI * 2);
    mCtx.fill();
  });

  // Animated 360-degree LiDAR Radar Sweeping Beam
  radarSweepAngle += deltaTime * 2.2;
  const sweepX = mapW / 2 + Math.cos(radarSweepAngle) * (mapW / 2);
  const sweepY = mapH / 2 + Math.sin(radarSweepAngle) * (mapH / 2);

  mCtx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  mCtx.lineWidth = 2;
  mCtx.beginPath();
  mCtx.moveTo(mapW / 2, mapH / 2);
  mCtx.lineTo(sweepX, sweepY);
  mCtx.stroke();

  // Player / Camera Position & FOV Cone
  const camX = toMapX(camera.position.x);
  const camY = toMapY(camera.position.z);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const angle = Math.atan2(dir.z, dir.x);

  mCtx.fillStyle = 'rgba(6, 182, 212, 0.25)';
  mCtx.beginPath();
  mCtx.moveTo(camX, camY);
  mCtx.arc(camX, camY, 26, angle - 0.45, angle + 0.45);
  mCtx.closePath();
  mCtx.fill();

  mCtx.fillStyle = '#22d3ee';
  mCtx.beginPath();
  mCtx.arc(camX, camY, 4.5, 0, Math.PI * 2);
  mCtx.fill();
  mCtx.strokeStyle = '#ffffff';
  mCtx.lineWidth = 1.5;
  mCtx.stroke();
}

// 8. Raycasting for POIs & Laser Measurement Clicking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  if (measureTool.isActive()) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(solidGroup.children, true);
    if (intersects.length > 0) {
      const res = measureTool.addClick(intersects[0].point);
      if (res && res.step === 'first') {
        measureBadge.textContent = 'Pick Point B';
        measureValue.textContent = `Point A: [${res.pt.x.toFixed(2)}, ${res.pt.y.toFixed(2)}, ${res.pt.z.toFixed(2)}]`;
      } else if (res && res.step === 'complete') {
        measureBadge.textContent = 'Measured!';
        measureValue.textContent = `${res.dist.toFixed(2)} m`;
      }
    }
    return;
  }

  if (state.mode === 'orbit') {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(poiMarkers.markerGroup.children, true);
    if (intersects.length > 0) {
      let root = intersects[0].object;
      while (root.parent && root.parent !== poiMarkers.markerGroup) {
        root = root.parent;
      }
      if (root.userData && root.userData.poi) {
        selectPOI(root.userData.poi);
      }
    }
  }
});

// 9. Main Render & Physics Loop
const clock = new THREE.Clock();
let frameCount = 0;
let lastFpsTime = performance.now();

const statFps = document.getElementById('stat-fps');
const statPos = document.getElementById('stat-pos');

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsedTime = clock.getElapsedTime();

  // First-Person Walkthrough Physics
  if (state.mode === 'first-person') {
    state.velocity.x -= state.velocity.x * 10.0 * delta;
    state.velocity.z -= state.velocity.z * 10.0 * delta;

    state.direction.z = Number(state.keys.w) - Number(state.keys.s);
    state.direction.x = Number(state.keys.d) - Number(state.keys.a);
    state.direction.normalize();

    if (state.keys.w || state.keys.s) state.velocity.z -= state.direction.z * state.moveSpeed * 10.0 * delta;
    if (state.keys.a || state.keys.d) state.velocity.x -= state.direction.x * state.moveSpeed * 10.0 * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    camera.position.addScaledVector(forward, -state.velocity.z * delta);
    camera.position.addScaledVector(right, -state.velocity.x * delta);

    // Bounding Box Collision Constraints
    const margin = 0.45;
    camera.position.x = Math.max(-roomBounds.width / 2 + margin, Math.min(roomBounds.width / 2 - margin, camera.position.x));
    camera.position.z = Math.max(-roomBounds.length / 2 + margin, Math.min(roomBounds.length / 2 - margin, camera.position.z));
    camera.position.y = state.eyeHeight;
  } else {
    // Dollhouse slow orbit
    const orbitRadius = 6.2;
    camera.position.x = Math.sin(elapsedTime * 0.12) * orbitRadius;
    camera.position.z = Math.cos(elapsedTime * 0.12) * orbitRadius;
    camera.position.y = 4.2;
    camera.lookAt(0, 0.8, 0);
  }

  // Update POIs and Navigation Line
  poiMarkers.update(elapsedTime);
  navPath.update(elapsedTime);

  // Minimap
  drawMinimap(delta);

  // Metrics
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    state.fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    statFps.textContent = state.fps;
    statPos.textContent = `[${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}]`;
    frameCount = 0;
    lastFpsTime = now;
  }

  renderer.render(scene, camera);
}

// 10. Spatial Upload & Reconstruct Engine Integration
const btnOpenUpload = document.getElementById('btn-open-upload');
const uploadModal = document.getElementById('upload-modal');
const uploadModalClose = document.getElementById('upload-modal-close');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const quotaBadge = document.getElementById('quota-badge');
const uploadProgressBox = document.getElementById('upload-progress-box');
const progressStatusText = document.getElementById('progress-status-text');
const progressPct = document.getElementById('progress-pct');
const progressBarFill = document.getElementById('progress-bar-fill');

const ingestionEngine = new SpatialIngestionEngine(scene, solidGroup, splatGroup, navmeshGroup, (p) => {
  uploadProgressBox.classList.remove('hidden');
  progressStatusText.textContent = p.msg;
  progressPct.textContent = `${p.pct}%`;
  progressBarFill.style.width = `${p.pct}%`;

  if (p.stage === 'complete') {
    quotaBadge.textContent = `${p.remainingQuota} of 3 Available`;
    setTimeout(() => {
      uploadModal.classList.add('hidden');
      uploadProgressBox.classList.add('hidden');
      progressBarFill.style.width = '0%';
    }, 1800);
  }
});

// Download PLY Handlers
const btnDownloadPly = document.getElementById('btn-download-ply');
if (btnDownloadPly) {
  btnDownloadPly.addEventListener('click', () => {
    try {
      ingestionEngine.exportPLY();
    } catch (err) {
      alert(err.message);
    }
  });
}

function updateQuotaDisplay() {
  const rem = ingestionEngine.getRemainingQuota();
  quotaBadge.textContent = `${rem} of 3 Available`;
  if (rem === 0) {
    quotaBadge.className = 'px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-mono font-extrabold border border-red-500/30';
  }
}

btnOpenUpload.addEventListener('click', () => {
  updateQuotaDisplay();
  uploadModal.classList.remove('hidden');
  if (document.pointerLockElement === container) document.exitPointerLock();
});

uploadModalClose.addEventListener('click', () => uploadModal.classList.add('hidden'));

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    await ingestionEngine.processUpload(file);
  } catch (err) {
    alert(err.message);
    uploadProgressBox.classList.add('hidden');
  }
});

// Window Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Global exports for test automation
window.__appState = state;
window.__appCamera = camera;
window.__setNavigationMode = setNavigationMode;
window.__setLayer = setLayer;
window.__selectPOI = selectPOI;

animate();
