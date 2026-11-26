"""Shared helpers for RED CLAY asset generators (Blender 4.0 API).

Conventions (see docs/06-blender-pipeline.md):
- 1 unit = 1 meter, Z up, models face -Y (front view shows the front).
- Collision-only objects end in "-colonly" and carry a "collider" custom property.
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector


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

    def cylinder(self, r0, r1, length, mat, segments=12, matrix=None, cap=True):
        """Cylinder or cone along local +Z from 0 to `length`, then moved by `matrix`."""
        m = matrix or Matrix()
        bm = self.bm
        idx = self._mat_index(mat)
        rings = []
        for z, r in ((0.0, r0), (length, r1)):
            ring = []
            for i in range(segments):
                a = 2 * math.pi * i / segments
                ring.append(bm.verts.new(m @ Vector((r * math.cos(a), r * math.sin(a), z))))
            rings.append(ring)
        b, t = rings
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((b[i], b[j], t[j], t[i])).material_index = idx
        if cap:
            bm.faces.new(list(reversed(b))).material_index = idx
            if r1 > 1e-4:
                bm.faces.new(t).material_index = idx

    def vcyl(self, x, y, z0, z1, r0, mat, r1=None, segments=12):
        """Vertical cylinder (or tapered) standing at (x, y) from z0 to z1."""
        self.cylinder(r0, r0 if r1 is None else r1, z1 - z0, mat, segments, Matrix.Translation((x, y, z0)))

    def blob(self, center, radius, mat, scale=(1, 1, 1), jitter=0.12, seed=0, subdivisions=1):
        """Lumpy icosphere for foliage clumps; deterministic for a given seed."""
        rng = random.Random(seed)
        m = Matrix.Translation(center) @ Matrix.Diagonal((*scale, 1.0)) @ Matrix.Scale(radius, 4)
        ret = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=1.0, matrix=m)
        verts = ret["verts"]
        c = Vector(center)
        for v in verts:
            v.co = c + (v.co - c) * (1.0 + rng.uniform(-jitter, jitter))
        idx = self._mat_index(mat)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = idx

    def add_mesh(self, mesh, mat, fn):
        """Append another mesh datablock, mapping every vertex through fn(Vector) -> Vector."""
        tmp = bmesh.new()
        tmp.from_mesh(mesh)
        for v in tmp.verts:
            v.co = fn(v.co.copy())
        tmp_mesh = bpy.data.meshes.new("_tmp")
        tmp.to_mesh(tmp_mesh)
        tmp.free()
        first = len(self.bm.faces)
        self.bm.from_mesh(tmp_mesh)
        self.bm.faces.ensure_lookup_table()
        idx = self._mat_index(mat)
        for i in range(first, len(self.bm.faces)):
            self.bm.faces[i].material_index = idx
        bpy.data.meshes.remove(tmp_mesh)

    def to_object(self, name, origin=None, parent=None):
        """Create the object. With `origin`, the object's origin sits there (e.g. a joint)."""
        if origin is not None:
            bmesh.ops.translate(self.bm, verts=self.bm.verts, vec=-Vector(origin))
        mesh = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if origin is not None:
            obj.location = origin
        if parent is not None:
            attach(obj, parent)
        return obj


def empty(name, location, parent=None):
    """Empty object, used for joints (JOINT_*) and attachment markers (WIRE_*, SPAWN_*)."""
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    if parent is not None:
        attach(obj, parent)
    return obj


def attach(child, parent):
    """Parent `child` to `parent`, keeping the child's world position (no rotation/scale involved)."""
    world = Vector(child.location)
    child.parent = parent
    child.matrix_parent_inverse = Matrix()
    child.location = world - world_location(parent)


def world_location(obj):
    loc = Vector(obj.location)
    p = obj.parent
    while p is not None:
        loc += Vector(p.location)
        p = p.parent
    return loc


def text_mesh(body, size, extrude, align_x="CENTER", resolution=3):
    """Convert text in Blender's built-in font to a mesh datablock lying in the XY plane, facing +Z.

    `resolution` is curve segments per letter outline span; low keeps triangle counts down.
    """
    curve = bpy.data.curves.new("_txt", type="FONT")
    curve.resolution_u = resolution
    curve.body = body
    curve.size = size
    curve.extrude = extrude
    curve.align_x = align_x
    curve.align_y = "BOTTOM_BASELINE"
    obj = bpy.data.objects.new("_txt", curve)
    bpy.context.scene.collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    return mesh


def mesh_bounds(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    return min(xs), max(xs), min(ys), max(ys)


def collider_box(name, x0, x1, y0, y1, z0, z1, shape="box"):
    """Invisible collider sized by a box: name must end in '-colonly'.

    shape="capsule" or "sphere" makes the game fit that shape to the box.
    """
    assert name.endswith("-colonly"), name
    b = MeshBuilder()
    b.box(x0, x1, y0, y1, z0, z1, material("MAT_Collider", "#ff00ff"))
    obj = b.to_object(name)
    obj["collider"] = shape
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
