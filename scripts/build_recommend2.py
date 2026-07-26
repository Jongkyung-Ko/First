#!/usr/bin/env python3
"""Build data/recommend2-bottom-accumulation.json for GitHub Pages (추천2)."""

import runpy
from pathlib import Path

if __name__ == "__main__":
    script = Path(__file__).resolve().parent / "build_recommend2_standalone.py"
    runpy.run_path(str(script), run_name="__main__")
