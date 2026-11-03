# Daily Sudoku

A new sudoku every day, in three levels (Easy, Medium, Hard).

- `sudoku.py`: generator, solver, and a rater that solves like a person
  (naked/hidden singles, locked candidates, naked pairs). Every puzzle has exactly one solution.
- `generate.py`: writes `docs/puzzles/<date>.json`. A published day never changes.
- `docs/`: the static play page (GitHub Pages).

Run the tests: `python3 -m unittest`
Make puzzles: `python3 generate.py --days 7`

## Machine learning

- `ml/features.py`: turns a puzzle into 17 numbers (clues, candidates per cell, how far simple forced moves get).
- `ml/dataset.py`: generates thousands of puzzles and labels each with "effort", the work a human solver needs.
- `ml/train.py`: trains gradient-boosted trees, compares against simpler models on unseen puzzles, writes `ml/model.json` and charts in `docs/ml/`.
- `ml/predict.py`: runs the model with no libraries. `generate.py` stores each puzzle's predicted `score`.

Retrain: `.venv/bin/python -m ml.dataset 8000 && .venv/bin/python -m ml.train` (setup: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`).
- `ml/hints.py`, `ml/hint_data.py`, `ml/hint_train.py`: the Hint button's ranker. It lists the moves simple logic allows, scores each with trees, and suggests the best. `docs/hint.js` runs the same trees in the browser (a test checks it matches Python).
- `docs/skill.js`: learns your solve-time pattern on your phone (online learning) to power "Just right for you". Scores were backfilled into older puzzle files.
- `docs/mistake.js`, `ml/mistakes.py`, `ml/mistake_*.py`: a classifier that flags entries that look like guesses, plus an adaptive "stuck" detector that learns your usual pause length.
- `docs/how.html` + `ml/summary.py`: the "How it works" page. After retraining, run `python3 -m ml.summary` to refresh its numbers.
