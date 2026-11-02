"""Sudoku generator, solver and human-technique rater.

Grids are 81-character strings, row by row; '0' means empty.
No third-party dependencies.
"""
import random

DIGITS = range(1, 10)
ROWS = [[r * 9 + c for c in range(9)] for r in range(9)]
COLS = [[r * 9 + c for r in range(9)] for c in range(9)]
BOXES = [[(br * 3 + r) * 9 + bc * 3 + c for r in range(3) for c in range(3)]
         for br in range(3) for bc in range(3)]
UNITS = ROWS + COLS + BOXES
PEERS = []
for i in range(81):
    s = set()
    for u in UNITS:
        if i in u:
            s.update(u)
    s.discard(i)
    PEERS.append(sorted(s))


# ---------------------------------------------------------------- solver
def count_solutions(grid, limit=2):
    """Count solutions of `grid`, stopping at `limit`. Backtracking, MRV."""
    cells = [int(ch) for ch in grid]
    row = [0] * 9
    col = [0] * 9
    box = [0] * 9
    for i, v in enumerate(cells):
        if v:
            b = 1 << v
            r, c = divmod(i, 9)
            if row[r] & b or col[c] & b or box[(r // 3) * 3 + c // 3] & b:
                return 0  # contradictory givens
            row[r] |= b
            col[c] |= b
            box[(r // 3) * 3 + c // 3] |= b
    found = 0

    def rec():
        nonlocal found
        best, best_mask, best_n = -1, 0, 10
        for i in range(81):
            if cells[i]:
                continue
            r, c = divmod(i, 9)
            mask = ~(row[r] | col[c] | box[(r // 3) * 3 + c // 3]) & 0x3FE
            n = bin(mask).count("1")
            if n < best_n:
                best, best_mask, best_n = i, mask, n
                if n <= 1:
                    break
        if best < 0:
            found += 1
            return
        if best_n == 0:
            return
        r, c = divmod(best, 9)
        b = (r // 3) * 3 + c // 3
        for v in DIGITS:
            bit = 1 << v
            if best_mask & bit:
                cells[best] = v
                row[r] |= bit
                col[c] |= bit
                box[b] |= bit
                rec()
                cells[best] = 0
                row[r] &= ~bit
                col[c] &= ~bit
                box[b] &= ~bit
                if found >= limit:
                    return

    rec()
    return found


def solve(grid):
    """Return the first solution string, or None."""
    cells = [int(ch) for ch in grid]

    def ok(i, v):
        r, c = divmod(i, 9)
        return all(cells[p] != v for p in PEERS[i])

    def rec():
        best, opts = -1, None
        for i in range(81):
            if cells[i] == 0:
                o = [v for v in DIGITS if ok(i, v)]
                if opts is None or len(o) < len(opts):
                    best, opts = i, o
                    if len(o) <= 1:
                        break
        if best < 0:
            return True
        for v in opts:
            cells[best] = v
            if rec():
                return True
        cells[best] = 0
        return False

    return "".join(map(str, cells)) if rec() else None


# ------------------------------------------------------------- generation
def random_full_grid(rng):
    """A complete valid grid: shuffle a base pattern, then relabel digits."""
    def pattern(r, c):
        return (3 * (r % 3) + r // 3 + c) % 9

    def shuffled(n=3):
        groups = list(range(n))
        rng.shuffle(groups)
        return [g * n + x for g in groups for x in rng.sample(range(n), n)]

    rows, cols = shuffled(), shuffled()
    nums = list(DIGITS)
    rng.shuffle(nums)
    return "".join(str(nums[pattern(r, c)]) for r in rows for c in cols)


def dig_holes(full, rng, target_clues):
    """Remove digits while the solution stays unique, down to target_clues."""
    cells = list(full)
    order = list(range(81))
    rng.shuffle(order)
    clues = 81
    for i in order:
        if clues <= target_clues:
            break
        keep = cells[i]
        cells[i] = "0"
        if count_solutions("".join(cells), 2) != 1:
            cells[i] = keep
        else:
            clues -= 1
    return "".join(cells)


# ----------------------------------------------------------------- rating
# Technique tiers, hardest one needed decides the tier of the puzzle:
#   1 naked single      (a cell has only one candidate)
#   2 hidden single     (a digit fits one place in a row/column/box)
#   3 locked candidates / naked pair
#   4 none of the above works (a guess is needed)
def _candidates(cells):
    cand = {}
    for i in range(81):
        if cells[i] == 0:
            used = {cells[p] for p in PEERS[i]}
            cand[i] = {v for v in DIGITS if v not in used}
    return cand


def rate(grid):
    """Solve like a person. Returns dict: tier, steps per technique."""
    cells = [int(ch) for ch in grid]
    steps = {"naked_single": 0, "hidden_single": 0,
             "locked_candidates": 0, "naked_pair": 0}
    while 0 in cells:
        cand = _candidates(cells)
        if any(not s for s in cand.values()):
            return {"tier": 4, "steps": steps, "solved": False}
        # 1. naked single
        for i, s in cand.items():
            if len(s) == 1:
                cells[i] = next(iter(s))
                steps["naked_single"] += 1
                break
        else:
            # 2. hidden single
            placed = False
            for u in UNITS:
                for v in DIGITS:
                    spots = [i for i in u if i in cand and v in cand[i]]
                    if len(spots) == 1 and v not in [cells[j] for j in u]:
                        cells[spots[0]] = v
                        steps["hidden_single"] += 1
                        placed = True
                        break
                if placed:
                    break
            if placed:
                continue
            # 3. eliminations (locked candidates, naked pairs)
            if _eliminate(cand, steps):
                # Eliminations are applied by writing back via a candidate
                # overlay: re-run with the reduced candidates.
                if not _solve_with_overlay(cells, cand, steps):
                    return {"tier": 4, "steps": steps, "solved": False}
                continue
            return {"tier": 4, "steps": steps, "solved": False}
    tier = 1
    if steps["hidden_single"]:
        tier = 2
    if steps["locked_candidates"] or steps["naked_pair"]:
        tier = 3
    return {"tier": tier, "steps": steps, "solved": True}


def _eliminate(cand, steps):
    """Apply one elimination technique to `cand` in place. True if it
    removed anything."""
    # locked candidates (pointing + claiming)
    for box in BOXES:
        for v in DIGITS:
            spots = [i for i in box if i in cand and v in cand[i]]
            if len(spots) < 2:
                continue
            for lines in (ROWS, COLS):
                shared = [ln for ln in lines if all(s in ln for s in spots)]
                if shared:
                    changed = False
                    for i in shared[0]:
                        if i in cand and i not in box and v in cand[i]:
                            cand[i].discard(v)
                            changed = True
                    if changed:
                        steps["locked_candidates"] += 1
                        return True
    for lines in (ROWS, COLS):
        for ln in lines:
            for v in DIGITS:
                spots = [i for i in ln if i in cand and v in cand[i]]
                if len(spots) < 2:
                    continue
                boxes = {b for b, bx in enumerate(BOXES)
                         if any(s in bx for s in spots)}
                if len(boxes) == 1:
                    changed = False
                    for i in BOXES[boxes.pop()]:
                        if i in cand and i not in ln and v in cand[i]:
                            cand[i].discard(v)
                            changed = True
                    if changed:
                        steps["locked_candidates"] += 1
                        return True
    # naked pairs
    for u in UNITS:
        pairs = [i for i in u if i in cand and len(cand[i]) == 2]
        for a in range(len(pairs)):
            for b in range(a + 1, len(pairs)):
                if cand[pairs[a]] == cand[pairs[b]]:
                    pv = cand[pairs[a]]
                    changed = False
                    for i in u:
                        if i in cand and i not in (pairs[a], pairs[b]):
                            if cand[i] & pv:
                                cand[i] -= pv
                                changed = True
                    if changed:
                        steps["naked_pair"] += 1
                        return True
    return False


def _solve_with_overlay(cells, cand, steps):
    """Continue the human solve keeping eliminations in `cand`."""
    while 0 in cells:
        progress = False
        for i in list(cand):
            if cells[i] == 0 and len(cand[i]) == 1:
                v = next(iter(cand[i]))
                _place(cells, cand, i, v)
                steps["naked_single"] += 1
                progress = True
        for u in UNITS:
            for v in DIGITS:
                if v in [cells[j] for j in u]:
                    continue
                spots = [i for i in u if i in cand and v in cand[i]]
                if len(spots) == 1:
                    _place(cells, cand, spots[0], v)
                    steps["hidden_single"] += 1
                    progress = True
        if any(i in cand and not cand[i] for i in cand):
            return False
        if not progress:
            if not _eliminate(cand, steps):
                return False
    return True


def _place(cells, cand, i, v):
    cells[i] = v
    cand.pop(i, None)
    for p in PEERS[i]:
        if p in cand:
            cand[p].discard(v)


# Target (clue range, tier) per difficulty.
LEVELS = {
    "easy":   {"clues": (36, 42), "tier": 1},
    "medium": {"clues": (30, 35), "tier": 2},
    "hard":   {"clues": (24, 29), "tier": 3},
}


def make_puzzle(level, seed, max_tries=400):
    """Return (puzzle, solution, rating) for `level`, deterministic in seed."""
    spec = LEVELS[level]
    rng = random.Random(f"{seed}:{level}")
    lo, hi = spec["clues"]
    for _ in range(max_tries):
        full = random_full_grid(rng)
        puzzle = dig_holes(full, rng, rng.randint(lo, hi))
        r = rate(puzzle)
        if r["solved"] and r["tier"] == spec["tier"]:
            return puzzle, full, r
    raise RuntimeError(f"no {level} puzzle found for seed {seed}")
