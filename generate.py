"""Write puzzles/<date>.json with the 3 daily puzzles.

Usage: python3 generate.py [YYYY-MM-DD ...] [--days N]
With no date, generates today and the next N days (default 3).
"""
import json, os, sys, datetime
import sudoku
from ml import predict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "puzzles")


def write_day(date):
    path = os.path.join(OUT, f"{date}.json")
    if os.path.exists(path):  # a published puzzle never changes
        return False
    day = {}
    for level in sudoku.LEVELS:
        puzzle, solution, r = sudoku.make_puzzle(level, date)
        day[level] = {"puzzle": puzzle, "solution": solution, "tier": r["tier"],
                       "score": round(predict.score(puzzle), 1)}
    os.makedirs(OUT, exist_ok=True)
    with open(path, "w") as f:
        json.dump(day, f)
    return True


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


if __name__ == "__main__":
    main(sys.argv[1:])
