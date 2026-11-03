"""Train the hint ranker and report how good its top pick is.

Metric: "regret" = how much usefulness the model's pick loses compared with
the best possible move on that board (0 is perfect). Compared with picking
randomly and with the simple rule "always take the first move found".
"""
import csv, json, os, random
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from ml.hints import NAMES
from ml.train import export_trees

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "ml", "hint_model.json")


def main():
    rows = list(csv.DictReader(open(os.path.join(HERE, "data", "hints.csv"))))
    board = np.array([int(r["board"]) for r in rows])
    X = np.array([[float(r[n]) for n in NAMES] for r in rows])
    y = np.array([float(r["usefulness"]) for r in rows])
    ids = np.unique(board)
    rng = np.random.RandomState(0)
    test_ids = set(rng.choice(ids, size=len(ids) // 5, replace=False))
    te = np.array([b in test_ids for b in board])
    model = GradientBoostingRegressor(n_estimators=120, max_depth=3, learning_rate=0.1,
                                      subsample=0.8, random_state=0)
    model.fit(X[~te], y[~te])
    pred = model.predict(X)

    regret = {"model": [], "random": [], "first move": []}
    hit = 0
    pyr = random.Random(0)
    for b in test_ids:
        idx = np.where(board == b)[0]
        best = y[idx].max()
        pick = idx[np.argmax(pred[idx])]
        regret["model"].append(best - y[pick])
        regret["random"].append(best - y[pyr.choice(list(idx))])
        regret["first move"].append(best - y[idx[0]])
        hit += y[pick] == best
    print(f"{len(ids)} boards ({len(test_ids)} unseen), {len(y)} moves")
    for k, v in regret.items():
        print(f"  {k:11s} average regret {np.mean(v):.2f}")
    print(f"  model picks a best move on {hit / len(test_ids):.0%} of unseen boards")

    m = export_trees(model, NAMES)
    m["metrics"] = {k: round(float(np.mean(v)), 3) for k, v in regret.items()}
    m["top1"] = round(hit / len(test_ids), 3)
    m["importance"] = dict(zip(NAMES, [round(float(x), 4) for x in model.feature_importances_]))
    json.dump(m, open(OUT, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
