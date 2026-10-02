import * as THREE from "three";

export function createScienceStage({ own, compact }) {
  const group = new THREE.Group();
  group.name = "science-stage";
  const lineMaterial = own(
    new THREE.LineBasicMaterial({
      color: 0xb19ad9,
      transparent: true,
      opacity: 0.55,
    }),
  );
  const faint = own(
    new THREE.LineBasicMaterial({
      color: 0x9c83c6,
      transparent: true,
      opacity: 0.13,
    }),
  );
  const pearl = own(
    new THREE.MeshStandardMaterial({
      color: 0xe0cbed,
      roughness: 0.42,
      metalness: 0.1,
    }),
  );
  const pink = own(
    new THREE.MeshStandardMaterial({
      color: 0xda5caa,
      roughness: 0.4,
      metalness: 0.08,
    }),
  );
  const sphere = own(new THREE.SphereGeometry(1, 16, 12));
  const dot = (parent, radius, material, position) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.setScalar(radius);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const path = (points, material, parent = group) => {
    const line = new THREE.Line(
      own(new THREE.BufferGeometry().setFromPoints(points)),
      material,
    );
    parent.add(line);
    return line;
  };
  const stage = new THREE.Mesh(
    own(new THREE.CylinderGeometry(1.65, 1.68, 0.045, 80)),
    own(
      new THREE.MeshStandardMaterial({
        color: 0x171b4c,
        roughness: 0.72,
        metalness: 0.1,
      }),
    ),
  );
  stage.position.y = -1.06;
  group.add(stage);
  const rim = [];
  for (let i = 0; i <= 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    rim.push(new THREE.Vector3(Math.cos(a) * 1.66, -1.032, Math.sin(a) * 1.66));
  }
  path(rim, faint);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const context = shadowCanvas.getContext("2d");
  const radial = context.createRadialGradient(64, 64, 1, 64, 64, 64);
  radial.addColorStop(0, "rgba(0,0,12,.55)");
  radial.addColorStop(1, "rgba(0,0,12,0)");
  context.fillStyle = radial;
  context.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    own(new THREE.PlaneGeometry(2.5, 1.15)),
    own(
      new THREE.MeshBasicMaterial({
        map: own(new THREE.CanvasTexture(shadowCanvas)),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.034;
  group.add(shadow);
  const electrons = [];
  if (!compact) {
    const atom = new THREE.Group();
    atom.position.set(-1.84, 0.61, -0.2);
    group.add(atom);
    dot(atom, 0.085, pink, [0, 0, 0]);
    for (let orbit = 0; orbit < 3; orbit++) {
      const ring = new THREE.Group();
      ring.rotation.z = (orbit * Math.PI) / 3;
      ring.rotation.x = 0.22;
      atom.add(ring);
      const points = [];
      for (let i = 0; i <= 100; i++) {
        const a = (i / 100) * Math.PI * 2;
        points.push(
          new THREE.Vector3(
            Math.cos(a) * 0.37,
            Math.sin(a) * 0.15,
            Math.sin(a) * 0.075,
          ),
        );
      }
      path(points, lineMaterial, ring);
      electrons.push({
        mesh: dot(ring, 0.032, pearl, [0.37, 0, 0]),
        offset: orbit * 2.1,
      });
    }
    const molecule = new THREE.Group();
    molecule.position.set(1.85, 0.53, -0.25);
    molecule.rotation.z = -0.15;
    group.add(molecule);
    dot(molecule, 0.135, pink, [0, 0, 0]);
    for (const side of [-1, 1]) {
      const end = new THREE.Vector3(side * 0.26, -0.2, 0.03);
      dot(molecule, 0.075, pearl, end.toArray());
      const stick = new THREE.Mesh(
        own(new THREE.CylinderGeometry(0.018, 0.018, end.length(), 10)),
        pearl,
      );
      stick.position.copy(end).multiplyScalar(0.5);
      stick.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.clone().normalize(),
      );
      molecule.add(stick);
    }
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.35;
      const extent = Math.sqrt(1.6 ** 2 - x ** 2);
      path(
        [
          new THREE.Vector3(x, -1.032, -extent),
          new THREE.Vector3(x, -1.032, extent),
        ],
        faint,
      );
    }
  }
  return {
    group,
    update(time) {
      electrons.forEach(({ mesh, offset }) => {
        const angle = time * 0.8 + offset;
        mesh.position.set(
          Math.cos(angle) * 0.37,
          Math.sin(angle) * 0.15,
          Math.sin(angle) * 0.075,
        );
      });
      shadow.scale.x = 1 + Math.cos(time * 8.8) * 0.025;
    },
  };
}
