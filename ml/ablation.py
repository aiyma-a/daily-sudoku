"""Measure what the key feature adds: retrain the difficulty model on the same
split with and without `left_after_singles`, and record the test R2 in
docs/ml/summary.json for the "How it works" page.
Run after `python3 -m ml.summary`: python3 -m ml.ablation"""
import json, os
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split
from ml.features import NAMES
from ml.train import load

KEY = "left_after_singles"
SUMMARY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "ml", "summary.json")


def r2_without(X, y, drop):
    keep = [i for i, n in enumerate(NAMES) if n != drop]
    Xtr, Xte, ytr, yte = train_test_split(X[:, keep], y, test_size=0.2, random_state=0)
    # same settings as ml/train.py
    m = GradientBoostingRegressor(n_estimators=150, max_depth=3, learning_rate=0.1,
                                  subsample=0.8, random_state=0).fit(Xtr, ytr)
    return r2_score(yte, m.predict(Xte))


def main():
    X, y = load()
    without = round(float(r2_without(X, y, KEY)), 3)
    s = json.load(open(SUMMARY))
    s["difficulty"]["r2_without_key_feature"] = without
    s["difficulty"]["key_feature"] = KEY
    json.dump(s, open(SUMMARY, "w"), indent=1)
    print(f"R2 without {KEY}: {without}")


if __name__ == "__main__":
    main()
