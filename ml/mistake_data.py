"""Training data: enter a plausible digit in a cell, label whether it was right."""
import csv, os, random, sys
from multiprocessing import Pool
import sudoku
from ml import hints, mistakes

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "mistakes.csv")


def sample(args):
    bid, grid = args
    rng = random.Random(bid)
    sol = sudoku.solve(grid)
    sol = [int(c) for c in sol] if isinstance(sol, str) else list(sol)
    cells = [int(c) for c in grid]
    rows = []
    for _ in range(rng.randint(1, 30)):  # replay correct moves, then test entries
        ms = hints.moves(cells)
        if not ms:
            break
        i, v, _h = rng.choice(ms)
        cells[i] = v
    cand = sudoku._candidates(cells)
    empty = list(cand)
    rng.shuffle(empty)
    for i in empty[:6]:
        opts = sorted(cand[i])
        if not opts:
            continue
        d = rng.choice(opts)          # a digit that does not clash with anything
        rows.append([bid] + [round(x, 4) for x in mistakes.features(cells, i, d)]
                    + [int(d == sol[i])])
    return rows


def main(n=6000):
    src = list(csv.DictReader(open(os.path.join(HERE, "data", "puzzles.csv"))))[:n]
    with Pool() as p:
        out = p.map(sample, list(enumerate(r["puzzle"] for r in src)), chunksize=25)
    flat = [r for b in out for r in b]
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["board"] + mistakes.NAMES + ["correct"])
        w.writerows(flat)
    print(len(flat), "entries ->", OUT)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 6000)
