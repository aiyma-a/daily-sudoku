"""Collect every model's test results into docs/ml/summary.json for the
"How it works" page. Run after retraining: python3 -m ml.summary"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "..", "docs", "ml")
load = lambda p: json.load(open(p))

def main():
    diff, hint, mist = load(os.path.join(HERE, "model.json")), load(os.path.join(D, "hint_model.json")), load(os.path.join(D, "mistake_model.json"))
    out = {
        "difficulty": {"puzzles": diff["n_puzzles"], "r2": {k: v["r2"] for k, v in diff["metrics"].items()},
                       "top_features": sorted(diff["importance"].items(), key=lambda kv: -kv[1])[:6]},
        "hint": {"regret": hint["metrics"], "top1": hint["top1"]},
        "mistake": {"auc": {k: v["auc"] for k, v in mist["metrics"].items()},
                    "acc": {k: v["acc"] for k, v in mist["metrics"].items()}},
    }
    json.dump(out, open(os.path.join(D, "summary.json"), "w"), indent=1)
    print("wrote summary.json")

if __name__ == "__main__":
    main()
