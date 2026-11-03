"""Hint ranking: which of the available next moves is the best hint?

A "move" is a cell that can be filled by simple logic right now (a naked
single: only one digit fits; or a hidden single: a digit has only one place
in a row/column/box). Several moves usually exist. We learn to rank them.

Usefulness label (what a good hint does): moves that unlock more new easy
moves are better, and naked singles are easier to see, so they get a bonus.
  usefulness = new_moves_unlocked + 0.5 * is_naked
The features below are cheap and local; they do NOT include the label.
"""
import sudoku

NAMES = ["is_hidden", "cell_candidates", "row_fill", "col_fill", "box_fill",
         "digit_placed", "affected_peers", "empties"]


def moves(cells):
    """[(cell, digit, is_hidden)] for every move simple logic allows."""
    cand = sudoku._candidates(cells)
    found = {i: (next(iter(s)), 0) for i, s in cand.items() if len(s) == 1}
    for u in sudoku.UNITS:
        for v in sudoku.DIGITS:
            spots = [i for i in u if i in cand and v in cand[i]]
            if len(spots) == 1 and spots[0] not in found:
                found[spots[0]] = (v, 1)
    return [(i, v, h) for i, (v, h) in sorted(found.items())]


def features(cells, move):
    i, v, hidden = move
    cand = sudoku._candidates(cells)
    r, c = divmod(i, 9)
    b = (r // 3) * 3 + c // 3
    fill = lambda unit: sum(1 for j in unit if cells[j])
    return [
        hidden, len(cand[i]),
        fill(sudoku.ROWS[r]), fill(sudoku.COLS[c]), fill(sudoku.BOXES[b]),
        cells.count(v),
        sum(1 for p in sudoku.PEERS[i] if p in cand and v in cand[p]),
        len(cand),
    ]


def usefulness(cells, move):
    i, v, hidden = move
    before = {m[0] for m in moves(cells)} - {i}
    after_cells = list(cells)
    after_cells[i] = v
    after = {m[0] for m in moves(after_cells)}
    return len(after - before) + 0.5 * (1 - hidden)
