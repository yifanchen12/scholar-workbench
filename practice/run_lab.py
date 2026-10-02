"""Run three small experiments: python practice/run_lab.py [--epochs 600]."""
import argparse
import json
import math
import platform
from pathlib import Path
from math_lab import (evaluate, fit_scaler, forward, gradient_check, init_model,
                      make_data, regression_loss_gradient, train, transform)

ROOT = Path(__file__).resolve().parent


def regression_experiment():
    points = [(-2, -3), (-1, -1), (0, 1), (1, 3), (2, 5)]
    weight, bias, history = 0., 0., []
    for step in range(81):
        loss, dw, db = regression_loss_gradient(points, weight, bias)
        history.append({'step': step, 'weight': weight, 'bias': bias, 'loss': loss})
        # Simultaneous update: dw/db refer to the same old w/b.
        if step < 80:
            weight, bias = weight - .1 * dw, bias - .1 * db
    return {'points': points, 'learningRate': .1, 'lossConvention': 'SSE/(2*n)',
            'analyticalSolution': {'weight': 2, 'bias': 1}, 'history': history}


def classification_figure(model, history, raw_test, scaler, filename, title):
    """Standalone SVG: loss curves and a decision map in original coordinates."""
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="620" viewBox="0 0 1040 620">',
             '<rect width="1040" height="620" fill="white"/>',
             '<style>text{font-family:Arial,sans-serif;fill:#263650;font-size:15px}</style>',
             f'<text x="45" y="42" style="font-size:23px">{title}</text>',
             '<text x="45" y="75">Mean cross-entropy: training (blue), validation (orange)</text>',
             '<text x="565" y="75">Background: P(class 1); dots: true test labels</text>']
    left, top, width, height = 55, 110, 420, 390
    largest = max(max(row['trainLoss'], row['validationLoss']) for row in history) * 1.1
    max_epoch = max(row['epoch'] for row in history) or 1
    for i in range(5):
        y = top + height * i / 4
        value = largest * (1 - i / 4)
        parts.append(f'<path d="M{left} {y}h{width}" stroke="#e4eaf2"/>')
        parts.append(f'<text x="{left-8}" y="{y+5}" text-anchor="end">{value:.2f}</text>')
    for key, color in [('trainLoss', '#245cd8'), ('validationLoss', '#c77920')]:
        coordinates = ' '.join(f'{left+row["epoch"]/max_epoch*width:.2f},{top+height-row[key]/largest*height:.2f}' for row in history)
        parts.append(f'<polyline points="{coordinates}" fill="none" stroke="{color}" stroke-width="3"/>')
    parts.append(f'<path d="M{left} {top}v{height}h{width}" fill="none" stroke="#8396b2"/>')
    parts.append(f'<text x="{left}" y="{top+height+28}">0</text><text x="{left+width}" y="{top+height+28}" text-anchor="end">{max_epoch} epochs</text>')
    bx, by, size, count = 565, 110, 390, 40
    lo, hi = -1.25, 1.25
    def position(x):
        return bx+(x[0]-lo)/(hi-lo)*size, by+(hi-x[1])/(hi-lo)*size
    for row in range(count):
        for col in range(count):
            raw = [lo+(col+.5)/count*(hi-lo), hi-(row+.5)/count*(hi-lo)]
            x = [(raw[j]-scaler['mean'][j])/scaler['scale'][j] for j in range(2)]
            probabilities, _ = forward(model, x)
            p = probabilities[1]
            color = [round((1-p)*a+p*b) for a,b in zip((205,220,255),(255,220,174))]
            parts.append(f'<rect x="{bx+col*size/count:.2f}" y="{by+row*size/count:.2f}" width="{size/count+.1:.2f}" height="{size/count+.1:.2f}" fill="rgb({color[0]},{color[1]},{color[2]})"/>')
    parts.append(f'<rect x="{bx}" y="{by}" width="{size}" height="{size}" fill="none" stroke="#8396b2"/>')
    for point, label in raw_test:
        cx, cy = position(point)
        if not (bx<=cx<=bx+size and by<=cy<=by+size):
            continue
        color = '#245cd8' if label == 0 else '#a5560c'
        parts.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="4.3" fill="{color}" stroke="white" stroke-width="1"/>')
    parts.append(f'<text x="{bx}" y="{by+size+28}">-1.25</text><text x="{bx+size}" y="{by+size+28}" text-anchor="end">1.25 (x1)</text>')
    parts.append('<text x="565" y="560">Blue dots: class 0. Brown dots: class 1.</text>')
    parts.append('<text x="45" y="593">Synthetic XOR clusters; test samples are plotted only after training. No real-world accuracy claim.</text></svg>')
    filename.write_text('\n'.join(parts)+'\n', encoding='utf-8')


def run(epochs=600, learning_rate=.1):
    output = ROOT/'output'
    output.mkdir(exist_ok=True)
    raw_train, raw_validation, raw_test = make_data()
    scaler = fit_scaler(raw_train)
    train_data, validation_data, test_data = [transform(split, scaler) for split in [raw_train, raw_validation, raw_test]]
    report = {'seed': 2025, 'data': 'Synthetic four Gaussian XOR clusters, 400 samples',
              'pythonVersion': platform.python_version(),
              'rawSamples': {'train': raw_train, 'validation': raw_validation, 'test': raw_test},
              'split': {'train': len(raw_train), 'validation': len(raw_validation), 'test': len(raw_test)},
              'scaler': scaler, 'learningRate': learning_rate, 'epochs': epochs,
              'modelSelection': 'Lowest validation loss within a fixed epoch budget. Test used only after training.',
              'regression': regression_experiment(), 'classification': {}}
    for name, hidden in [('linear', 0), ('relu8', 8)]:
        initial = init_model(hidden=hidden)
        check = gradient_check(initial, train_data[:8])
        if check['maxAbsoluteError'] > 1e-6:
            raise AssertionError(f'Gradient check failed: {name}, {check}')
        model, history, best_epoch = train(initial, train_data, validation_data, epochs, learning_rate)
        result = {'hiddenUnits': hidden, 'gradientCheck': check, 'selectedEpoch': best_epoch,
                  'train': evaluate(model, train_data), 'validation': evaluate(model, validation_data),
                  'test': evaluate(model, test_data), 'history': history, 'parameters': model}
        report['classification'][name] = result
        classification_figure(model, history, raw_test, scaler, output/(name+'.svg'),
                              'Linear Softmax' if name=='linear' else f'2 -> {hidden} ReLU -> 2 Softmax')
    (output/'实验报告.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    lines = ['# Python实训运行报告', '', '数据是固定种子2025生成的400个合成XOR簇样本。与手写数字实验是两套独立数据，不能混用指标。', '',
             '训练240 / 验证80 / 测试80；标准化器仅在训练侧拟合。配置在运行前固定，只按验证损失选轮次，测试结果在训练结束后计算。', '',
             '| 模型 | 选中轮次 | 训练准确率 | 验证准确率 | 测试准确率 | 测试交叉熵 | 梯度最大绝对误差 |', '|---|---:|---:|---:|---:|---:|---:|']
    for name, result in report['classification'].items():
        lines.append(f'| {name} | {result["selectedEpoch"]} | {result["train"]["accuracy"]:.1%} | {result["validation"]["accuracy"]:.1%} | {result["test"]["accuracy"]:.1%} | {result["test"]["loss"]:.6f} | {result["gradientCheck"]["maxAbsoluteError"]:.3e} |')
    final = report['regression']['history'][-1]
    lines.extend(['', f'回归80次更新后：w={final["weight"]:.8f}，b={final["bias"]:.8f}，L={final["loss"]:.3e}；解析解w=2、b=1。', '',
                  '[线性模型学习曲线与决策图](linear.svg) · [ReLU网络学习曲线与决策图](relu8.svg)', '',
                  '完整参数、混淆矩阵、每10轮损失和预处理统计保存在`实验报告.json`。本次合成数据分布很简单，成绩不代表真实场景能力。', '',
                  '你的实验记录：先提出预测，再只改变一个条件；重新运行会覆盖本目录结果，请先复制原报告。'])
    (output/'实验报告.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print('\n'.join(lines[:12]))
    print(f'\nSaved to: {output}')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AI math practice, Python standard library only')
    parser.add_argument('--epochs', type=int, default=600)
    parser.add_argument('--learning-rate', type=float, default=.1)
    args = parser.parse_args()
    if args.epochs < 1 or not math.isfinite(args.learning_rate) or args.learning_rate <= 0:
        parser.error('epochs must be positive; learning-rate must be positive and finite.')
    run(args.epochs, args.learning_rate)
