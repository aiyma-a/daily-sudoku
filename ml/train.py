"""Train the difficulty model and write ml/model.json + docs/ml/ charts.

Compares three models so we can see what the ML actually adds:
  1. baseline: always predict the average (the "dumb" model)
  2. linear regression on clue count only
  3. gradient-boosted trees on all engineered features  <- shipped

Usage: python3 -m ml.train
"""
import csv, json, os
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split, cross_val_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from ml.features import NAMES

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "puzzles.csv")
MODEL = os.path.join(HERE, "model.json")
CHARTS = os.path.join(HERE, "..", "docs", "ml")


def load():
    rows = list(csv.DictReader(open(DATA)))
    X = np.array([[float(r[n]) for n in NAMES] for r in rows])
    y = np.array([float(r["effort"]) for r in rows])
    return X, y


def export_trees(model, base_names):
    trees = []
    for est in model.estimators_[:, 0]:
        t = est.tree_
        trees.append({"f": t.feature.tolist(), "t": t.threshold.tolist(),
                      "l": t.children_left.tolist(), "r": t.children_right.tolist(),
                      "v": t.value[:, 0, 0].tolist()})
    return {"features": base_names, "init": float(model.init_.constant_[0][0]),
            "lr": model.learning_rate, "trees": trees}


def main():
    X, y = load()
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)
    results = {}

    mean = ytr.mean()
    results["average (dumb baseline)"] = (mean_absolute_error(yte, [mean] * len(yte)), 0.0)
    lin = LinearRegression().fit(Xtr[:, [0]], ytr)
    p = lin.predict(Xte[:, [0]])
    results["linear on clue count"] = (mean_absolute_error(yte, p), r2_score(yte, p))
    gbr = GradientBoostingRegressor(n_estimators=150, max_depth=3, learning_rate=0.1,
                                    subsample=0.8, random_state=0)
    cv = cross_val_score(gbr, Xtr, ytr, cv=5, scoring="r2")
    gbr.fit(Xtr, ytr)
    p = gbr.predict(Xte)
    results["gradient-boosted trees (shipped)"] = (mean_absolute_error(yte, p), r2_score(yte, p))

    print(f"{len(y)} puzzles, {len(ytr)} train / {len(yte)} test")
    for k, (mae, r2) in results.items():
        print(f"  {k:36s} MAE {mae:6.1f}   R2 {r2:5.2f}")
    print(f"  5-fold CV R2 on train: {cv.mean():.2f} +/- {cv.std():.2f}")

    model = export_trees(gbr, NAMES)
    model["metrics"] = {k: {"mae": round(v[0], 2), "r2": round(v[1], 3)} for k, v in results.items()}
    model["n_puzzles"] = int(len(y))
    model["importance"] = dict(zip(NAMES, [round(float(x), 4) for x in gbr.feature_importances_]))
    json.dump(model, open(MODEL, "w"), separators=(",", ":"))

    os.makedirs(CHARTS, exist_ok=True)
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.scatter(yte, p, s=6, alpha=.35, color="#6a4fb3")
    m = max(yte.max(), p.max())
    ax.plot([0, m], [0, m], color="#999", lw=1)
    ax.set_xlabel("Real difficulty (solver effort)")
    ax.set_ylabel("Model's guess")
    ax.set_title(f"Unseen puzzles: R² = {results['gradient-boosted trees (shipped)'][1]:.2f}")
    fig.tight_layout(); fig.savefig(os.path.join(CHARTS, "predicted_vs_real.png"), dpi=110)
    fig, ax = plt.subplots(figsize=(6, 4))
    imp = sorted(zip(gbr.feature_importances_, NAMES))[-8:]
    ax.barh([n for _, n in imp], [v for v, _ in imp], color="#e08a2c")
    ax.set_title("What the model looks at")
    fig.tight_layout(); fig.savefig(os.path.join(CHARTS, "importance.png"), dpi=110)


if __name__ == "__main__":
    main()
