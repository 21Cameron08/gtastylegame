"""Generate the Bascom County Courthouse (BLD_Courthouse).

usage: blender -b --factory-startup --python-exit-code 1 -P gen_courthouse.py -- --out <dir>

Freestanding landmark: origin at the bottom center of the footprint, portico
facing -Y (its front). Colliders: main block, steps, tower, and one capsule per column.
"""

import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import MeshBuilder, collider_box, export_glb, material, parse_args, reset_scene  # noqa: E402
from redclay.validate import validate_scene  # noqa: E402

NAME = "BLD_Courthouse"
HW, HD, H = 17.0, 11.0, 14.0    # main block half-width (x), half-depth (y), height
FRONT = -HD                      # front wall plane (y)


def windows(b, glass, trim, face, rows, cols, span, sill_heights, win_w=1.3, win_h=2.6):
    """Punch window insets into one wall. face: 'front', 'back', 'left', 'right'."""
    for z in sill_heights:
        for i in range(cols):
            c = -span / 2 + span * (i + 0.5) / cols
            if face in ("front", "back"):
                y = FRONT if face == "front" else HD
                s = -1 if face == "front" else 1
                b.box(c - win_w / 2, c + win_w / 2, y + s * 0.02 - 0.03, y + s * 0.02 + 0.03, z, z + win_h, glass)
                b.box(c - win_w / 2 - 0.15, c + win_w / 2 + 0.15, y + s * 0.15 - 0.1, y + s * 0.15 + 0.1, z - 0.15, z, trim)
                b.box(c - win_w / 2 - 0.15, c + win_w / 2 + 0.15, y + s * 0.12 - 0.08, y + s * 0.12 + 0.08, z + win_h, z + win_h + 0.3, trim)
            else:
                x = -HW if face == "left" else HW
                s = -1 if face == "left" else 1
                b.box(x + s * 0.02 - 0.03, x + s * 0.02 + 0.03, c - win_w / 2, c + win_w / 2, z, z + win_h, glass)
                b.box(x + s * 0.15 - 0.1, x + s * 0.15 + 0.1, c - win_w / 2 - 0.15, c + win_w / 2 + 0.15, z - 0.15, z, trim)
                b.box(x + s * 0.12 - 0.08, x + s * 0.12 + 0.08, c - win_w / 2 - 0.15, c + win_w / 2 + 0.15, z + win_h, z + win_h + 0.3, trim)


def main():
    args = parse_args()
    reset_scene()
    stone = material("MAT_Stone_Cream", "#e6dcc6", roughness=0.85)
    trim = material("MAT_Trim_White", "#f5f2ea", roughness=0.6)
    base = material("MAT_Stone_Base", "#b9ad97", roughness=0.9)
    glass = material("MAT_Glass_Dark", "#1c2a33", roughness=0.08, metallic=0.4)
    roof = material("MAT_Copper_Roof", "#5f8a76", roughness=0.6, metallic=0.3)
    clock = material("MAT_Clock_Face", "#f7f3e6", roughness=0.4)
    hands = material("MAT_Iron_Black", "#1d1d1d", roughness=0.5)
    door = material("MAT_Wood_Door", "#4b2e1f", roughness=0.7)

    b = MeshBuilder()
    # Main block with a rusticated base, belt course, and cornice.
    b.box(-HW, HW, -HD, HD, 0.0, H, stone)
    b.box(-HW - 0.2, HW + 0.2, -HD - 0.2, HD + 0.2, 0.0, 1.4, base)
    b.box(-HW - 0.15, HW + 0.15, -HD - 0.15, HD + 0.15, 7.0, 7.3, trim)
    b.box(-HW - 0.6, HW + 0.6, -HD - 0.6, HD + 0.6, H, H + 0.9, trim)
    b.box(-HW - 0.3, HW + 0.3, -HD - 0.3, HD + 0.3, H + 0.9, H + 1.3, stone)
    windows(b, glass, trim, "front", 2, 8, 30.0, (2.4, 8.6))
    windows(b, glass, trim, "back", 2, 8, 30.0, (2.4, 8.6))
    windows(b, glass, trim, "left", 2, 5, 18.0, (2.4, 8.6))
    windows(b, glass, trim, "right", 2, 5, 18.0, (2.4, 8.6))

    # Portico: steps, six columns, entablature, pediment.
    for i, (y0, z1) in enumerate(((-16.6, 0.4), (-16.1, 0.8), (-15.6, 1.2))):
        b.box(-9.5 + i * 0.3, 9.5 - i * 0.3, y0, FRONT, 0.0, z1, base)
    b.box(-8.6, 8.6, -15.4, FRONT, 1.2, 1.45, trim)                    # porch floor edge
    col_x = [-7.0 + i * 2.8 for i in range(6)]
    for x in col_x:
        b.vcyl(x, -14.6, 1.45, 1.75, 0.62, trim, segments=8)          # base
        b.vcyl(x, -14.6, 1.75, 11.6, 0.5, trim, r1=0.44, segments=14)
        b.box(x - 0.6, x + 0.6, -15.2, -14.0, 11.6, 11.9, trim)        # capital
    b.box(-8.8, 8.8, -15.6, FRONT, 11.9, 13.6, trim)                   # entablature
    b.hexa(
        [(-9.2, -15.7, 13.6), (9.2, -15.7, 13.6), (9.2, FRONT, 13.6), (-9.2, FRONT, 13.6)],
        [(-0.05, -15.7, 16.8), (0.05, -15.7, 16.8), (0.05, FRONT, 16.8), (-0.05, FRONT, 16.8)],
        trim,
    )
    b.box(-1.6, 1.6, FRONT - 0.05, FRONT + 0.1, 1.45, 5.2, door)       # front doors
    b.box(-1.9, 1.9, FRONT - 0.15, FRONT + 0.1, 5.2, 5.6, trim)

    # Clock tower: drum, clock faces with hands, belfry, copper roof.
    b.box(-4.0, 4.0, -4.0, 4.0, H + 1.3, H + 10.0, stone)
    b.box(-4.3, 4.3, -4.3, 4.3, H + 10.0, H + 10.5, trim)
    b.box(-3.6, 3.6, -3.6, 3.6, H + 10.5, H + 14.0, trim)              # belfry
    for x in (-3.6, 3.6):
        b.box(x - 0.05, x + 0.05, -2.4, 2.4, H + 11.0, H + 13.4, hands)  # louvers (dark openings)
    for y in (-3.6, 3.6):
        b.box(-2.4, 2.4, y - 0.05, y + 0.05, H + 11.0, H + 13.4, hands)
    cz = H + 6.2
    faces = [
        Matrix.Translation((0, -4.0, cz)) @ Matrix.Rotation(math.pi / 2, 4, "X"),
        Matrix.Translation((0, 4.0, cz)) @ Matrix.Rotation(-math.pi / 2, 4, "X"),
        Matrix.Translation((-4.0, 0, cz)) @ Matrix.Rotation(-math.pi / 2, 4, "Y"),
        Matrix.Translation((4.0, 0, cz)) @ Matrix.Rotation(math.pi / 2, 4, "Y"),
    ]
    for m in faces:
        b.cylinder(2.3, 2.3, 0.12, trim, segments=24, matrix=m)
        b.cylinder(2.05, 2.05, 0.16, clock, segments=24, matrix=m)
        # Hands at ten past ten, sitting just proud of the dial.
        # Angles are counter-clockwise from 12 o'clock as seen from outside.
        b.cylinder(0.12, 0.12, 0.08, hands, segments=6, matrix=m @ Matrix.Translation((0, 0, 0.16)))
        for length, angle in ((1.3, math.radians(55)), (1.8, math.radians(-60))):
            hm = m @ Matrix.Translation((0, 0, 0.17)) @ Matrix.Rotation(angle, 4, "Z")
            outline = ((-0.06, 0), (0.06, 0), (0.06, length), (-0.06, length))
            bottom = [(hm @ Vector((x, y, 0.0))).to_tuple() for x, y in outline]
            top = [(hm @ Vector((x, y, 0.04))).to_tuple() for x, y in outline]
            b.hexa(bottom, top, hands)
    b.cylinder(5.4, 0.0, 6.0, roof, segments=4, matrix=Matrix.Translation((0, 0, H + 14.0)) @ Matrix.Rotation(math.pi / 4, 4, "Z"))
    b.vcyl(0, 0, H + 19.5, H + 22.0, 0.08, hands, segments=6)          # finial

    # Roof of the main block.
    b.box(-HW + 0.3, HW - 0.3, -HD + 0.3, HD - 0.3, H + 1.3, H + 1.6, roof)
    b.to_object(NAME)["landmark"] = True

    collider_box(f"{NAME}_Block-colonly", -HW - 0.2, HW + 0.2, -HD - 0.2, HD + 0.2, 0.0, H + 1.3)
    collider_box(f"{NAME}_Steps-colonly", -9.5, 9.5, -16.6, FRONT, 0.0, 1.2)
    collider_box(f"{NAME}_Tower-colonly", -4.3, 4.3, -4.3, 4.3, H + 1.3, H + 14.0)
    for i, x in enumerate(col_x):
        collider_box(f"{NAME}_Column{i}-colonly", x - 0.55, x + 0.55, -15.15, -14.05, 1.45, 11.6, shape="capsule")

    validate_scene(kind="building")
    export_glb(os.path.join(args["out"], "buildings", f"{NAME}.glb"))


main()
