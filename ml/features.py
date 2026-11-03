"""Turn a puzzle into numbers (feature engineering).

Only looks at the starting grid; it never solves the puzzle. That is the
point: the model must guess the difficulty from cheap clues, so it can score
thousands of candidate puzzles quickly.
"""
import math
import sudoku

NAMES = [
    "clues", "min_row_clues", "min_col_clues", "min_box_clues",
    "empty_boxes_lt3", "digits_missing_clues", "avg_candidates",
    "max_candidates", "cells_1_cand", "cells_2_cand", "cells_ge4_cand",
    "candidate_entropy", "min_unit_clues", "peers_filled_avg",
    "hidden_singles_at_start", "left_after_naked", "left_after_singles",
]


def _hidden_singles(cells, cand):
    found = {}
    for u in sudoku.UNITS:
        for v in sudoku.DIGITS:
            spots = [i for i in u if i in cand and v in cand[i]]
            if len(spots) == 1:
                found[spots[0]] = v
    return found


def _propagate(cells, use_hidden):
    """Fill in forced cells until stuck; return how many cells stay empty."""
    cells = list(cells)
    while True:
        cand = sudoku._candidates(cells)
        moves = {i: next(iter(s)) for i, s in cand.items() if len(s) == 1}
        if use_hidden and not moves:
            moves = _hidden_singles(cells, cand)
        if not moves or any(not s for s in cand.values()):
            return sum(1 for c in cells if c == 0)
        i, v = next(iter(moves.items()))
        cells[i] = v


def features(grid):
    cells = [int(c) for c in grid]
    cand = sudoku._candidates(cells)
    sizes = [len(s) for s in cand.values()] or [0]
    clues = 81 - len(cand)

    def per_unit(units):
        return [sum(1 for i in u if cells[i]) for u in units]

    rows, cols, boxes = (per_unit(sudoku.ROWS), per_unit(sudoku.COLS),
                         per_unit(sudoku.BOXES))
    counts = [sizes.count(k) for k in range(10)]
    total = sum(sizes) or 1
    entropy = -sum((s / total) * math.log(s / total) for s in sizes if s)
    digit_clues = [cells.count(d) for d in sudoku.DIGITS]
    peers_filled = [sum(1 for p in sudoku.PEERS[i] if cells[p]) for i in cand] or [0]
    return [
        clues, min(rows), min(cols), min(boxes),
        sum(1 for b in boxes if b < 3),
        sum(1 for n in digit_clues if n < 3),
        sum(sizes) / len(sizes), max(sizes),
        counts[1], counts[2], sum(counts[4:]),
        entropy, min(rows + cols + boxes),
        sum(peers_filled) / len(peers_filled),
        len(_hidden_singles(cells, cand)),
        _propagate(cells, False), _propagate(cells, True),
    ]
