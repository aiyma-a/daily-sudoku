"""Train the mistake detector (a classifier) and report how it does.

Compared with the obvious rule "chance of being right = 1 / number of
candidates". Metrics: AUC (1.0 perfect, 0.5 coin flip) and log-loss
(lower is better, measures whether the probabilities are honest).
"""
import csv, json, os
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, log_loss, accuracy_score
from ml.mistakes import NAMES

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "ml", "mistake_model.json")


def main():
    rows = list(csv.DictReader(open(os.path.join(HERE, "data", "mistakes.csv"))))
    board = np.array([int(r["board"]) for r in rows])
    X = np.array([[float(r[n]) for n in NAMES] for r in rows])
    y = np.array([int(r["correct"]) for r in rows])
    ids = np.unique(board)
    test_ids = set(np.random.RandomState(0).choice(ids, len(ids) // 5, replace=False))
    te = np.array([b in test_ids for b in board])
    clf = GradientBoostingClassifier(n_estimators=100, max_depth=3, learning_rate=0.1,
                                     subsample=0.8, random_state=0).fit(X[~te], y[~te])
    p = clf.predict_proba(X[te])[:, 1]
    base = np.clip(1.0 / X[te][:, 0], 0.01, 0.99)
    res = {
        "model": (roc_auc_score(y[te], p), log_loss(y[te], p), accuracy_score(y[te], p > .5)),
        "1/candidates rule": (roc_auc_score(y[te], base), log_loss(y[te], base),
                              accuracy_score(y[te], base > .5)),
    }
    print(f"{len(y)} entries ({te.sum()} unseen), {y.mean():.0%} were correct")
    for k, (auc, ll, acc) in res.items():
        print(f"  {k:18s} AUC {auc:.3f}  log-loss {ll:.3f}  accuracy {acc:.0%}")

    # raw score = init + lr * sum(trees); recover init from one row
    x0 = X[:1]
    trees = [e.tree_.value[:, 0, 0] for e in clf.estimators_[:, 0]]
    leaf = [e.apply(x0.astype(np.float32))[0] for e in clf.estimators_[:, 0]]
    init = float(clf.decision_function(x0)[0]) - clf.learning_rate * sum(t[l] for t, l in zip(trees, leaf))
    from ml.train import export_trees
    class _W:  # reuse the tree exporter
        estimators_ = clf.estimators_
        learning_rate = clf.learning_rate
        class init_:
            constant_ = np.array([[init]])
    m = export_trees(_W, NAMES)
    m["metrics"] = {k: {"auc": round(v[0], 3), "logloss": round(v[1], 3), "acc": round(v[2], 3)}
                    for k, v in res.items()}
    json.dump(m, open(OUT, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
