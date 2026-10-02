"""Reference computed by installed sklearn, independent of browser formulas."""
from pathlib import Path
import itertools
import json
import math
import numpy as np
import sklearn
from sklearn.metrics import (accuracy_score, balanced_accuracy_score,
                             precision_recall_fscore_support, recall_score)

ROOT = Path(__file__).resolve().parent.parent
rows = []
def finite_or_null(value):
    return float(value) if math.isfinite(float(value)) else None
for tp, fp, fn, tn in itertools.product(range(5), repeat=4):
    truth = [1]*(tp+fn)+[0]*(fp+tn)
    prediction = [1]*tp+[0]*fn+[1]*fp+[0]*tn
    if not truth:
        continue  # sklearn rejects empty data; test our empty-count convention separately.
    p,r,f,_ = precision_recall_fscore_support(truth, prediction, labels=[1], zero_division=np.nan)
    specificity = recall_score(truth, prediction, pos_label=0, zero_division=np.nan)
    rows.append({'counts': {'tp':tp,'fp':fp,'fn':fn,'tn':tn}, 'metrics': {
        'accuracy': float(accuracy_score(truth,prediction)) if truth else None,
        'precision': finite_or_null(p[0]),'recall': finite_or_null(r[0]),'f1': finite_or_null(f[0]),
        'specificity': finite_or_null(specificity),
        # Our tutorial requires BOTH actual classes for the two-class mean.
        'balancedAccuracy': float(balanced_accuracy_score(truth,prediction)) if tp+fn>0 and tn+fp>0 else None}})
result={'sklearnVersion':sklearn.__version__,'cases':rows,'zeroDivision':'NaN represented as null; balanced accuracy requires both actual classes.'}
(ROOT/'tests/metrics-reference.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n',encoding='utf-8')
print(f'Generated {len(rows)} independent metric references using sklearn {sklearn.__version__}.')
