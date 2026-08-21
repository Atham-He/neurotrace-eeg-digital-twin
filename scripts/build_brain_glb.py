#!/usr/bin/env python3
"""Build a web-ready anatomical brain glTF from BodyParts3D OBJ archives.

The generated mesh is derived from BodyParts3D and must retain its
CC BY-SA 2.1 Japan attribution when redistributed.
"""

from __future__ import annotations

import json
import math
import struct
import sys
import zipfile
from pathlib import Path


PARTOF_GROUPS = {
    "left_frontal": ["FJ1744", "FJ1787", "FJ1800", "FJ1833"],
    "right_frontal": ["FJ1745", "FJ1788", "FJ1801", "FJ1834"],
    "left_temporal": ["FJ1746", "FJ1783", "FJ1785", "FJ1789"],
    "right_temporal": ["FJ1747", "FJ1784", "FJ1786", "FJ1790"],
    "left_parietal": ["FJ1732", "FJ1797", "FJ1835", "FJ1841"],
    "right_parietal": ["FJ1733", "FJ1798", "FJ1836", "FJ1842"],
    "left_occipital": ["FJ1791"],
    "right_occipital": ["FJ1792"],
    "left_insula": ["FJ1748"],
    "right_insula": ["FJ1749"],
    "left_limbic": ["FJ1739", "FJ1759"],
    "right_limbic": ["FJ1740", "FJ1807"],
    "white_matter": ["FJ1750", "FJ1751", "FJ1758", "FJ1806"],
    "ventricles": ["FJ1730", "FJ1731", "FJ1767", "FJ1814"],
    "cerebellum": ["FJ1781", "FJ1830"],
    "brainstem": [
        "FJ1738", "FJ1762", "FJ1769", "FJ1770", "FJ1775", "FJ1779",
        "FJ1810", "FJ1817", "FJ1822", "FJ1826", "FJ1831",
    ],
    "hypothalamus": ["FJ1760", "FJ1780", "FJ1808", "FJ1828"],
    "pineal_habenula": ["FJ1743", "FJ1795"],
}

ISA_GROUPS = {
    "corpus_callosum": ["FJ1742"],
    "amygdala": ["FJ1753", "FJ1829"],
    "caudate": ["FJ1754", "FJ1802"],
    "globus_pallidus": ["FJ1757", "FJ1805"],
    "putamen": ["FJ1776", "FJ1823"],
    "thalamus": ["FJ1782", "FJ1827"],
}


def find_member(archive: zipfile.ZipFile, file_id: str) -> str:
    suffix = f"/{file_id}.obj"
    for name in archive.namelist():
        if name.endswith(suffix):
            return name
    raise KeyError(f"{file_id}.obj not found in {archive.filename}")


def read_obj(archive: zipfile.ZipFile, file_id: str):
    name = find_member(archive, file_id)
    vertices: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    source_name = file_id

    for raw in archive.read(name).decode("utf-8", "ignore").splitlines():
        if raw.startswith("# English name :"):
            source_name = raw.split(":", 1)[1].strip()
        elif raw.startswith("v "):
            _, x, y, z = raw.split()[:4]
            vertices.append((float(x), float(y), float(z)))
        elif raw.startswith("vn "):
            _, x, y, z = raw.split()[:4]
            normals.append((float(x), float(y), float(z)))
        elif raw.startswith("f "):
            refs = raw.split()[1:]
            polygon = [int(ref.split("/", 1)[0]) - 1 for ref in refs]
            for i in range(1, len(polygon) - 1):
                faces.append((polygon[0], polygon[i], polygon[i + 1]))

    if not normals or len(normals) != len(vertices):
        normals = [(0.0, 0.0, 1.0)] * len(vertices)
    return source_name, vertices, normals, faces


def pad4(blob: bytearray) -> None:
    while len(blob) % 4:
        blob.append(0)


def add_buffer_view(gltf: dict, blob: bytearray, payload: bytes, target: int) -> int:
    pad4(blob)
    offset = len(blob)
    blob.extend(payload)
    view_index = len(gltf["bufferViews"])
    gltf["bufferViews"].append(
        {"buffer": 0, "byteOffset": offset, "byteLength": len(payload), "target": target}
    )
    return view_index


def add_accessor(
    gltf: dict,
    view: int,
    component_type: int,
    count: int,
    value_type: str,
    minimum=None,
    maximum=None,
) -> int:
    accessor = {
        "bufferView": view,
        "componentType": component_type,
        "count": count,
        "type": value_type,
    }
    if minimum is not None:
        accessor["min"] = minimum
    if maximum is not None:
        accessor["max"] = maximum
    index = len(gltf["accessors"])
    gltf["accessors"].append(accessor)
    return index


def build(partof_zip: Path, isa_zip: Path, output: Path) -> None:
    groups = []
    all_vertices = []

    with zipfile.ZipFile(partof_zip) as partof, zipfile.ZipFile(isa_zip) as isa:
        for archive, mapping in ((partof, PARTOF_GROUPS), (isa, ISA_GROUPS)):
            for group_name, file_ids in mapping.items():
                group_vertices = []
                group_normals = []
                group_faces = []
                source_structures = []
                for file_id in file_ids:
                    source_name, vertices, normals, faces = read_obj(archive, file_id)
                    offset = len(group_vertices)
                    group_vertices.extend(vertices)
                    group_normals.extend(normals)
                    group_faces.extend((a + offset, b + offset, c + offset) for a, b, c in faces)
                    source_structures.append({"id": file_id, "name": source_name})
                groups.append(
                    {
                        "name": group_name,
                        "vertices": group_vertices,
                        "normals": group_normals,
                        "faces": group_faces,
                        "source_structures": source_structures,
                    }
                )
                all_vertices.extend(group_vertices)

    minimum = [min(v[i] for v in all_vertices) for i in range(3)]
    maximum = [max(v[i] for v in all_vertices) for i in range(3)]
    center = [(minimum[i] + maximum[i]) / 2 for i in range(3)]
    extent = max(maximum[i] - minimum[i] for i in range(3))
    scale = 4.8 / extent

    def transform(v):
        # BodyParts3D: X left/right, Y anterior/posterior, Z inferior/superior.
        return (
            (v[0] - center[0]) * scale,
            (v[2] - center[2]) * scale,
            (v[1] - center[1]) * scale,
        )

    def transform_normal(n):
        length = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1
        return (n[0] / length, n[2] / length, n[1] / length)

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "NeuroTrace BodyParts3D brain converter",
            "copyright": "BodyParts3D © The Database Center for Life Science, CC BY-SA 2.1 Japan",
        },
        "scene": 0,
        "scenes": [{"nodes": []}],
        "nodes": [],
        "meshes": [],
        "materials": [
            {
                "name": "anatomy_default",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.2, 0.8, 0.9, 0.45],
                    "metallicFactor": 0.05,
                    "roughnessFactor": 0.48,
                },
                "alphaMode": "BLEND",
                "doubleSided": True,
            }
        ],
        "buffers": [{"byteLength": 0}],
        "bufferViews": [],
        "accessors": [],
    }
    blob = bytearray()

    for group in groups:
        positions = [transform(v) for v in group["vertices"]]
        normals = [transform_normal(n) for n in group["normals"]]
        indices = [index for face in group["faces"] for index in face]
        pos_min = [min(v[i] for v in positions) for i in range(3)]
        pos_max = [max(v[i] for v in positions) for i in range(3)]

        pos_payload = struct.pack(f"<{len(positions) * 3}f", *(x for v in positions for x in v))
        normal_payload = struct.pack(f"<{len(normals) * 3}f", *(x for v in normals for x in v))
        index_payload = struct.pack(f"<{len(indices)}I", *indices)

        pos_view = add_buffer_view(gltf, blob, pos_payload, 34962)
        normal_view = add_buffer_view(gltf, blob, normal_payload, 34962)
        index_view = add_buffer_view(gltf, blob, index_payload, 34963)
        pos_accessor = add_accessor(
            gltf, pos_view, 5126, len(positions), "VEC3", pos_min, pos_max
        )
        normal_accessor = add_accessor(gltf, normal_view, 5126, len(normals), "VEC3")
        index_accessor = add_accessor(gltf, index_view, 5125, len(indices), "SCALAR")

        mesh_index = len(gltf["meshes"])
        gltf["meshes"].append(
            {
                "name": group["name"],
                "primitives": [
                    {
                        "attributes": {"POSITION": pos_accessor, "NORMAL": normal_accessor},
                        "indices": index_accessor,
                        "material": 0,
                    }
                ],
                "extras": {"sourceStructures": group["source_structures"]},
            }
        )
        node_index = len(gltf["nodes"])
        gltf["nodes"].append({"name": group["name"], "mesh": mesh_index})
        gltf["scenes"][0]["nodes"].append(node_index)

    pad4(blob)
    gltf["buffers"][0]["byteLength"] = len(blob)

    json_payload = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_payload) % 4:
        json_payload += b" "
    total_length = 12 + 8 + len(json_payload) + 8 + len(blob)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as target:
        target.write(struct.pack("<4sII", b"glTF", 2, total_length))
        target.write(struct.pack("<I4s", len(json_payload), b"JSON"))
        target.write(json_payload)
        target.write(struct.pack("<I4s", len(blob), b"BIN\0"))
        target.write(blob)

    print(f"Wrote {output} ({output.stat().st_size / 1024 / 1024:.2f} MB, {len(groups)} structures)")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: build_brain_glb.py PARTOF_ZIP ISA_ZIP OUTPUT.glb")
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
