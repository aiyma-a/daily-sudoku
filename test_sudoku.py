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
