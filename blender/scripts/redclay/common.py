"""Shared helpers for RED CLAY asset generators (Blender 4.0 API).

Conventions (see docs/06-blender-pipeline.md):
- 1 unit = 1 meter, Z up, models face -Y (front view shows the front).
- Collision-only objects end in "-colonly" and carry a "collider" custom property.
"""

import os
import sys

import bmesh
import bpy


def parse_args():
    """Return {"out": <dir>} from arguments after '--' on the Blender command line."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = {"out": None}
    i = 0
    while i < len(argv):
        if argv[i] == "--out" and i + 1 < len(argv):
            args["out"] = argv[i + 1]
            i += 2
        else:
            i += 1
    if not args["out"]:
        raise SystemExit("usage: blender -b -P <generator.py> -- --out <dir>")
    return args


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def hex_to_linear(hex_color):
    """'#rrggbb' (sRGB) -> linear RGB tuple, which is what Blender and glTF store."""
    h = hex_color.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def material(name, color, roughness=0.85, metallic=0.0, emission=None, emission_strength=1.0):
    """Get or create a Principled BSDF material. Colors are sRGB hex strings."""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_to_linear(color), 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*hex_to_linear(emission), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


class MeshBuilder:
    """Accumulates boxes into one bmesh with per-face material indices.

    One object with a few materials renders far cheaper than dozens of objects.
    """

    def __init__(self):
        self.bm = bmesh.new()
        self.materials = []

    def _mat_index(self, mat):
        if mat not in self.materials:
            self.materials.append(mat)
        return self.materials.index(mat)

    def box(self, x0, x1, y0, y1, z0, z1, mat):
        """Axis-aligned box from min/max corners."""
        self.hexa(
            [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],
            [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
            mat,
        )

    def hexa(self, bottom, top, mat):
        """Six-sided solid from 4 bottom and 4 top corners (counter-clockwise from above)."""
        bm = self.bm
        vb = [bm.verts.new(p) for p in bottom]
        vt = [bm.verts.new(p) for p in top]
        idx = self._mat_index(mat)
        faces = [
            (vb[3], vb[2], vb[1], vb[0]),  # bottom
            (vt[0], vt[1], vt[2], vt[3]),  # top
        ]
        for i in range(4):
            j = (i + 1) % 4
            faces.append((vb[i], vb[j], vt[j], vt[i]))
        for f in faces:
            face = bm.faces.new(f)
            face.material_index = idx

    def to_object(self, name):
        mesh = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def collider_box(name, x0, x1, y0, y1, z0, z1):
    """Invisible box collider: name must end in '-colonly'."""
    assert name.endswith("-colonly"), name
    b = MeshBuilder()
    b.box(x0, x1, y0, y1, z0, z1, material("MAT_Collider", "#ff00ff"))
    obj = b.to_object(name)
    obj["collider"] = "box"
    return obj


def triangle_count(obj):
    if obj.type != "MESH":
        return 0
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def export_glb(path):
    """Export the whole scene to .glb, with custom properties as glTF extras."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_extras=True,
        export_yup=True,
        export_apply=True,
        use_selection=False,
    )
    print(f"[redclay] exported {path}")
