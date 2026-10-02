"""Build and execute this project's own notebook cells; no Jupyter install."""
import contextlib
import io
import json
import platform
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
cells = []


def markdown(source):
    cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': source.splitlines(True)})


def code(source):
    cells.append({'cell_type': 'code', 'metadata': {}, 'source': source.splitlines(True),
                  'execution_count': None, 'outputs': []})


markdown(r'''# 从梯度到分类：一份可自己修改的实训

配套邮研工作台「AI小实验」。这是自编基础练习，不是北邮教材或课程安排。

**路线：** 手算一轮更新 → 稳定Softmax → 训练侧预处理 → 反向传播 → 梯度核对 → 验证选轮次 → 测试与误判。

运行环境只需Python标准库；Notebook阅读/交互需要支持`.ipynb`的编辑器。没有Notebook环境时，直接运行`python practice/run_lab.py`也会生成完整报告与图。

每节先预测输出，再执行。想换学习率时先复制报告，避免覆盖自己的实验记录。
''')
code('''import sys
from pathlib import Path

folder = Path.cwd()
if not (folder / "math_lab.py").exists():
    folder = folder / "practice"
if not (folder / "math_lab.py").exists():
    raise FileNotFoundError("请把Notebook和配套Python文件放在同一practice目录中打开。")
sys.path.insert(0, str(folder))
from math_lab import (softmax, regression_loss_gradient, make_data, fit_scaler,
                      transform, init_model, forward, loss_gradient, update,
                      gradient_check, train, evaluate)
print("环境就绪；没有下载数据或调用在线模型。")
''')
markdown(r'''## 1. 手算一次梯度下降

数据为 $y=2x+1$，$x\in\{-2,-1,0,1,2\}$。损失约定 $L=\frac1{2m}\sum_i(wx_i+b-y_i)^2$。

在$w=b=0$、$\eta=0.1$时，先写出$L$、$\partial L/\partial w$、$\partial L/\partial b$和新参数。两项梯度必须来自同一份旧参数。
''')
code('''points = [(-2,-3), (-1,-1), (0,1), (1,3), (2,5)]
w, b, rate = 0.0, 0.0, 0.1
loss, dw, db = regression_loss_gradient(points, w, b)
w_new, b_new = w - rate*dw, b - rate*db
print({"oldLoss": loss, "dw": dw, "db": db, "newW": w_new, "newB": b_new})
print("更新后损失", regression_loss_gradient(points, w_new, b_new)[0])
assert (loss, dw, db) == (4.5, -4.0, -1.0)
assert (w_new, b_new) == (0.4, 0.1)
''')
markdown(r'''**改一处再解释：** 如果把损失改成平均平方误差而没有$1/2$，梯度会怎样变？保持相同更新幅度，学习率该怎样改？答案见实训手册，先自己推。

## 2. Softmax为什么要减最大值？

$p_k=e^{z_k}/\sum_j e^{z_j}$。对每个分数减同一个常数不改变概率，却能让指数的输入不大于0。Softmax把分数归一化，不能保证识别正确。
''')
code('''large = softmax([10000.0, 10001.0, 9999.0])
small = softmax([0.0, 1.0, -1.0])
print("大分数的稳定结果", large)
print("平移后的结果", small)
print("概率和", sum(large))
assert all(abs(a-b) < 1e-12 for a,b in zip(large,small))
''')
markdown(r'''## 3. 先划分，再拟合预处理

用固定种子生成四个二维高斯簇。同号的两个角为类别1，异号的两个角为类别0。标签由生成簇确定，不在预测时读取规则。这是合成XOR形状，不是手写数字数据。

每个簇按60/20/20划为训练、验证、测试。均值和标准差只从训练集求得；三份数据都应用同一变换。
''')
code('''raw_train, raw_val, raw_test = make_data(seed=2025)
scaler = fit_scaler(raw_train)
train_data = transform(raw_train, scaler)
val_data = transform(raw_val, scaler)
test_data = transform(raw_test, scaler)
print("样本数", len(train_data), len(val_data), len(test_data))
print("训练侧统计量", scaler)
print("训练变换后均值", [sum(x[j] for x,y in train_data)/len(train_data) for j in range(2)])
assert (len(train_data),len(val_data),len(test_data)) == (240,80,80)
''')
markdown(r'''## 4. 矩阵方向与反向传播

源码约定`W[输出编号][输入编号]`。线性模型是2→2；网络是2→8 ReLU→2，最后用Softmax。

平均交叉熵对单样本分数的导数为$p_k-\mathbf1[k=y]$；线性层对权重的导数是“本层输出梯度×输入值”；ReLU在负区间梯度为0，在正区间为1。本例把0点导数定义为0。

先读`math_lab.py`中的`forward`和`loss_gradient`，再看以下核对。有限差分是独立于反向公式的数值近似；如果样本恰好踩在ReLU折点，中心差分可能不一致。
''')
code('''linear_initial = init_model(hidden=0, seed=2025)
network_initial = init_model(hidden=8, seed=2025)
for name, model in [("linear",linear_initial),("relu8",network_initial)]:
    check = gradient_check(model, train_data[:8])
    print(name, check)
    assert check["maxAbsoluteError"] < 1e-6
''')
markdown(r'''## 5. 先验证选轮次，最后看测试

设置预先固定：全批量梯度下降、学习率0.1、600轮。每一轮计算验证损失，保留验证损失最小的快照。测试集不参与参数更新和选轮次。

**先预测：** 一个直线分类边界能把四个角的XOR类别完全分开吗？隐藏层为什么可能改变可表示的形状？
''')
code('''trained = {}
for name, initial in [("linear",linear_initial),("relu8",network_initial)]:
    model, history, selected_epoch = train(initial, train_data, val_data, epochs=600, learning_rate=0.1)
    trained[name] = (model, history)
    print(name, "验证选中轮次", selected_epoch)
    print("训练", evaluate(model, train_data))
    print("验证", evaluate(model, val_data))
    print("测试", evaluate(model, test_data))
''')
markdown(r'''## 6. 保存能复查的实验

运行下方代码，生成两张独立SVG图：训练/验证曲线与原坐标下的决策区域。测试点只在训练后用于展示；背景颜色表示模型概率，点的颜色是真实标签。
''')
code('''from run_lab import run
report = run(epochs=600, learning_rate=0.1)
assert report["classification"]["relu8"]["test"]["samples"] == 80
''')
markdown(r'''![线性模型](output/linear.svg)

![8单元ReLU网络](output/relu8.svg)

## 7. 自己做三次小实验

1. 只改变学习率，先写下对训练曲线的预测。一次下降不能证明所有轮次都下降。
2. 只改变隐藏单元数。比较验证结果；决定配置之后才做一次最终测试。频繁看测试结果调配置，会把测试集变成隐含验证集。
3. 只改变随机种子。记录生成数据与初始权重哪一项改变，不把单次结果当成定理。

**记录模板：** 问题 / 预测 / 固定条件 / 唯一改动 / 训练现象 / 验证决策 / 最终测试 / 不能得出的结论。

完整参考解释、12道自测题与实验记录页见`实训手册.md`。网页的digits指标与这里的合成样本指标不能混用。
''')

namespace = {'__name__': '__notebook__'}
sys.path.insert(0, str(ROOT))
execution = 0
for cell in cells:
    if cell['cell_type'] != 'code':
        continue
    execution += 1
    capture = io.StringIO()
    with contextlib.redirect_stdout(capture):
        exec(compile(''.join(cell['source']), f'notebook_cell_{execution}', 'exec'), namespace)
    cell['execution_count'] = execution
    if capture.getvalue():
        cell['outputs'] = [{'output_type': 'stream', 'name': 'stdout', 'text': capture.getvalue().splitlines(True)}]
notebook = {'nbformat': 4, 'nbformat_minor': 5, 'metadata': {
    'kernelspec': {'name': 'python3', 'display_name': 'Python 3', 'language': 'python'},
    'language_info': {'name': 'python', 'version': platform.python_version()},
    'execution_note': 'Executed all own code cells with Python standard-library exec; not a claim of Jupyter UI testing.'}, 'cells': cells}
for i, cell in enumerate(cells):
    cell['id'] = f'lesson-{i+1:02d}'
(ROOT/'从梯度到分类.ipynb').write_text(json.dumps(notebook, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Built notebook: {len(cells)} cells, {execution} executed code cells, all assertions passed.')
