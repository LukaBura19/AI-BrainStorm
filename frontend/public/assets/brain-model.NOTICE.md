# BrainStorm 3D brain asset

`brain-model.glb` contains exterior geometry derived from the CC0-1.0 OpenNeuro dataset ds006128, snapshot 1.0.11, subject sub-01.

- Dataset: https://github.com/OpenNeuroDatasets/ds006128
- Snapshot DOI: https://doi.org/10.18112/openneuro.ds006128.v1.0.11
- CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/
- Atlas source: https://github.com/StarKnightt/brain-explorer/blob/master/public/models/brain-atlas.glb
- Atlas provenance: https://github.com/StarKnightt/brain-explorer/blob/master/public/models/brain-atlas.provenance.json
- Source notice: https://github.com/StarKnightt/brain-explorer/blob/master/THIRD_PARTY_NOTICES.md
- Verified original GLB SHA-256: ce761741d866e32d7a5b7638f4cacd5ec03e2b582e72c8218aba483ac28125e8

BrainStorm changes: retain the unified cortex, cerebellum and brain stem; remove duplicate regions, internal structures, invisible selection proxies and unused attributes. Simplify the exterior to 74,984 triangles using gltfpack 1.2.0 (35% of the original exterior triangle count), preserving named meshes and smooth normals. The unused curvature attribute is omitted in the final asset. Assign BrainStorm visual materials and lighting at runtime. Final size: 1,351,520 bytes.

Final GLB SHA-256: `a1c7aca6f5a6d1bb5e0e5faa915241ce5a4b2e7ac0003955aaa57a0513d34228`.

Reproduce from the verified source GLB:

```sh
python3 frontend/tools/prepare-brain-model.py brain-atlas.glb /tmp/brain-exterior.glb
npx --yes --package gltfpack@1.2.0 gltfpack -i /tmp/brain-exterior.glb -o frontend/public/assets/brain-model.glb -si 0.35 -noq -kn
```

The first step preserves the original exterior geometry. The second step simplifies it and optimizes vertex/index order for rendering. No runtime compression decoder is required. Optimizer: https://github.com/zeux/meshoptimizer/tree/master/gltf.

Only the anatomical data asset is reused; no source code from the atlas application is included.
