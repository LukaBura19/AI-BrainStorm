"""Strip a provenance-verified CC0 brain atlas to the visible exterior.

Usage: python3 frontend/tools/prepare-brain-model.py SOURCE.glb DESTINATION.glb
Source and licence: frontend/public/assets/brain-model.NOTICE.md.
Uses only the Python standard library. Keeps original geometry and normals.
This is the exterior extraction step; the NOTICE records the final gltfpack
simplification command used to produce the shipped model.
"""
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys

EXPECTED_SHA = 'ce761741d866e32d7a5b7638f4cacd5ec03e2b582e72c8218aba483ac28125e8'
VISIBLE = {'unified-cortex', 'cerebellum', 'brain-stem'}
source, destination = map(Path, sys.argv[1:3])
raw = source.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECTED_SHA, 'Unexpected source atlas version'
assert raw[:4] == b'glTF'
json_length = struct.unpack_from('<I', raw, 12)[0]
original = json.loads(raw[20:20 + json_length])
binary_start = 20 + json_length + 8
binary = raw[binary_start:]
result = {
    'asset': {'version': '2.0', 'generator': 'BrainStorm exterior-only atlas packaging',
              'copyright': 'OpenNeuro ds006128 1.0.11, CC0-1.0; atlas packaging by StarKnightt/brain-explorer'},
    'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [],
    'accessors': [], 'bufferViews': [], 'buffers': [],
}
output = bytearray()
accessor_map = {}
component_size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
item_size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def accessor(old_index):
    if old_index in accessor_map:
        return accessor_map[old_index]
    old = original['accessors'][old_index]
    view = original['bufferViews'][old['bufferView']]
    start = view.get('byteOffset', 0) + old.get('byteOffset', 0)
    size = component_size[old['componentType']] * item_size[old['type']]
    stride = view.get('byteStride', size)
    data = binary[start:start + old['count'] * size] if stride == size else b''.join(
        binary[start + i * stride:start + i * stride + size] for i in range(old['count']))
    while len(output) % 4:
        output.append(0)
    new_view = {'buffer': 0, 'byteOffset': len(output), 'byteLength': len(data)}
    if 'target' in view:
        new_view['target'] = view['target']
    output.extend(data)
    new = copy.deepcopy(old)
    new['bufferView'] = len(result['bufferViews'])
    new.pop('byteOffset', None)
    result['bufferViews'].append(new_view)
    index = len(result['accessors'])
    result['accessors'].append(new)
    accessor_map[old_index] = index
    return index

for node in original['nodes']:
    if node['name'] not in VISIBLE:
        continue
    old_mesh = original['meshes'][node['mesh']]
    mesh = {'name': node['name'], 'primitives': []}
    for old in old_mesh['primitives']:
        mesh['primitives'].append({
            'attributes': {key: accessor(value) for key, value in old['attributes'].items()
                           if key in {'POSITION', 'NORMAL', '_CURVATURE'}},
            'indices': accessor(old['indices']), 'mode': 4,
        })
    result['scenes'][0]['nodes'].append(len(result['nodes']))
    result['nodes'].append({'name': node['name'], 'mesh': len(result['meshes'])})
    result['meshes'].append(mesh)
while len(output) % 4:
    output.append(0)
result['buffers'] = [{'byteLength': len(output)}]
encoded = json.dumps(result, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(encoded) + 8 + len(output))
glb += struct.pack('<I4s', len(encoded), b'JSON') + encoded
glb += struct.pack('<I4s', len(output), b'BIN\0') + output
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(glb)
triangles = sum(result['accessors'][p['indices']]['count'] // 3 for m in result['meshes'] for p in m['primitives'])
print(f'{len(raw):,} → {len(glb):,} bytes; {len(result["meshes"])} exterior meshes; {triangles:,} original triangles')
print('sha256:', hashlib.sha256(glb).hexdigest())
