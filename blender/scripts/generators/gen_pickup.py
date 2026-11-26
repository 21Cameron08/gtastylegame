"""Generate the blockout work pickup (VEH_Pickup_Work).

usage: blender -b --factory-startup --python-exit-code 1 -P gen_pickup.py -- --out <dir>

Origin: ground level, centered between the axles. Front faces -Y, so the
vehicle's left side is +X. Wheels are separate objects (WHEEL_FL/FR/RL/RR)
with origins at their hub centers; the game measures them for the physics.
Paint uses MAT_Paint so the game can recolor each car.
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import (  # noqa: E402
    MeshBuilder, collider_box, export_glb, material, parse_args, reset_scene,
)
from redclay.validate import validate_scene  # noqa: E402

NAME = "VEH_Pickup_Work"
HALF_W = 1.0          # body half width
FRONT_Y, REAR_Y = -2.7, 2.7
AXLE_F, AXLE_R = -1.65, 1.65
WHEEL_R = 0.40
WHEEL_W = 0.28
TRACK_HALF = 0.84     # wheel center x
BODY_Z = 0.55         # bottom of the body panels
WELL_Z = 0.86         # top of the wheel wells
WELL_HALF = 0.5       # half length of each wheel well
BELT_Z = 1.2          # beltline (top of doors, hood, bed sides)
ROOF_Z = 1.86


def body():
    paint = material("MAT_Paint", "#c9c2b0", roughness=0.45, metallic=0.2)
    trim = material("MAT_Trim_Black", "#1b1b1b", roughness=0.8)
    chrome = material("MAT_Chrome", "#c8c8c8", roughness=0.2, metallic=1.0)
    glass = material("MAT_Glass_Car", "#16212a", roughness=0.05, metallic=0.5)
    head = material("MAT_Light_Head", "#fff4d6", emission="#fff4d6", emission_strength=2.0)
    tail = material("MAT_Light_Tail", "#8a0f0f", emission="#ff2a1a", emission_strength=1.5)

    b = MeshBuilder()
    w = HALF_W
    fw0, fw1 = AXLE_F - WELL_HALF, AXLE_F + WELL_HALF
    rw0, rw1 = AXLE_R - WELL_HALF, AXLE_R + WELL_HALF
    cab_front, cab_back = -1.05, 0.55
    bed_front = 0.62
    hood_z = 1.15

    # Lower body, split around the wheel wells.
    b.box(-w, w, FRONT_Y, fw0, BODY_Z, hood_z, paint)            # front overhang
    b.box(-w, w, fw0, fw1, WELL_Z, hood_z, paint)                # over front wheels
    b.box(-w, w, fw1, cab_front, BODY_Z, hood_z, paint)          # hood rear section
    b.box(-w, w, cab_front, cab_back, BODY_Z, BELT_Z, paint)     # cab doors
    b.box(-w, w, cab_back, bed_front, BODY_Z, BELT_Z, trim)      # cab/bed gap
    b.box(-w, w, bed_front, rw0, BODY_Z, 0.75, paint)            # bed floor, front
    b.box(-w, w, rw0, rw1, WELL_Z, 0.9, paint)                   # bed floor over rear wheels
    b.box(-w, w, rw1, REAR_Y, BODY_Z, 0.75, paint)               # bed floor, rear
    b.box(-w, -w + 0.08, bed_front, REAR_Y, 0.75, BELT_Z, paint)  # bed sides
    b.box(w - 0.08, w, bed_front, REAR_Y, 0.75, BELT_Z, paint)
    b.box(-w, w, bed_front, bed_front + 0.08, 0.75, BELT_Z, paint)   # bed front wall
    b.box(-w, w, REAR_Y - 0.08, REAR_Y, 0.75, BELT_Z, paint)         # tailgate

    # Cab greenhouse with a raked windshield, roof, and B-pillar.
    b.hexa(
        [(-0.93, cab_front, BELT_Z), (0.93, cab_front, BELT_Z), (0.93, cab_back, BELT_Z), (-0.93, cab_back, BELT_Z)],
        [(-0.88, -0.62, ROOF_Z - 0.06), (0.88, -0.62, ROOF_Z - 0.06), (0.88, cab_back - 0.05, ROOF_Z - 0.06), (-0.88, cab_back - 0.05, ROOF_Z - 0.06)],
        glass,
    )
    b.box(-0.9, 0.9, -0.64, cab_back - 0.03, ROOF_Z - 0.06, ROOF_Z, paint)
    b.box(-0.945, 0.945, -0.12, 0.0, BELT_Z, ROOF_Z - 0.06, paint)

    # Front end: grille, headlights, bumper. Rear: taillights, bumper.
    b.box(-0.72, 0.72, FRONT_Y - 0.03, FRONT_Y, 0.72, 1.06, chrome)
    b.box(-0.68, 0.68, FRONT_Y - 0.04, FRONT_Y - 0.02, 0.76, 1.02, trim)
    for (x0, x1) in ((-0.95, -0.74), (0.74, 0.95)):
        b.box(x0, x1, FRONT_Y - 0.03, FRONT_Y, 0.84, 1.02, head)        # headlights
    for (x0, x1) in ((-0.98, -0.84), (0.84, 0.98)):
        b.box(x0, x1, REAR_Y, REAR_Y + 0.02, 0.88, 1.15, tail)          # taillights
    for (x0, x1) in ((-1.07, -0.95), (0.95, 1.07)):
        b.box(x0, x1, -0.95, -0.8, 1.25, 1.42, trim)                    # mirrors
    b.box(-1.02, 1.02, FRONT_Y - 0.12, FRONT_Y + 0.05, 0.45, 0.72, chrome)
    b.box(-1.0, 1.0, REAR_Y - 0.05, REAR_Y + 0.1, 0.45, 0.66, chrome)

    b.to_object(f"{NAME}_Body")


def wheel(name, x, y):
    tire = material("MAT_Tire", "#202020", roughness=0.95)
    rim = material("MAT_Rim", "#8d8f91", roughness=0.35, metallic=0.8)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18, radius=WHEEL_R, depth=WHEEL_W, location=(x, y, WHEEL_R), rotation=(0.0, math.pi / 2, 0.0)
    )
    t = bpy.context.active_object
    t.data.materials.append(tire)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=WHEEL_R * 0.6, depth=WHEEL_W + 0.02, location=(x, y, WHEEL_R), rotation=(0.0, math.pi / 2, 0.0)
    )
    r = bpy.context.active_object
    r.data.materials.append(rim)
    bpy.ops.object.select_all(action="DESELECT")
    t.select_set(True)
    r.select_set(True)
    bpy.context.view_layer.objects.active = t
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    t.name = name
    t.data.name = name
    return t


def main():
    args = parse_args()
    reset_scene()
    body()
    # Front is -Y, so the left side is +X.
    wheel("WHEEL_FL", TRACK_HALF, AXLE_F)
    wheel("WHEEL_FR", -TRACK_HALF, AXLE_F)
    wheel("WHEEL_RL", TRACK_HALF, AXLE_R)
    wheel("WHEEL_RR", -TRACK_HALF, AXLE_R)
    collider_box(f"{NAME}_Hull-colonly", -HALF_W, HALF_W, FRONT_Y - 0.1, REAR_Y + 0.1, BODY_Z - 0.05, ROOF_Z)
    validate_scene(kind="vehicle")
    export_glb(os.path.join(args["out"], "vehicles", f"{NAME}.glb"))


main()
