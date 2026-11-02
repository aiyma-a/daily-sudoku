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
