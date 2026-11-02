# Daily Sudoku

A new sudoku every day, in three levels (Easy, Medium, Hard).

- `sudoku.py`: generator, solver, and a rater that solves like a person
  (naked/hidden singles, locked candidates, naked pairs). Every puzzle has exactly one solution.
- `generate.py`: writes `docs/puzzles/<date>.json`. A published day never changes.
- `docs/`: the static play page (GitHub Pages).

Run the tests: `python3 -m unittest`
Make puzzles: `python3 generate.py --days 7`
