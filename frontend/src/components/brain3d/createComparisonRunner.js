import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Contours are traced in the coordinates of the supplied 1280×1024 logo.
// Every visible front/back detail is sampled from that original artwork.
const contours = {
  brain: [
    [503, 318],
    [510, 298],
    [528, 280],
    [551, 270],
    [575, 256],
    [599, 250],
    [624, 252],
    [641, 254],
    [664, 250],
    [691, 252],
    [716, 259],
    [735, 274],
    [745, 287],
    [758, 297],
    [766, 316],
    [771, 335],
    [766, 353],
    [753, 374],
    [737, 390],
    [718, 398],
    [708, 406],
    [715, 420],
    [705, 427],
    [690, 424],
    [674, 416],
    [654, 413],
    [634, 410],
    [612, 408],
    [589, 411],
    [566, 411],
    [544, 406],
    [524, 400],
    [507, 390],
    [495, 376],
    [487, 360],
    [485, 343],
    [490, 329],
  ],
  fist: [
    [419, 363],
    [425, 349],
    [435, 341],
    [447, 339],
    [458, 341],
    [469, 347],
    [478, 359],
    [482, 373],
    [477, 388],
    [466, 397],
    [451, 400],
    [437, 395],
    [426, 386],
    [420, 375],
  ],
  shoe: [
    [409, 471],
    [417, 464],
    [428, 465],
    [441, 474],
    [455, 487],
    [469, 502],
    [478, 512],
    [476, 519],
    [467, 523],
    [454, 520],
    [439, 513],
    [425, 503],
    [415, 491],
    [409, 479],
  ],
};

async function readLogo(own, signal) {
  const response = await fetch("/assets/logo2.png", { signal });
  if (!response.ok) throw new Error("Logo unavailable");
  const url = URL.createObjectURL(await response.blob());
  try {
    const image = await new Promise((resolve, reject) => {
      const image = new Image();
      const abort = () => {
        image.src = "";
        reject(new DOMException("Aborted", "AbortError"));
      };
      image.onload = () => {
        signal.removeEventListener("abort", abort);
        resolve(image);
      };
      image.onerror = () => {
        signal.removeEventListener("abort", abort);
        reject(new Error("Logo unavailable"));
      };
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
      if (signal.aborted) abort();
    });
    const texture = own(new THREE.Texture(image));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function artPiece({ contour, center, scale, depth, texture, own, edge }) {
  const shape = new THREE.Shape();
  contour.forEach(([x, y], index) =>
    shape[index ? "lineTo" : "moveTo"](
      (x - center[0]) * scale,
      (center[1] - y) * scale,
    ),
  );
  shape.closePath();
  const group = new THREE.Group();
  const bevel = Math.min(0.035, depth / 4);
  const volume = own(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      curveSegments: 8,
      steps: 1,
    }),
  );
  volume.translate(0, 0, -depth / 2);
  group.add(new THREE.Mesh(volume, edge));
  const face = own(new THREE.ShapeGeometry(shape));
  const position = face.attributes.position;
  const uv = face.attributes.uv;
  for (let i = 0; i < position.count; i++)
    uv.setXY(
      i,
      (position.getX(i) / scale + center[0]) / 1280,
      1 - (center[1] - position.getY(i) / scale) / 1024,
    );
  const front = own(
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04,
      toneMapped: false,
      side: THREE.FrontSide,
    }),
  );
  const rear = own(
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04,
      toneMapped: false,
      side: THREE.BackSide,
    }),
  );
  const frontMesh = new THREE.Mesh(face, front);
  frontMesh.position.z = depth / 2 + bevel + 0.002;
  group.add(frontMesh);
  const rearMesh = new THREE.Mesh(face, rear);
  rearMesh.position.z = -depth / 2 - bevel - 0.002;
  group.add(rearMesh);
  return group;
}

export async function createComparisonRunner({ variant, own, signal }) {
  const group = new THREE.Group();
  group.name = `${variant}-running-brain`;
  const body = new THREE.Group();
  body.name = "articulated-runner";
  group.add(body);
  const burgundy = own(
    new THREE.MeshStandardMaterial({
      color: variant === "logo" ? 0x96006b : 0x8e4d85,
      roughness: 0.55,
      metalness: 0.03,
    }),
  );
  const shoeMaterial = own(
    new THREE.MeshStandardMaterial({
      color: 0xe54c9d,
      roughness: 0.43,
      metalness: 0.04,
    }),
  );
  const soleMaterial = own(
    new THREE.MeshStandardMaterial({ color: 0x803358, roughness: 0.72 }),
  );
  const handMaterial = own(
    new THREE.MeshStandardMaterial({ color: 0xe9a7cb, roughness: 0.6 }),
  );
  let texture;
  if (variant === "logo") {
    texture = await readLogo(own, signal);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const original = artPiece({
      contour: contours.brain,
      center: [628, 340],
      scale: 0.0082,
      depth: 0.4,
      texture,
      own,
      edge: burgundy,
    });
    original.name = "original-logo-brain-extrusion";
    original.position.y = 0.58;
    body.add(original);
  } else {
    const response = await fetch("/assets/brain-model.glb", { signal });
    if (!response.ok) throw new Error("Brain model unavailable");
    const gltf = await new GLTFLoader().parseAsync(
      await response.arrayBuffer(),
      "",
    );
    const model = gltf.scene;
    // Register late-parsed geometry before checking abort so the caller can dispose it.
    model.traverse((object) => {
      if (object.isMesh) {
        own(object.geometry);
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const cortex = own(
      new THREE.MeshPhysicalMaterial({
        color: 0xdba2c8,
        roughness: 0.48,
        metalness: 0.03,
        clearcoat: 0.25,
        envMapIntensity: 0.35,
      }),
    );
    const lower = own(
      new THREE.MeshStandardMaterial({
        color: 0xb89bce,
        roughness: 0.52,
        metalness: 0.02,
        envMapIntensity: 0.25,
      }),
    );
    model.traverse((object) => {
      if (object.isMesh)
        object.material = /cerebellum|stem/.test(object.name) ? lower : cortex;
    });
    const bounds = new THREE.Box3().setFromObject(model),
      center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    model.position.sub(center);
    const normalized = new THREE.Group();
    normalized.name = "anatomical-glb-brain";
    normalized.scale.setScalar(2.4 / Math.max(size.x, size.y, size.z));
    normalized.add(model);
    normalized.position.y = 0.62;
    body.add(normalized);
  }
  const sphere = own(new THREE.SphereGeometry(1, 16, 12));
  const segmentGeometry = own(new THREE.CylinderGeometry(1, 1, 1, 10));
  function ellipsoid(parent, material, position, scale) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }
  function limb(name) {
    const root = new THREE.Group();
    root.name = name;
    body.add(root);
    const segments = [
      new THREE.Mesh(segmentGeometry, burgundy),
      new THREE.Mesh(segmentGeometry, burgundy),
    ];
    segments.forEach((mesh) => root.add(mesh));
    const joints = [0, 1, 2].map(() =>
      ellipsoid(root, burgundy, [0, 0, 0], [0.047, 0.047, 0.047]),
    );
    return { root, segments, joints };
  }
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = limb(`runner-${side < 0 ? "near" : "far"}-leg`);
    let foot;
    if (variant === "logo") {
      foot = artPiece({
        contour: contours.shoe,
        center: [445, 494],
        scale: 0.0065,
        depth: 0.12,
        texture,
        own,
        edge: burgundy,
      });
      foot.rotation.z = 0.7;
    } else {
      foot = new THREE.Group();
      ellipsoid(foot, soleMaterial, [-0.1, -0.04, 0], [0.23, 0.055, 0.11]);
      ellipsoid(foot, shoeMaterial, [-0.09, 0.005, 0], [0.23, 0.075, 0.105]);
      ellipsoid(
        foot,
        handMaterial,
        [-0.04, 0.055, 0.04],
        [0.075, 0.014, 0.035],
      );
    }
    const ankle = new THREE.Group();
    ankle.add(foot);
    leg.root.add(ankle);
    legs.push({ ...leg, ankle, side });
    const arm = limb(`runner-${side < 0 ? "near" : "far"}-arm`);
    let hand;
    if (variant === "logo")
      hand = artPiece({
        contour: contours.fist,
        center: [450, 372],
        scale: 0.0055,
        depth: 0.11,
        texture,
        own,
        edge: burgundy,
      });
    else {
      hand = new THREE.Group();
      ellipsoid(hand, handMaterial, [0, 0, 0], [0.105, 0.13, 0.09]);
      ellipsoid(
        hand,
        handMaterial,
        [0.065, -0.02, 0.025],
        [0.055, 0.07, 0.055],
      );
    }
    arm.root.add(hand);
    arms.push({ ...arm, hand, side });
  }
  const up = new THREE.Vector3(0, 1, 0);
  function joint(a, b, l1, l2, sign = 1) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.001);
    const dir = new THREE.Vector2(dx, dy).normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const high = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    return new THREE.Vector3(
      a.x + dir.x * along - dir.y * high * sign,
      a.y + dir.y * along + dir.x * high * sign,
      a.z,
    );
  }
  function pose(part, a, k, b, radius) {
    [a, k, b].forEach((point, index) =>
      part.joints[index].position.copy(point),
    );
    [
      [a, k],
      [k, b],
    ].forEach(([from, to], index) => {
      const mesh = part.segments[index],
        direction = new THREE.Vector3().subVectors(to, from);
      mesh.position.copy(from).add(to).multiplyScalar(0.5);
      mesh.scale.set(radius, direction.length(), radius);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
    });
  }
  function update(time) {
    const phase = time * 4.4 + 0.6;
    const bob = Math.cos(phase * 2) * 0.025;
    body.position.y = bob;
    body.rotation.z = -0.025;
    body.rotation.y = Math.sin(phase) * 0.018;
    for (const leg of legs) {
      const cycle = phase + (leg.side > 0 ? Math.PI : 0),
        z = leg.side * 0.25;
      const hip = new THREE.Vector3(
        leg.side * 0.13,
        variant === "logo" ? 0.06 : -0.18,
        z,
      );
      const foot = new THREE.Vector3(
        -0.78 * Math.cos(cycle),
        -0.94 + 0.32 * Math.max(0, Math.sin(cycle)) - bob,
        z,
      );
      const knee =
        variant === "logo"
          ? joint(hip, foot, 0.69, 0.7)
          : joint(hip, foot, 0.59, 0.65);
      pose(leg, hip, knee, foot, variant === "logo" ? 0.044 : 0.04);
      leg.ankle.position.copy(foot);
      leg.ankle.rotation.z = 0.09 * Math.sin(cycle);
    }
    for (const arm of arms) {
      const cycle = phase + (arm.side > 0 ? Math.PI : 0),
        z = -arm.side * (variant === "logo" ? 0.23 : 0.31);
      const shoulder = new THREE.Vector3(
        arm.side * 0.83,
        arm.side < 0 ? 0.3 : 0.66,
        z,
      );
      const hand = new THREE.Vector3(
        arm.side * (1.22 + 0.12 * Math.sin(cycle)),
        0.47 + 0.36 * Math.cos(cycle),
        z,
      );
      const elbow = joint(shoulder, hand, 0.4, 0.45);
      pose(arm, shoulder, elbow, hand, variant === "logo" ? 0.042 : 0.035);
      arm.hand.position.copy(hand);
      arm.hand.rotation.z = -arm.side * 0.16 * Math.cos(cycle);
    }
    group.userData.runPhase = phase;
    return phase;
  }
  update(0);
  return { group, update };
}
