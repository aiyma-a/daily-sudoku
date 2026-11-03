import time, unittest
import sudoku as S

class T(unittest.TestCase):
    def test_full_grid_valid(self):
        import random
        g = S.random_full_grid(random.Random(1))
        for u in S.UNITS:
            self.assertEqual(sorted(g[i] for i in u), list("123456789"))

    def test_levels_unique_and_rated(self):
        for level in S.LEVELS:
            for seed in ("2026-11-02", "2026-11-03"):
                p, sol, r = S.make_puzzle(level, seed)
                self.assertEqual(S.count_solutions(p, 2), 1)
                self.assertEqual(S.solve(p), sol)
                self.assertTrue(all(a == b or a == "0" for a, b in zip(p, sol)))
                self.assertEqual(r["tier"], S.LEVELS[level]["tier"])

    def test_deterministic(self):
        self.assertEqual(S.make_puzzle("easy", "x")[0], S.make_puzzle("easy", "x")[0])

    def test_days_differ(self):
        self.assertNotEqual(S.make_puzzle("easy", "a")[0], S.make_puzzle("easy", "b")[0])

    def test_rejects_multi_solution(self):
        self.assertGreater(S.count_solutions("0" * 81, 2), 1)

if __name__ == "__main__":
    unittest.main()


class TestDifficultyModel(unittest.TestCase):
    def test_features_are_cheap_and_fixed_length(self):
        from ml.features import features, NAMES
        p, _, _ = S.make_puzzle("easy", "2026-01-01")
        self.assertEqual(len(features(p)), len(NAMES))

    def test_model_orders_levels(self):
        from ml import predict
        mean = {}
        for lv in S.LEVELS:
            scores = [predict.score(S.make_puzzle(lv, f"t{i}")[0]) for i in range(8)]
            mean[lv] = sum(scores) / len(scores)
        self.assertLess(mean["easy"], mean["medium"])
        self.assertLess(mean["medium"], mean["hard"])

    def test_pure_python_matches_sklearn(self):
        import csv, os
        from ml import predict
        path = os.path.join(os.path.dirname(__file__), "ml", "data", "puzzles.csv")
        if not os.path.exists(path):
            self.skipTest("no training data")
        rows = list(csv.DictReader(open(path)))[:20]
        err = [abs(predict.score(r["puzzle"]) - float(r["effort"])) for r in rows]
        self.assertLess(sum(err) / len(err), 20)


class TestNightlyPick(unittest.TestCase):
    def test_pick_matches_level_and_is_deterministic(self):
        import generate
        from ml import predict
        for lv in S.LEVELS:
            a = generate.best_puzzle(lv, "2027-02-01", n=12)
            b = generate.best_puzzle(lv, "2027-02-01", n=12)
            self.assertEqual(a[0], b[0])
            self.assertEqual(S.count_solutions(a[0], 2), 1)
            self.assertEqual(predict.level(a[3]), lv)


class TestHintParity(unittest.TestCase):
    def test_js_and_python_pick_same_hint(self):
        import json, os, random, shutil, subprocess, tempfile
        node = shutil.which("node")
        model_path = os.path.join(os.path.dirname(__file__), "docs", "ml", "hint_model.json")
        if not node or not os.path.exists(model_path):
            self.skipTest("node or hint model missing")
        from ml import hints
        model = json.load(open(model_path))

        def py_best(cells):
            best = None
            for m in hints.moves(cells):
                x = hints.features(cells, m)
                s = model["init"]
                for t in model["trees"]:
                    n = 0
                    while t["l"][n] != -1:
                        n = t["l"][n] if x[t["f"][n]] <= t["t"][n] else t["r"][n]
                    s += model["lr"] * t["v"][n]
                if best is None or s > best[2]:
                    best = (m[0], m[1], s)
            return best

        rng = random.Random(5)
        boards = []
        for k in range(15):
            p, _, _ = S.make_puzzle(rng.choice(list(S.LEVELS)), f"parity{k}")
            cells = [int(c) for c in p]
            for _ in range(rng.randint(0, 25)):
                ms = hints.moves(cells)
                if not ms:
                    break
                i, v, _h = rng.choice(ms)
                cells[i] = v
            if hints.moves(cells):
                boards.append(cells)
        expected = [py_best(b) for b in boards]
        js = ("const H=require('./docs/hint.js');const m=require('./docs/ml/hint_model.json');"
              "const bs=JSON.parse(process.argv[1]);"
              "console.log(JSON.stringify(bs.map(b=>{const p=H.best(m,b);return [p.cell,p.digit,p.score]})))")
        out = subprocess.run([node, "-e", js, json.dumps(boards)], capture_output=True,
                             text=True, cwd=os.path.dirname(os.path.abspath(__file__)))
        self.assertEqual(out.returncode, 0, out.stderr)
        got = json.loads(out.stdout)
        for e, g in zip(expected, got):
            self.assertEqual((e[0], e[1]), (g[0], g[1]))
            self.assertAlmostEqual(e[2], g[2], places=6)


class TestSkillLearner(unittest.TestCase):
    def test_learner_adapts_to_a_simulated_player(self):
        """A fast player and a slow player: after 12 solves the model's time
        guess should be much closer than the starting guess, and the "just
        right" pick should differ between them."""
        import json, os, shutil, subprocess
        node = shutil.which("node")
        if not node:
            self.skipTest("node missing")
        js = r"""
const S = require('./docs/skill.js');
function player(a, b) {            // true log-time = a + b*score/100, plus noise
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return (score) => Math.exp(a + b * score / 100 + (rnd() - 0.5) * 0.3);
}
const scores = [40, 70, 130];
function run(a, b) {
  const solve = player(a, b); let m = {...S.PRIOR};
  const err = (m) => scores.reduce((t, s) => t + Math.abs(Math.log(S.expectedSeconds(m, s)) - (a + b * s / 100)), 0) / 3;
  const before = err(m);
  for (let i = 0; i < 12; i++) { const s = scores[i % 3]; m = S.update(m, s, solve(s), 0); }
  const opts = scores.map((s, i) => ({ level: ['easy', 'medium', 'hard'][i], score: s }));
  return { before, after: err(m), pick: S.recommend(m, opts).level };
}
console.log(JSON.stringify({ fast: run(Math.log(120), 0.9), slow: run(Math.log(700), 0.7) }));
"""
        out = subprocess.run([node, "-e", js], capture_output=True, text=True,
                             cwd=os.path.dirname(os.path.abspath(__file__)))
        self.assertEqual(out.returncode, 0, out.stderr)
        r = json.loads(out.stdout)
        for who in ("fast", "slow"):
            self.assertLess(r[who]["after"], r[who]["before"] * 0.6)
        self.assertNotEqual(r["fast"]["pick"], r["slow"]["pick"])
