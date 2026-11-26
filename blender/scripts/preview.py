"""Render a quick preview image of one or more exported .glb assets.

usage: blender -b --factory-startup -P blender/scripts/preview.py -- <out.png> <asset.glb> [more.glb ...]

Assets are laid out side by side, framed from a front three-quarter view
(assets face -Y), and rendered with Cycles on the CPU so it works on machines
without a GPU. Collision-only objects are hidden.
"""

import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
out_path, assets = argv[0], argv[1:]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

cursor_x = 0.0
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for path in assets:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        if "colonly" in o.name:
            o.hide_render = True
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes if not o.hide_render for c in o.bound_box]
    xmin = min(p.x for p in pts)
    xmax = max(p.x for p in pts)
    for r in roots:
        r.location.x += cursor_x - xmin
    bpy.context.view_layer.update()
    for o in meshes:
        if o.hide_render:
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    cursor_x += (xmax - xmin) * 1.15 + 0.5

center = (lo + hi) / 2
size = max((hi - lo).length, 1.0)

cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 50
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
direction = Vector((0.55, -1.0, 0.45)).normalized()     # front-right, slightly above
cam.location = center + direction * size * 1.25
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

sun_data = bpy.data.lights.new("sun", type="SUN")
sun_data.energy = 3.5
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new("sun", sun_data)
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
scene.collection.objects.link(sun)

world = bpy.data.worlds.new("world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.62, 0.68, 0.76, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
scene.world = world

bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(center.x, center.y, lo.z - 0.01))
ground = bpy.context.active_object
gmat = bpy.data.materials.new("ground")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.34, 0.22, 1)
ground.data.materials.append(gmat)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.view_settings.view_transform = "Standard"
scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
print(f"[redclay] preview written to {out_path}")
