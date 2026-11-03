"""Run the trained difficulty model with no third-party libraries.

model.json holds the trees; this walks them. The same walk is done in
JavaScript on the play page, so the browser and the nightly job agree.
"""
import json, os
from ml.features import features

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.json")
_MODEL = None

# Effort ranges for each level (see ml/dataset.py for what "effort" means).
BANDS = {"easy": (0, 50), "medium": (50, 90), "hard": (90, 175)}


def _model():
    global _MODEL
    if _MODEL is None:
        with open(_PATH) as f:
            _MODEL = json.load(f)
    return _MODEL


def score(grid):
    """Predicted difficulty ("effort") of a puzzle string."""
    m = _model()
    x = features(grid)
    total = m["init"]
    for t in m["trees"]:
        n = 0
        while t["l"][n] != -1:
            n = t["l"][n] if x[t["f"][n]] <= t["t"][n] else t["r"][n]
        total += m["lr"] * t["v"][n]
    return total


def level(s):
    """Easy/medium/hard for a score; 'expert' means it likely needs guessing."""
    for name, (lo, hi) in BANDS.items():
        if s < hi:
            return name
    return "expert"
