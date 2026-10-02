import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createComparisonRunner } from "./createComparisonRunner.js";
import { createScienceStage } from "./createScienceStage.js";

export function createBrainScene(options) {
  const partial = [];
  try {
    return initializeScene(options, partial);
  } catch (error) {
    partial.reverse().forEach((release) => {
      try {
        release();
      } catch {}
    });
    throw error;
  }
}
function initializeScene(
  { canvas, container, compact, variant, signal, onState },
  partial,
) {
  const request = new AbortController();
  const resources = new Set();
  let disposed = false,
    ready = false,
    raf = 0,
    previous = 0,
    time = 0,
    yaw = 0,
    pitch = -0.035,
    dragging = false,
    character;
  const own = (resource) => {
    if (disposed) resource.dispose();
    else resources.add(resource);
    return resource;
  };
  partial.push(() => resources.forEach((resource) => resource.dispose()));
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  partial.push(() => renderer.dispose());
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, compact ? 1 : 1.2));
  renderer.setClearColor(0x091245, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(0, 0.15, 8);
  camera.lookAt(0, -0.05, 0);
  const characterRoot = new THREE.Group();
  scene.add(characterRoot);
  scene.add(new THREE.HemisphereLight(0xf4dff5, 0x15204e, 1.25));
  for (const [color, power, position] of [
    [0xffe5ee, 2.4, [-3, 4, 5]],
    [0xb8a5ff, 1.8, [3, 2, -3]],
    [0xf7a7d5, 0.6, [-2, -1, 2]],
  ]) {
    const light = new THREE.DirectionalLight(color, power);
    light.position.set(...position);
    scene.add(light);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  partial.push(() => pmrem.dispose());
  const room = new RoomEnvironment();
  partial.push(() => room.dispose());
  let environment;
  try {
    environment = pmrem.fromScene(room, 0.025, 0.1, 100, { size: 32 });
  } finally {
    room.dispose();
    pmrem.dispose();
  }
  partial.push(() => environment.dispose());
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.45;
  const science = createScienceStage({ own, compact });
  scene.add(science.group);
  let activity = { paused: false, reduced: false, visible: true, inView: true },
    pointerX = 0;
  const active = () =>
    ready &&
    !disposed &&
    activity.visible &&
    activity.inView &&
    !activity.paused &&
    !activity.reduced;
  const render = () => {
    if (!ready || disposed) return;
    characterRoot.rotation.set(
      pitch,
      yaw + (variant === "logo" ? 0.18 : 0.48),
      0,
    );
    science.group.rotation.y = pointerX * 0.025;
    container.dataset.angleY = String(yaw);
    container.dataset.runPhase = String(character.group.userData.runPhase);
    renderer.render(scene, camera);
  };
  const frame = (now) => {
    raf = 0;
    if (!active()) return;
    const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    if (!dragging) time += delta;
    character.update(time);
    science.update(time);
    render();
    raf = requestAnimationFrame(frame);
  };
  const schedule = () => {
    if (active() && !raf) {
      previous = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const requestRender = () => {
    if (disposed || !ready || !activity.visible || !activity.inView || raf)
      return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
      schedule();
    });
  };
  const resize = () => {
    if (disposed) return;
    const viewport = canvas.parentElement;
    const width = Math.max(viewport.clientWidth, 1),
      height = Math.max(viewport.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = compact
      ? Math.max(6.6, 5.2 / camera.aspect)
      : Math.max(6.4, 7.65 / camera.aspect);
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  partial.push(() => observer.disconnect());
  observer.observe(container);
  resize();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    request.abort();
    cancelAnimationFrame(raf);
    clearTimeout(timeout);
    observer.disconnect();
    canvas.removeEventListener("webglcontextlost", lost);
    signal.removeEventListener("abort", dispose);
    resources.forEach((resource) => resource.dispose());
    resources.clear();
    environment.dispose();
    renderer.dispose();
    scene.clear();
  };
  const fail = () => {
    if (!disposed && !signal.aborted) {
      onState("error");
      dispose();
    }
  };
  const lost = (event) => {
    event.preventDefault();
    fail();
  };
  canvas.addEventListener("webglcontextlost", lost);
  signal.addEventListener("abort", dispose, { once: true });
  const timeout = setTimeout(fail, 20000);
  createComparisonRunner({ variant, own, signal: request.signal })
    .then((runner) => {
      if (disposed) return;
      character = runner;
      characterRoot.add(runner.group);
      ready = true;
      clearTimeout(timeout);
      onState("ready");
      resize();
      schedule();
    })
    .catch(fail);
  return {
    dispose,
    setActivity(value) {
      activity = { ...value };
      if (!active()) {
        cancelAnimationFrame(raf);
        raf = 0;
        previous = 0;
      } else schedule();
    },
    setDragging(value) {
      dragging = value;
    },
    point(x) {
      if (disposed || activity.paused || activity.reduced) return;
      pointerX = x;
      requestRender();
    },
    rotate(y, x) {
      if (disposed || activity.paused) return;
      yaw += y;
      pitch = THREE.MathUtils.clamp(pitch + x, -0.36, 0.36);
      requestRender();
    },
    reset() {
      if (disposed || activity.paused) return;
      yaw = 0;
      pitch = -0.035;
      pointerX = 0;
      requestRender();
    },
  };
}
