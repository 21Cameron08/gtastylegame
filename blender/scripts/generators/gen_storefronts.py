"""Generate two-story downtown brick storefronts (Downtown Square kit).

usage: blender -b --factory-startup --python-exit-code 1 -P gen_storefronts.py -- --out <dir>

Origin: bottom center of the street-facing facade. Facade faces -Y; the
building extends toward +Y. Output: <out>/buildings/<name>.glb per variant.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import (  # noqa: E402
    MeshBuilder, collider_box, export_glb, material, parse_args, reset_scene,
)
from redclay.validate import validate_scene  # noqa: E402

GROUND_H = 4.5   # ground-floor storefront height
UPPER_H = 3.5    # upper floor height
ROOF_Z = GROUND_H + UPPER_H
PARAPET_H = 1.0
FACADE_T = 0.3   # facade thickness (y)
GLASS_Y = 0.2    # glass recess behind facade plane

VARIANTS = [
    # name, width, depth, brick, trim, awning (None = no awning), sign
    ("BLD_Storefront_8m_A", 8.0, 12.0, "#8e3b2a", "#e8dcc0", "#2f5d3a", "#efe3c4"),
    ("BLD_Storefront_8m_B", 8.0, 12.0, "#b38a5c", "#f3efe6", "#7a1f24", "#24343f"),
    ("BLD_Storefront_12m_C", 12.0, 14.0, "#e3ddd0", "#2b3a4a", "#213a5c", "#b5462e"),
    ("BLD_Storefront_8m_D", 8.0, 12.0, "#5e3326", "#d9c9a3", None, "#d9c9a3"),
]


def storefront(name, W, D, brick_hex, trim_hex, awning_hex, sign_hex):
    tag = name.rsplit("_", 1)[-1]
    brick = material(f"MAT_Brick_{tag}", brick_hex, roughness=0.9)
    trim = material(f"MAT_Trim_{tag}", trim_hex, roughness=0.7)
    sign = material(f"MAT_Sign_{tag}", sign_hex, roughness=0.6)
    glass = material("MAT_Glass_Dark", "#1c2a33", roughness=0.08, metallic=0.4)
    roof = material("MAT_Roof_Tar", "#3b3a38", roughness=0.95)
    metal = material("MAT_Metal_Gray", "#9aa0a3", roughness=0.5, metallic=0.6)

    b = MeshBuilder()
    hw = W / 2.0

    # Main body behind the facade, plus roof slab and side/back parapets.
    b.box(-hw, hw, 0.15, D, 0.0, ROOF_Z, brick)
    b.box(-hw + 0.15, hw - 0.15, FACADE_T, D - 0.15, ROOF_Z, ROOF_Z + 0.05, roof)
    b.box(-hw, -hw + 0.15, 0.0, D, ROOF_Z, ROOF_Z + 0.6, brick)
    b.box(hw - 0.15, hw, 0.0, D, ROOF_Z, ROOF_Z + 0.6, brick)
    b.box(-hw, hw, D - 0.15, D, ROOF_Z, ROOF_Z + 0.6, brick)

    # --- Ground floor storefront ---
    pier = 0.4
    door_hw = 0.6
    door_h = 2.6
    kick_h = 0.5
    glass_top = 3.1
    band_bottom = 3.5
    b.box(-hw, -hw + pier, 0.0, FACADE_T, 0.0, GROUND_H, brick)           # left pier
    b.box(hw - pier, hw, 0.0, FACADE_T, 0.0, GROUND_H, brick)             # right pier
    b.box(-hw + pier, hw - pier, -0.05, FACADE_T, band_bottom, GROUND_H, sign)  # sign band
    b.box(-hw + pier, hw - pier, 0.05, FACADE_T, glass_top, band_bottom, trim)  # transom bar
    for (x0, x1) in ((-hw + pier, -door_hw), (door_hw, hw - pier)):
        b.box(x0, x1, 0.05, FACADE_T, 0.0, kick_h, trim)                  # kickplate
        b.box(x0, x1, GLASS_Y - 0.02, GLASS_Y + 0.02, kick_h, glass_top, glass)
        mid = (x0 + x1) / 2.0
        b.box(mid - 0.04, mid + 0.04, 0.08, GLASS_Y, kick_h, glass_top, trim)  # mullion
    b.box(-door_hw, -door_hw + 0.06, 0.05, FACADE_T, 0.0, glass_top, trim)  # door frame
    b.box(door_hw - 0.06, door_hw, 0.05, FACADE_T, 0.0, glass_top, trim)
    b.box(-door_hw, door_hw, 0.05, FACADE_T, door_h, glass_top, trim)        # panel above door
    b.box(-door_hw + 0.06, door_hw - 0.06, GLASS_Y - 0.02, GLASS_Y + 0.02, 0.0, door_h, glass)

    # Canvas awning, sloped away from the facade.
    if awning_hex:
        canvas = material(f"MAT_Awning_{tag}", awning_hex, roughness=0.9)
        z_top, z_low, depth = band_bottom - 0.05, band_bottom - 0.65, 1.5
        x0, x1 = -hw + pier + 0.1, hw - pier - 0.1
        b.hexa(
            [(x0, -depth, z_low - 0.06), (x1, -depth, z_low - 0.06), (x1, 0.0, z_top - 0.06), (x0, 0.0, z_top - 0.06)],
            [(x0, -depth, z_low), (x1, -depth, z_low), (x1, 0.0, z_top), (x0, 0.0, z_top)],
            canvas,
        )
        b.box(x0, x1, -depth - 0.02, -depth + 0.02, z_low - 0.35, z_low, canvas)  # valance

    # --- Upper floor: brick with punched windows ---
    z0, z1 = GROUND_H, ROOF_Z
    sill, head = z0 + 0.8, z0 + 2.7
    win_hw = 0.6
    n = max(2, round(W / 2.7))
    centers = [-hw + W * (i + 0.5) / n for i in range(n)]
    b.box(-hw, hw, 0.0, FACADE_T, z0, sill, brick)       # spandrel below windows
    b.box(-hw, hw, 0.0, FACADE_T, head, z1, brick)       # spandrel above windows
    edges = [-hw] + [c for cx in centers for c in (cx - win_hw, cx + win_hw)] + [hw]
    for i in range(0, len(edges), 2):                    # piers between windows
        b.box(edges[i], edges[i + 1], 0.0, FACADE_T, sill, head, brick)
    for cx in centers:
        b.box(cx - win_hw - 0.1, cx + win_hw + 0.1, -0.1, FACADE_T, sill - 0.1, sill, trim)  # sill
        b.box(cx - win_hw - 0.1, cx + win_hw + 0.1, -0.05, FACADE_T, head, head + 0.2, trim)  # lintel
        b.box(cx - win_hw, cx + win_hw, GLASS_Y - 0.02, GLASS_Y + 0.02, sill, head, glass)
        mid = (sill + head) / 2.0
        b.box(cx - win_hw, cx + win_hw, 0.1, GLASS_Y, mid - 0.04, mid + 0.04, trim)  # sash rail

    # --- Parapet and cornice ---
    b.box(-hw, hw, 0.0, FACADE_T, z1, z1 + PARAPET_H, brick)
    b.box(-hw, hw, -0.1, FACADE_T, z1, z1 + 0.15, trim)                    # belt course
    b.box(-hw - 0.05, hw + 0.05, -0.25, FACADE_T + 0.05, z1 + PARAPET_H - 0.3, z1 + PARAPET_H, trim)

    # Rooftop AC unit.
    b.box(-1.0, 0.4, D * 0.55, D * 0.55 + 1.2, ROOF_Z + 0.05, ROOF_Z + 1.0, metal)

    b.to_object(name)
    collider_box(f"{name}-colonly", -hw, hw, 0.0, D, 0.0, ROOF_Z + PARAPET_H)


def main():
    args = parse_args()
    for (name, W, D, brick_hex, trim_hex, awning_hex, sign_hex) in VARIANTS:
        reset_scene()
        storefront(name, W, D, brick_hex, trim_hex, awning_hex, sign_hex)
        validate_scene(kind="building")
        export_glb(os.path.join(args["out"], "buildings", f"{name}.glb"))


main()
