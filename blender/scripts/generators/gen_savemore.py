"""Generate the SaveMore Supercenter big-box store (BLD_SaveMore).

usage: blender -b --factory-startup --python-exit-code 1 -P gen_savemore.py -- --out <dir>

Street-facing building: origin at the bottom center of the front facade, which
faces -Y; the store extends toward +Y. Signage is real text converted to mesh.
"""

import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import (  # noqa: E402
    MeshBuilder, collider_box, export_glb, material, mesh_bounds, parse_args, reset_scene, text_mesh,
)
from redclay.validate import validate_scene  # noqa: E402

NAME = "BLD_SaveMore"
HW, D, H = 70.0, 70.0, 11.0


def facade_text(b, mat, body, size, center_x, base_z, front_y, extrude=0.2):
    """Text standing on the facade, facing -Y, centered on center_x, bottom at base_z."""
    mesh = text_mesh(body, size, extrude)
    _, _, y0, _ = mesh_bounds(mesh)
    # Text lies in XY facing +Z; rotate +90° about X so it faces -Y and stands up.
    b.add_mesh(mesh, mat, lambda v: Vector((center_x + v.x, front_y - extrude - v.z, base_z + v.y - y0)))


def main():
    args = parse_args()
    reset_scene()
    stucco = material("MAT_Stucco_Warm", "#d9d4ca", roughness=0.9)
    block = material("MAT_Splitface_Block", "#a29b8f", roughness=0.95)
    teal = material("MAT_SaveMore_Teal", "#12736c", roughness=0.6)
    white = material("MAT_Sign_White", "#f7f7f2", roughness=0.4, emission="#ffffff", emission_strength=0.6)
    orange = material("MAT_SaveMore_Orange", "#f08a24", roughness=0.5, emission="#f08a24", emission_strength=0.4)
    glass = material("MAT_Glass_Dark", "#1c2a33", roughness=0.08, metallic=0.4)
    roof = material("MAT_Roof_Membrane", "#c9c9c4", roughness=0.9)
    metal = material("MAT_Metal_Gray", "#9aa0a3", roughness=0.5, metallic=0.6)
    dark = material("MAT_Dock_Door", "#3a3d40", roughness=0.7)

    b = MeshBuilder()
    # Main box: stucco over a split-face block base, flat roof with AC units.
    b.box(-HW, HW, 0.0, D, 0.0, H, stucco)
    b.box(-HW - 0.1, HW + 0.1, -0.1, D + 0.1, 0.0, 1.2, block)
    b.box(-HW - 0.2, HW + 0.2, -0.2, D + 0.2, H - 0.6, H, teal)            # teal cap band
    b.box(-HW + 0.2, HW - 0.2, 0.2, D - 0.2, H, H + 0.05, roof)
    for i in range(10):
        x = -55 + i * 12.0
        b.box(x - 1.5, x + 1.5, 20 + (i % 3) * 14, 22.5 + (i % 3) * 14, H + 0.05, H + 1.6, metal)

    # Center sign tower: raised teal parapet with the SaveMore logotype and price tag.
    b.box(-24.0, 24.0, -0.4, 2.5, H, H + 6.0, teal)
    b.box(-24.3, 24.3, -0.6, 2.7, H + 6.0, H + 6.4, stucco)
    facade_text(b, white, "SaveMore", 3.6, 3.0, H + 1.4, -0.45)
    facade_text(b, white, "SUPERCENTER", 1.0, 3.0, H - 1.9, -0.25, extrude=0.08)
    # Price-tag icon left of the logotype: an orange diamond with a dark hole.
    cx, cz, r, y = -15.0, H + 3.3, 2.2, -0.45
    diamond = [(cx, y, cz - r), (cx + r, y, cz), (cx, y, cz + r), (cx - r, y, cz)]
    b.hexa([(px, y - 0.25, pz) for px, _, pz in diamond], diamond, orange)
    hole_bottom = [(cx + 0.35 * math.cos(a), y - 0.27, cz + r * 0.5 + 0.35 * math.sin(a)) for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2)]
    b.hexa(hole_bottom, [(px, y - 0.3, pz) for px, _, pz in hole_bottom], dark)

    # Entrance vestibules: main (center) and grocery (east).
    for x0, x1, label in ((-11.0, 11.0, None), (36.0, 52.0, "GROCERY")):
        b.box(x0, x1, -7.0, 0.0, 0.0, 7.0, stucco)
        b.box(x0 + 1.0, x1 - 1.0, -7.05, -6.9, 0.0, 4.2, glass)
        b.box(x0 - 0.3, x1 + 0.3, -7.4, 0.0, 5.6, 7.0, teal)                 # canopy band
        b.box(x0 + 0.5, x1 - 0.5, -0.05, 0.05, 0.0, 4.4, glass)
        if label:
            facade_text(b, white, label, 1.2, (x0 + x1) / 2, 5.75, -7.45, extrude=0.06)

    # Long ribbon of high storefront glass between the entrances.
    for x0, x1 in ((-50.0, -13.0), (13.0, 34.0)):
        b.box(x0, x1, -0.05, 0.02, 1.2, 3.6, glass)

    # Garden center: fenced yard on the west side.
    gx0, gx1, gy0, gy1 = -HW - 22.0, -HW, 6.0, 46.0
    b.box(gx0, gx1, gy0, gy0 + 0.3, 0.0, 1.0, block)
    b.box(gx0, gx0 + 0.3, gy0, gy1, 0.0, 1.0, block)
    b.box(gx0, gx1, gy1 - 0.3, gy1, 0.0, 1.0, block)
    for i in range(12):
        x = gx0 + i * 2.0
        b.vcyl(x, gy0 + 0.15, 1.0, 3.6, 0.06, metal, segments=4)
    for i in range(21):
        y = gy0 + i * 2.0
        b.vcyl(gx0 + 0.15, y, 1.0, 3.6, 0.06, metal, segments=4)
    b.box(gx0, gx1, gy0 + 0.1, gy0 + 0.2, 3.5, 3.65, metal)
    b.box(gx0 + 0.1, gx0 + 0.2, gy0, gy1, 3.5, 3.65, metal)

    # Loading docks on the back wall.
    for i in range(6):
        x = -30 + i * 8.0
        b.box(x - 1.6, x + 1.6, D - 0.05, D + 0.05, 0.6, 4.2, dark)
    b.to_object(NAME)["landmark"] = True

    collider_box(f"{NAME}_Store-colonly", -HW - 0.1, HW + 0.1, -0.1, D + 0.1, 0.0, H + 6.0)
    collider_box(f"{NAME}_Entry-colonly", -11.0, 11.0, -7.0, 0.0, 0.0, 7.0)
    collider_box(f"{NAME}_Grocery-colonly", 36.0, 52.0, -7.0, 0.0, 0.0, 7.0)
    collider_box(f"{NAME}_GardenS-colonly", gx0, gx1, gy0, gy0 + 0.3, 0.0, 3.6)
    collider_box(f"{NAME}_GardenW-colonly", gx0, gx0 + 0.3, gy0, gy1, 0.0, 3.6)
    collider_box(f"{NAME}_GardenN-colonly", gx0, gx1, gy1 - 0.3, gy1, 0.0, 3.6)

    validate_scene(kind="building")
    export_glb(os.path.join(args["out"], "buildings", f"{NAME}.glb"))


main()
