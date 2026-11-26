"""Generate the blockout of Trip Hollins (CHR_Trip), the player character.

usage: blender -b --factory-startup --python-exit-code 1 -P gen_character.py -- --out <dir>

No skeleton yet: body parts hang from JOINT_* empties at the hips, shoulders,
spine, and neck so the game can swing them for a simple walk cycle. (Joints
must be empties: compression moves mesh origins, but leaves empties alone.)
Origin between the feet, facing -Y, so the left side is +X. Height 1.8 m.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import MeshBuilder, empty, export_glb, material, parse_args, reset_scene  # noqa: E402
from redclay.validate import validate_scene  # noqa: E402

NAME = "CHR_Trip"
HIP_Z = 0.93
SHOULDER_Z = 1.43


def main():
    args = parse_args()
    reset_scene()
    skin = material("MAT_Skin_Trip", "#c08a64", roughness=0.7)
    flannel = material("MAT_Flannel_Red", "#9a3127", roughness=0.9)
    jeans = material("MAT_Denim", "#3a4a68", roughness=0.9)
    leather = material("MAT_Leather_Boot", "#4d3526", roughness=0.8)
    cap = material("MAT_Cap_Green", "#34503d", roughness=0.8)
    cap_front = material("MAT_Cap_Front", "#e9e3d3", roughness=0.8)
    dark = material("MAT_Eyes_Hair", "#211a15", roughness=0.6)

    spine = empty("JOINT_Spine", (0.0, 0.0, 0.95))
    neck = empty("JOINT_Head", (0.0, 0.0, 1.5), parent=spine)

    t = MeshBuilder()
    t.box(-0.17, 0.17, -0.11, 0.11, 0.86, 1.0, jeans)                  # hips
    t.box(-0.175, 0.175, -0.115, 0.115, 0.98, 1.03, leather)           # belt
    t.box(-0.19, 0.19, -0.12, 0.12, 1.03, 1.3, flannel)                # torso
    t.box(-0.21, 0.21, -0.125, 0.125, 1.3, 1.47, flannel)              # chest/shoulders
    t.box(-0.05, 0.05, -0.13, -0.124, 1.05, 1.44, dark)                # button placket
    t.vcyl(0, 0, 1.46, 1.53, 0.055, skin, segments=8)                  # neck
    t.to_object(f"{NAME}_Torso", origin=(0.0, 0.0, 0.95), parent=spine)

    h = MeshBuilder()
    h.box(-0.1, 0.1, -0.115, 0.1, 1.52, 1.75, skin)                    # head
    h.box(-0.105, 0.105, -0.02, 0.105, 1.6, 1.74, dark)                # hair (back/sides)
    for x in (-0.045, 0.045):
        h.box(x - 0.015, x + 0.015, -0.12, -0.114, 1.64, 1.665, dark)  # eyes
    h.box(-0.015, 0.015, -0.135, -0.115, 1.6, 1.64, skin)              # nose
    h.box(-0.112, 0.112, -0.12, 0.112, 1.7, 1.81, cap)                 # cap crown
    h.box(-0.09, 0.09, -0.125, -0.118, 1.71, 1.8, cap_front)           # foam front panel
    h.box(-0.095, 0.095, -0.27, -0.12, 1.695, 1.715, cap)              # bill
    h.to_object(f"{NAME}_Head", origin=(0.0, 0.0, 1.5), parent=neck)

    for side, x in (("L", 0.1), ("R", -0.1)):
        hip = empty(f"JOINT_Leg{side}", (x, 0.0, HIP_Z))
        leg = MeshBuilder()
        leg.box(x - 0.075, x + 0.075, -0.085, 0.085, 0.12, HIP_Z, jeans)
        leg.box(x - 0.08, x + 0.08, -0.15, 0.09, 0.0, 0.13, leather)   # boot, toe forward (-Y)
        leg.to_object(f"{NAME}_Leg{side}", origin=(x, 0.0, HIP_Z), parent=hip)

        sx = 0.25 if side == "L" else -0.25
        shoulder = empty(f"JOINT_Arm{side}", (sx, 0.0, SHOULDER_Z), parent=spine)
        arm = MeshBuilder()
        arm.box(sx - 0.055, sx + 0.055, -0.06, 0.06, 0.98, SHOULDER_Z + 0.03, flannel)
        arm.box(sx - 0.045, sx + 0.045, -0.05, 0.05, 0.86, 0.98, skin)  # hand
        arm.to_object(f"{NAME}_Arm{side}", origin=(sx, 0.0, SHOULDER_Z), parent=shoulder)

    validate_scene()
    export_glb(os.path.join(args["out"], "characters", f"{NAME}.glb"))


main()
