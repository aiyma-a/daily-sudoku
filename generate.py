"""Write puzzles/<date>.json with the 3 daily puzzles.

Usage: python3 generate.py [YYYY-MM-DD ...] [--days N]
With no date, generates today and the next N days (default 3).
"""
import json, os, random, sys, datetime
import sudoku
from ml import predict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "puzzles")


# Aim for the middle of each level's band, so Hard is hard and Easy is easy.
TARGET = {"easy": 38, "medium": 70, "hard": 130}
CANDIDATES = 30


def best_puzzle(level, date, n=CANDIDATES):
    """Make n candidates, keep the one the model rates closest to the level's
    target difficulty. Deterministic for a given date."""
    pool = []
    for k in range(n):
        try:
            puzzle, solution, r = sudoku.make_puzzle(level, f"{date}#{k}")
        except RuntimeError:
            continue
        s = predict.score(puzzle)
        if predict.level(s) != level:  # model and human rater must agree
            continue
        pool.append((abs(s - TARGET[level]), puzzle, solution, r, s))
    if pool:  # among the near-best, vary by date so days do not look alike
        top = min(p[0] for p in pool)
        near = [p for p in pool if p[0] <= top + 8]
        best = random.Random(f"{date}:{level}:pick").choice(near)
    else:  # fall back to the plain generator
        puzzle, solution, r = sudoku.make_puzzle(level, date)
        return puzzle, solution, r, predict.score(puzzle)
    return best[1:]


def write_day(date):
    path = os.path.join(OUT, f"{date}.json")
    if os.path.exists(path):  # a published puzzle never changes
        return False
    day = {}
    for level in sudoku.LEVELS:
        puzzle, solution, r, s = best_puzzle(level, date)
        day[level] = {"puzzle": puzzle, "solution": solution, "tier": r["tier"],
                       "score": round(s, 1)}
    os.makedirs(OUT, exist_ok=True)
    with open(path, "w") as f:
        json.dump(day, f)
    return True


def write_index():
    """List every published day so phones can save the coming days for offline play."""
    days = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith(".json") and f != "index.json")
    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump(days, f)


def main(argv):
    days = 3
    if "--days" in argv:
        i = argv.index("--days")
        days = int(argv[i + 1])
        del argv[i:i + 2]
    dates = argv or [(datetime.date.today() + datetime.timedelta(d)).isoformat()
                     for d in range(days + 1)]
    for d in dates:
        datetime.date.fromisoformat(d)
        print(d, "written" if write_day(d) else "exists")
    write_index()


if __name__ == "__main__":
    main(sys.argv[1:])
