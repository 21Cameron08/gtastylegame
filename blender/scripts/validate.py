"""Validate a hand-made .blend file against the pipeline rules.

usage: blender -b <file.blend> --python-exit-code 1 -P blender/scripts/validate.py -- [--kind vehicle|building]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from redclay.validate import validate_scene  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
kind = argv[argv.index("--kind") + 1] if "--kind" in argv else None
validate_scene(kind)
