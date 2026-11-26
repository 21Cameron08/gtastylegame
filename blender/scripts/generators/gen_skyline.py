"""Generate the Port Meridian skyline backdrop (SKY_PortMeridian).

usage: blender -b --factory-startup --python-exit-code 1 -P gen_skyline.py -- --out <dir>

A single low-detail mesh meant to sit kilometers away in the haze: towers with
setbacks, a spire, and port cranes. Origin at the front center, facing -Y.
"""

import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import MeshBuilder, export_glb, material, parse_args, reset_scene  # noqa: E402
from redclay.validate import validate_scene  # noqa: E402

NAME = "SKY_PortMeridian"


def main():
    args = parse_args()
    reset_scene()
    rng = random.Random(7)
    tones = [
        material("MAT_Sky_Tower_A", "#8a96a3", roughness=0.7),
        material("MAT_Sky_Tower_B", "#9ba6b0", roughness=0.7),
        material("MAT_Sky_Tower_C", "#76828f", roughness=0.7),
    ]
    crane = material("MAT_Sky_Crane", "#a9603e", roughness=0.7)

    b = MeshBuilder()
    for i in range(38):
        x = -300 + i * 16 + rng.uniform(-5, 5)
        y = rng.uniform(0, 220)
        core = abs(x) < 110                       # downtown core is taller
        h = rng.uniform(70, 190) if core else rng.uniform(25, 80)
        w = rng.uniform(18, 34)
        mat = tones[i % 3]
        b.box(x - w / 2, x + w / 2, y - w / 2, y + w / 2, 0, h, mat)
        if core and rng.random() < 0.6:           # setback crown
            w2 = w * rng.uniform(0.55, 0.75)
            b.box(x - w2 / 2, x + w2 / 2, y - w2 / 2, y + w2 / 2, h, h + rng.uniform(12, 30), mat)
    # The tallest tower with a spire: the First Meridian Bank building.
    b.box(-14, 14, 60, 88, 0, 228, tones[1])
    b.box(-9, 9, 65, 83, 228, 248, tones[1])
    b.vcyl(0, 74, 248, 290, 1.2, tones[2], r1=0.2, segments=6)
    # Port cranes along the river to the east.
    for i in range(4):
        x = 360 + i * 38
        for dx in (-7, 7):
            b.box(x + dx - 1, x + dx + 1, -1, 1, 0, 42, crane)
        b.box(x - 9, x + 9, -1.2, 1.2, 40, 44, crane)
        b.box(x - 1.2, x + 1.2, -38, 26, 44, 47, crane)            # boom over the water
    b.to_object(NAME)
    validate_scene()
    export_glb(os.path.join(args["out"], "skyline", f"{NAME}.glb"))


main()
