"""Build the training set: many puzzles, each with a difficulty label.

Label ("effort", higher = harder) = what a human solver would spend:
  naked single 1, hidden single 2, locked candidates 6, naked pair 8,
  plus a big penalty when the human techniques get stuck and a guess is
  needed (scaled by how much guessing a backtracking solver does).

Usage: python3 -m ml.dataset [N] -> ml/data/puzzles.csv
"""
import csv, math, os, random, sys
from multiprocessing import Pool
import sudoku
from ml.features import NAMES, features

W = {"naked_single": 1, "hidden_single": 2, "locked_candidates": 6, "naked_pair": 8}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "puzzles.csv")


def search_nodes(grid, cap=20000):
    """How many guesses a backtracking solver (fewest-options-first) needs."""
    cells = [int(c) for c in grid]
    nodes = 0

    def go():
        nonlocal nodes
        best, bc = None, None
        for i in range(81):
            if cells[i] == 0:
                used = {cells[p] for p in sudoku.PEERS[i]}
                c = [v for v in sudoku.DIGITS if v not in used]
                if best is None or len(c) < len(bc):
                    best, bc = i, c
                    if len(c) <= 1:
                        break
        if best is None:
            return True
        for v in bc:
            nodes += 1
            if nodes > cap:
                return False
            cells[best] = v
            if go():
                return True
            cells[best] = 0
        return False

    go()
    return nodes


def effort(grid):
    r = sudoku.rate(grid)
    e = sum(W[k] * n for k, n in r["steps"].items())
    if not r["solved"]:
        e += 60 + 15 * math.log2(1 + search_nodes(grid))
    return e, r["tier"]


def one(seed):
    rng = random.Random(seed)
    # spread of clue counts from very hard (22) to very easy (45)
    target = rng.randint(22, 45)
    full = sudoku.random_full_grid(rng)
    p = sudoku.dig_holes(full, rng, target)
    e, tier = effort(p)
    return [p, tier, round(e, 2)] + [round(x, 4) for x in features(p)]


def main(n=6000):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with Pool() as pool:
        rows = pool.map(one, range(n), chunksize=50)
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["puzzle", "tier", "effort"] + NAMES)
        w.writerows(rows)
    print("wrote", len(rows), "puzzles to", OUT)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 6000)
