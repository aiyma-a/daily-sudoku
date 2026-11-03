"""Build hint training data: play real puzzles part-way, list the moves."""
import csv, os, random, sys
from multiprocessing import Pool
from ml import hints

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "hints.csv")


def board_rows(args):
    bid, grid, seed = args
    rng = random.Random(seed)
    cells = [int(c) for c in grid]
    # play a random number of (random) valid moves to reach a mid-game state
    for _ in range(rng.randint(0, 40)):
        ms = hints.moves(cells)
        if not ms:
            break
        i, v, _h = rng.choice(ms)
        cells[i] = v
    ms = hints.moves(cells)
    if len(ms) < 2:
        return []
    return [[bid, m[0], m[1]] + [round(x, 4) for x in hints.features(cells, m)]
            + [hints.usefulness(cells, m)] for m in ms]


def main(n=3000):
    rows = list(csv.DictReader(open(os.path.join(HERE, "data", "puzzles.csv"))))
    jobs = [(k, r["puzzle"], k) for k, r in enumerate(rows[:n])]
    with Pool() as p:
        out = p.map(board_rows, jobs, chunksize=20)
    flat = [r for b in out for r in b]
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["board", "cell", "digit"] + hints.NAMES + ["usefulness"])
        w.writerows(flat)
    print(len({r[0] for r in flat}), "boards,", len(flat), "moves ->", OUT)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 3000)
