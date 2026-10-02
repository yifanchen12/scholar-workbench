"""Train two fixed educational baselines once; export tiny browser models."""
from pathlib import Path
import json
import numpy as np
import sklearn
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, log_loss

ROOT=Path(__file__).resolve().parent.parent
SEED=2025
digits=load_digits()
indices=np.arange(len(digits.target))
train_idx,test_idx=train_test_split(indices,test_size=.2,random_state=SEED,stratify=digits.target)
X=digits.data/16.0;y=digits.target
linear=LogisticRegression(C=2.0,max_iter=2000,solver='lbfgs',random_state=SEED)
network=MLPClassifier(hidden_layer_sizes=(32,),activation='relu',solver='adam',alpha=.0005,batch_size=64,max_iter=300,early_stopping=True,validation_fraction=.15,n_iter_no_change=20,random_state=SEED)
models={'linear':linear,'network':network}
reports={}
for name,model in models.items():
    model.fit(X[train_idx],y[train_idx])
    pred=model.predict(X[test_idx]);probs=model.predict_proba(X[test_idx])
    reports[name]={'trainAccuracy':float(model.score(X[train_idx],y[train_idx])),'testAccuracy':float(accuracy_score(y[test_idx],pred)),'testLogLoss':float(log_loss(y[test_idx],probs)),'confusionMatrix':confusion_matrix(y[test_idx],pred,labels=np.arange(10)).tolist(),'iterations':int(model.n_iter_ if name=='network' else model.n_iter_[0]),'testErrors':int(np.sum(pred!=y[test_idx]))}
report={'seed':SEED,'totalSamples':len(y),'trainPoolSamples':len(train_idx),'testSamples':len(test_idx),'normalization':'Each pixel / 16; fixed range, no statistics fitted on test data.','split':'Stratified random 80/20 split of sklearn load_digits; not a writer-held-out evaluation.','sklearnVersion':sklearn.__version__,'models':reports,'testUsedForModelSelection':False,'notes':['Both fixed model configurations trained once.','MLP early stopping uses only a validation subset of the training pool.','Softmax outputs are not calibrated confidence guarantees for new handwriting.','This is not MNIST.']}
report['source']={'title':'Optical Recognition of Handwritten Digits','authors':['E. Alpaydin','C. Kaynak'],'year':1998,'doi':'10.24432/C50P49','url':'https://archive.ics.uci.edu/dataset/80/optical+recognition+of+handwritten+digits','license':'CC BY 4.0','licenseURL':'https://creativecommons.org/licenses/by/4.0/','adaptation':'Models trained on a new random split of sklearn load_digits; selected test samples are displayed as pixel arrays.'}
report['configuration']={name:model.get_params() for name,model in models.items()}
def array(value):return np.asarray(value).round(10).tolist()
model_data={'metadata':report,'linear':{'weights':array(linear.coef_),'bias':array(linear.intercept_)},'network':{'weights1':array(network.coefs_[0]),'bias1':array(network.intercepts_[0]),'weights2':array(network.coefs_[1]),'bias2':array(network.intercepts_[1])},'examples':[],'mistakes':[]}
for label in range(10):
    pool=[i for i in test_idx if y[i]==label]
    for i in pool[:3]:model_data['examples'].append({'label':int(label),'pixels':digits.data[i].astype(int).tolist(),'testIndex':int(i)})
pred=network.predict(X[test_idx])
for pos in np.flatnonzero(pred!=y[test_idx])[:12]:
    i=int(test_idx[pos]);model_data['mistakes'].append({'label':int(y[i]),'prediction':int(pred[pos]),'pixels':digits.data[i].astype(int).tolist(),'testIndex':i})
reference=[]
for i in test_idx[:100]:
    reference.append({'pixels':digits.data[i].astype(int).tolist(),'label':int(y[i]),'linear':linear.predict_proba(X[i:i+1])[0].tolist(),'network':network.predict_proba(X[i:i+1])[0].tolist()})
(ROOT/'docs/digits-training-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'tests/digits-reference.json').write_text(json.dumps(reference,separators=(',',':'))+'\n',encoding='utf-8')
(ROOT/'digits-model.js').write_text('/* Educational models and adapted UCI digit samples; attribution: docs/数字分类模型说明.md */\nglobalThis.DigitsModel = '+json.dumps(model_data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps({'trainPool':len(train_idx),'test':len(test_idx),'linearAccuracy':reports['linear']['testAccuracy'],'networkAccuracy':reports['network']['testAccuracy'],'networkErrors':reports['network']['testErrors'],'modelBytes':(ROOT/'digits-model.js').stat().st_size},ensure_ascii=False))
