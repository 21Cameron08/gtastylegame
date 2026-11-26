"""Asset validation rules shared by generators and the standalone validator.

Raises ValidationError listing every problem, so a bad asset fails the build.
"""

import math
import re

import bpy

from .common import triangle_count

PREFIXES = ("BLD_", "KIT_", "PRP_", "RD_", "FOL_", "VEH_", "WPN_", "CHR_", "SKY_", "CELL_")
MARKERS = ("WHEEL_", "SPAWN_PED_", "SPAWN_CAR_", "DOOR_", "MISSION_", "SAFEHOUSE_")
SUFFIX_RE = re.compile(r"-(colonly|convcolonly|col|nav|lod\d|noexp)$")
COLLIDER_SHAPES = {"box", "sphere", "capsule", "convex", "trimesh"}
WHEELS = ("WHEEL_FL", "WHEEL_FR", "WHEEL_RL", "WHEEL_RR")

# LOD0 triangle budgets by prefix (docs/06-blender-pipeline.md, browser targets).
TRI_BUDGET = {
    "VEH_": 25000,
    "CHR_": 15000,
    "WPN_": 5000,
    "BLD_": 4000,
    "KIT_": 4000,
    "PRP_": 1500,
    "FOL_": 2000,
}


class ValidationError(Exception):
    pass


def _base_name(name):
    return SUFFIX_RE.sub("", name)


def validate_scene(kind=None):
    """Validate every object in the current scene.

    kind: optional asset kind ("vehicle", "building") for extra checks.
    """
    errors = []
    objects = list(bpy.context.scene.objects)
    names = {o.name for o in objects}

    for obj in objects:
        name = obj.name
        base = _base_name(name)
        if "." in name:
            errors.append(f"{name}: '.' in names breaks glTF node lookup (duplicate object?)")
        if not base.startswith(PREFIXES + MARKERS):
            errors.append(f"{name}: unknown prefix (expected one of {PREFIXES + MARKERS})")

        # Transforms must be applied: rotation 0 and scale 1. Location may be non-zero
        # only for child parts (wheels, markers) placed relative to the asset origin.
        if any(abs(r) > 1e-4 for r in obj.rotation_euler):
            errors.append(f"{name}: rotation not applied {tuple(round(math.degrees(r), 2) for r in obj.rotation_euler)}")
        if any(abs(s - 1.0) > 1e-4 for s in obj.scale):
            errors.append(f"{name}: scale not applied {tuple(obj.scale)}")

        if name.endswith("-colonly") or name.endswith("-convcolonly"):
            shape = obj.get("collider", "box")
            if shape not in COLLIDER_SHAPES:
                errors.append(f"{name}: collider '{shape}' not in {sorted(COLLIDER_SHAPES)}")
            continue

        for prefix, budget in TRI_BUDGET.items():
            if base.startswith(prefix):
                tris = triangle_count(obj)
                if tris > budget:
                    errors.append(f"{name}: {tris} triangles exceeds {prefix} budget of {budget}")

        if obj.type == "MESH":
            for slot in obj.material_slots:
                if slot.material is None:
                    errors.append(f"{name}: empty material slot")

    if kind == "vehicle":
        for w in WHEELS:
            if w not in names:
                errors.append(f"vehicle is missing {w}")
        if not any(n.endswith("-colonly") for n in names):
            errors.append("vehicle has no '-colonly' chassis hull")

    if kind == "building":
        if not any(n.endswith("-colonly") or n.endswith("-col") for n in names):
            errors.append("building has no collider")

    if errors:
        raise ValidationError("\n  ".join(["asset validation failed:"] + errors))
    print(f"[redclay] validation passed ({len(objects)} objects)")
