"""Generate Southeastern trees: live oaks (with Spanish moss) and loblolly pines.

usage: blender -b --factory-startup --python-exit-code 1 -P gen_trees.py -- --out <dir>

Origin at the base of the trunk. Each tree has a capsule collider on its trunk.
Output: <out>/foliage/<name>.glb
"""

import math
import os
import random
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from redclay.common import MeshBuilder, collider_box, export_glb, material, parse_args, reset_scene  # noqa: E402
from redclay.validate import validate_scene  # noqa: E402


def branch(b, mat, start, direction, length, r0, r1):
    """Tapered limb from `start` along `direction`."""
    d = Vector(direction).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    b.cylinder(r0, r1, length, mat, segments=7, matrix=Matrix.Translation(start) @ rot)
    return Vector(start) + d * length


def live_oak(name, seed, scale):
    rng = random.Random(seed)
    bark = material("MAT_Bark_Oak", "#4a3b2d", roughness=0.95)
    leaf = material("MAT_Leaf_Oak", "#3f5a2a", roughness=0.9)
    leaf2 = material("MAT_Leaf_Oak_Dark", "#344b24", roughness=0.9)
    moss = material("MAT_Spanish_Moss", "#8c977c", roughness=1.0)

    b = MeshBuilder()
    trunk_h = 3.2 * scale
    b.vcyl(0, 0, 0, trunk_h, 0.45 * scale, bark, r1=0.36 * scale, segments=9)
    # Live oaks spread wide and low: four or five heavy limbs, canopy clumps at their ends.
    limbs = rng.randint(4, 5)
    for i in range(limbs):
        a = 2 * math.pi * (i / limbs) + rng.uniform(-0.3, 0.3)
        out = Vector((math.cos(a), math.sin(a), rng.uniform(0.5, 0.8)))
        tip = branch(b, bark, (0, 0, trunk_h * 0.9), out, rng.uniform(3.2, 4.2) * scale, 0.26 * scale, 0.12 * scale)
        for k in range(2):
            c = tip + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.6, 1.2))) * scale
            b.blob(c, rng.uniform(1.8, 2.4) * scale, leaf if k == 0 else leaf2, scale=(1.3, 1.3, 0.75), seed=seed * 10 + i * 2 + k)
        # Spanish moss hanging from the limb.
        for k in range(3):
            p = Vector((0, 0, trunk_h * 0.9)) + out.normalized() * rng.uniform(1.5, 3.5) * scale
            hang = rng.uniform(0.7, 1.4) * scale
            b.box(p.x - 0.12, p.x + 0.12, p.y - 0.05, p.y + 0.05, p.z - hang, p.z, moss)
    b.blob((0, 0, trunk_h + 3.2 * scale), 2.6 * scale, leaf, scale=(1.4, 1.4, 0.7), seed=seed * 10 + 99)
    b.to_object(name)
    r = 0.45 * scale
    collider_box(f"{name}_Trunk-colonly", -r, r, -r, r, 0.0, trunk_h + 0.6, shape="capsule")


def loblolly_pine(name, seed, scale):
    rng = random.Random(seed)
    bark = material("MAT_Bark_Pine", "#5b4636", roughness=0.95)
    needles = material("MAT_Needles_Pine", "#2f4a26", roughness=0.9)

    b = MeshBuilder()
    h = 15.0 * scale
    # Tall, straight, bare trunk with the crown bunched at the top.
    b.vcyl(0, 0, 0, h, 0.3 * scale, bark, r1=0.12 * scale, segments=8)
    for i in range(5):
        a = rng.uniform(0, 2 * math.pi)
        z = h * rng.uniform(0.62, 0.92)
        tip = branch(b, bark, (0, 0, z), (math.cos(a), math.sin(a), 0.35), rng.uniform(1.4, 2.2) * scale, 0.08 * scale, 0.04 * scale)
        b.blob(tip, rng.uniform(1.0, 1.5) * scale, needles, scale=(1.3, 1.3, 0.6), seed=seed * 10 + i)
    b.blob((0, 0, h * 0.98), 1.6 * scale, needles, scale=(1.1, 1.1, 0.9), seed=seed * 10 + 9)
    b.blob((0, 0, h * 0.85), 1.9 * scale, needles, scale=(1.2, 1.2, 0.7), seed=seed * 10 + 8)
    b.to_object(name)
    r = 0.3 * scale
    collider_box(f"{name}_Trunk-colonly", -r, r, -r, r, 0.0, h * 0.6, shape="capsule")


VARIANTS = [
    ("FOL_LiveOak_A", live_oak, 11, 1.0),
    ("FOL_LiveOak_B", live_oak, 23, 0.85),
    ("FOL_Pine_A", loblolly_pine, 5, 1.0),
    ("FOL_Pine_B", loblolly_pine, 8, 0.82),
]


def main():
    args = parse_args()
    for name, build, seed, scale in VARIANTS:
        reset_scene()
        build(name, seed, scale)
        validate_scene()
        export_glb(os.path.join(args["out"], "foliage", f"{name}.glb"))


main()
