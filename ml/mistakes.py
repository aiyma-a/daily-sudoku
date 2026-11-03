"""Mistake detection: is the digit a player just typed likely wrong?

The page does not peek at the solution. It judges an entry the way a good
friend would: how many digits could have gone there, was it forced, does the
digit have other places to go in its row/column/box? Entries that clash with
a neighbor are already shown in red, so this only looks at entries that
*look* fine but may be guesses.
"""
import sudoku

NAMES = ["cell_candidates", "min_spots", "max_fill", "digit_placed", "empties",
         "is_forced"]


def features(cells, i, d):
    """cells = board BEFORE the entry (list of 81 ints)."""
    cand = sudoku._candidates(cells)
    r, c = divmod(i, 9)
    b = (r // 3) * 3 + c // 3
    units = (sudoku.ROWS[r], sudoku.COLS[c], sudoku.BOXES[b])
    spots = [sum(1 for j in u if j in cand and d in cand[j]) for u in units]
    fill = [sum(1 for j in u if cells[j]) for u in units]
    k = len(cand[i])
    return [k, min(spots), max(fill), cells.count(d), len(cand),
            1 if (k == 1 or min(spots) == 1) else 0]
