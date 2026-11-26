"""Generate the Cane Creek water tower (a landmark) and a wooden power pole.

usage: blender -b --factory-startup --python-exit-code 1 -P gen_props.py -- --out <dir>

Origins at the base. The tower's lettering faces -Y (its front). The power
pole's crossarm runs along X, so wires run along Y; WIRE_0..2 empties mark
where the game hangs the lines.
"""

import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import (  # noqa: E402
    MeshBuilder, collider_box, empty, export_glb, material, mesh_bounds, parse_args, reset_scene, text_mesh,
)
from redclay.validate import validate_scene  # noqa: E402

TANK_R = 7.0
LEG_TOP = 26.0


def water_tower():
    name = "BLD_WaterTower"  # a landmark, so the building/landmark budget applies
    paint = material("MAT_Tower_Paint", "#d9dcde", roughness=0.5, metallic=0.3)
    steel = material("MAT_Tower_Steel", "#a5abb0", roughness=0.55, metallic=0.5)
    letters = material("MAT_Tower_Letters", "#7a1f1a", roughness=0.6)

    b = MeshBuilder()
    leg_r = 5.0
    legs = [(math.cos(a) * leg_r, math.sin(a) * leg_r) for a in (math.pi / 4 + i * math.pi / 2 for i in range(4))]
    for x, y in legs:
        # Legs lean inward slightly toward the tank.
        top = Vector((x * 0.82, y * 0.82, LEG_TOP))
        bottom = Vector((x, y, 0.0))
        d = top - bottom
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        b.cylinder(0.38, 0.34, d.length, paint, segments=8, matrix=Matrix.Translation(bottom) @ rot)
        b.vcyl(x, y, 0.0, 0.6, 0.7, steel, segments=8)                          # footing
    for z in (8.0, 17.0):                                                      # cross bracing rings
        k = 1.0 - 0.18 * z / LEG_TOP
        pts = [Vector((x * k, y * k, z)) for x, y in legs]
        for i in range(4):
            a, c = pts[i], pts[(i + 1) % 4]
            d = c - a
            rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
            b.cylinder(0.12, 0.12, d.length, steel, segments=6, matrix=Matrix.Translation(a) @ rot)
    b.vcyl(0, 0, 0.0, LEG_TOP, 0.6, steel, segments=10)                        # riser pipe
    b.vcyl(0, 0, LEG_TOP - 0.6, LEG_TOP, TANK_R * 0.9, paint, r1=TANK_R, segments=32)  # tank bottom
    b.vcyl(0, 0, LEG_TOP, LEG_TOP + 8.0, TANK_R, paint, segments=32)           # tank
    b.vcyl(0, 0, LEG_TOP + 8.0, LEG_TOP + 10.5, TANK_R, paint, r1=0.4, segments=32)  # roof
    b.vcyl(0, 0, LEG_TOP - 0.2, LEG_TOP + 0.1, TANK_R + 0.9, steel, segments=32)  # catwalk
    for i in range(16):
        a = 2 * math.pi * i / 16
        b.vcyl(math.cos(a) * (TANK_R + 0.85), math.sin(a) * (TANK_R + 0.85), LEG_TOP + 0.1, LEG_TOP + 1.2, 0.04, steel, segments=4)
    b.vcyl(0, 0, LEG_TOP + 1.1, LEG_TOP + 1.2, TANK_R + 0.9, steel, segments=32)

    # "CANE CREEK" wrapped around the tank: text x -> angle, text y -> height, extrusion -> radius.
    txt = text_mesh("CANE CREEK", 1.9, 0.08)
    x0, x1, y0, y1 = mesh_bounds(txt)
    zc = LEG_TOP + 4.0 - (y1 - y0) / 2
    surface = TANK_R + 0.02

    def wrap(v):
        theta = v.x / TANK_R
        r = surface + v.z + 0.08
        return Vector((r * math.sin(theta), -r * math.cos(theta), zc + v.y - y0))

    b.add_mesh(txt, letters, wrap)
    b.to_object(name)["landmark"] = True

    for i, (x, y) in enumerate(legs):
        collider_box(f"{name}_Leg{i}-colonly", x - 0.45, x + 0.45, y - 0.45, y + 0.45, 0.0, LEG_TOP * 0.6, shape="capsule")
    collider_box(f"{name}_Tank-colonly", -TANK_R, TANK_R, -TANK_R, TANK_R, LEG_TOP - 0.6, LEG_TOP + 10.0)

    validate_scene()
    export_glb(os.path.join(ARGS["out"], "buildings", f"{name}.glb"))


def power_pole():
    name = "PRP_PowerPole"
    wood = material("MAT_Wood_Pole", "#6b5440", roughness=0.95)
    glass = material("MAT_Insulator", "#5d7f8f", roughness=0.2, metallic=0.1)
    steel = material("MAT_Transformer", "#8f979b", roughness=0.5, metallic=0.6)

    b = MeshBuilder()
    h = 10.5
    b.vcyl(0, 0, 0, h, 0.16, wood, r1=0.12, segments=8)
    arm_z = h - 0.8
    b.box(-1.25, 1.25, -0.06, 0.06, arm_z, arm_z + 0.12, wood)                 # crossarm
    b.box(-0.04, 0.04, -0.05, 0.05, arm_z - 0.8, arm_z, wood)                  # brace
    wires = []
    for x in (-1.1, 0.0, 1.1):
        z = arm_z + 0.12 if x != 0.0 else h
        if x == 0.0:
            b.vcyl(0, 0, h, h + 0.25, 0.05, glass, segments=6)
            wires.append((0.0, 0.0, h + 0.25))
        else:
            b.vcyl(x, 0, z, z + 0.25, 0.05, glass, segments=6)
            wires.append((x, 0.0, z + 0.25))
    b.vcyl(0.0, 0.32, h - 2.6, h - 1.6, 0.25, steel, segments=10)              # transformer can
    b.to_object(name)
    for i, p in enumerate(wires):
        empty(f"WIRE_{i}", p)
    collider_box(f"{name}-colonly", -0.18, 0.18, -0.18, 0.18, 0.0, h, shape="capsule")

    validate_scene()
    export_glb(os.path.join(ARGS["out"], "props", f"{name}.glb"))


ARGS = parse_args()
for build in (water_tower, power_pole):
    reset_scene()
    build()
