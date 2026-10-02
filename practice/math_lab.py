"""Readable AI math experiments using only the Python standard library.

Conventions: W[o][i] multiplies input i to produce output o.
Loss is mean cross-entropy; all gradients are evaluated before an update.
"""
import copy
import math
import random


def softmax(scores):
    """Subtract the largest score: probabilities are unchanged, exp is safe."""
    if not scores or not all(math.isfinite(x) for x in scores):
        raise ValueError('Scores must be a nonempty finite sequence.')
    largest = max(scores)
    values = [math.exp(x - largest) for x in scores]
    total = sum(values)
    return [x / total for x in values]


def regression_loss_gradient(points, weight, bias):
    """L = sum((w*x+b-y)^2)/(2*n). Return L, dL/dw, dL/db."""
    if not points:
        raise ValueError('At least one training point is required.')
    residuals = [weight * x + bias - y for x, y in points]
    n = len(points)
    loss = sum(r * r for r in residuals) / (2 * n)
    dw = sum(r * point[0] for r, point in zip(residuals, points)) / n
    db = sum(residuals) / n
    return loss, dw, db


def make_data(seed=2025, per_cluster=100):
    """Four synthetic clusters: equal-sign corners are label 1, others 0.

    Labels come from the cluster, not a rule secretly read at prediction time.
    Gaussian tails may cross axes. Nothing here is a real student's dataset.
    """
    if type(per_cluster) is not int or per_cluster < 5:
        raise ValueError('Each cluster needs at least five samples.')
    rng = random.Random(seed)
    train, validation, test = [], [], []
    for sx, sy in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
        cluster = [([rng.gauss(sx * .65, .18), rng.gauss(sy * .65, .18)],
                    int(sx == sy)) for _ in range(per_cluster)]
        rng.shuffle(cluster)
        a, b = int(per_cluster * .6), int(per_cluster * .8)
        train.extend(cluster[:a])
        validation.extend(cluster[a:b])
        test.extend(cluster[b:])
    for split in [train, validation, test]:
        rng.shuffle(split)
    return train, validation, test


def fit_scaler(train):
    """Fit ONLY on training samples. Population standard deviation (ddof=0)."""
    if not train:
        raise ValueError('Cannot fit an empty training set.')
    mean = [sum(x[j] for x, _ in train) / len(train) for j in range(2)]
    scale = [math.sqrt(sum((x[j] - mean[j]) ** 2 for x, _ in train) / len(train))
             for j in range(2)]
    return {'mean': mean, 'scale': [s if s > 0 else 1 for s in scale]}


def transform(data, scaler):
    return [([(x[j] - scaler['mean'][j]) / scaler['scale'][j]
              for j in range(2)], y) for x, y in data]


def init_model(hidden=0, seed=2025):
    """A linear two-class model, or 2 -> hidden ReLU -> 2 logits."""
    if type(hidden) is not int or hidden < 0:
        raise ValueError('hidden must be a nonnegative integer.')
    rng = random.Random(seed)
    width = hidden or 2
    model = {'output_w': [[rng.gauss(0, math.sqrt(1 / width))
                           for _ in range(width)] for _ in range(2)],
             'output_b': [0., 0.]}
    if hidden:
        model['hidden_w'] = [[rng.gauss(0, 1) for _ in range(2)]
                             for _ in range(hidden)]
        model['hidden_b'] = [.05] * hidden
    return model


def forward(model, x):
    """Return probabilities AND a cache for backpropagation."""
    if len(x) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in x):
        raise ValueError('Expected exactly two finite numeric features.')
    if 'hidden_w' in model:
        pre = [sum(w * value for w, value in zip(row, x)) + b
               for row, b in zip(model['hidden_w'], model['hidden_b'])]
        features = [max(0, z) for z in pre]
    else:
        pre, features = [], x
    scores = [sum(w * value for w, value in zip(row, features)) + b
              for row, b in zip(model['output_w'], model['output_b'])]
    return softmax(scores), (pre, features, scores)


def parameter_slots(model):
    """Yield (mutable list, index). Useful for updates and gradient checking."""
    for name in ['hidden_w', 'hidden_b', 'output_w', 'output_b']:
        if name not in model:
            continue
        if name.endswith('_w'):
            for row in model[name]:
                for j in range(len(row)):
                    yield row, j
        else:
            for j in range(len(model[name])):
                yield model[name], j


def loss_gradient(model, data):
    """Mean CE and its exact derivatives; derivative of ReLU at 0 is set to 0."""
    if not data:
        raise ValueError('At least one sample is required.')
    gradient = copy.deepcopy(model)
    for row, j in parameter_slots(gradient):
        row[j] = 0.
    loss = 0.
    for x, y in data:
        if type(y) is not int or y not in (0, 1) or len(x) != 2:
            raise ValueError('Expected two features and label 0 or 1.')
        probabilities, (pre, features, scores) = forward(model, x)
        # log-sum-exp computes CE without clipping a tiny probability.
        top = max(scores)
        loss += top + math.log(sum(math.exp(z - top) for z in scores)) - scores[y]
        dz = [p - int(k == y) for k, p in enumerate(probabilities)]
        for k in range(2):
            gradient['output_b'][k] += dz[k]
            for j, value in enumerate(features):
                gradient['output_w'][k][j] += dz[k] * value
        if pre:
            for j, z in enumerate(pre):
                dh = sum(model['output_w'][k][j] * dz[k] for k in range(2))
                da = dh if z > 0 else 0.
                gradient['hidden_b'][j] += da
                for i in range(2):
                    gradient['hidden_w'][j][i] += da * x[i]
    for row, j in parameter_slots(gradient):
        row[j] /= len(data)
    return loss / len(data), gradient


def update(model, gradient, learning_rate):
    """The entire gradient must come from the same pre-update model."""
    if not math.isfinite(learning_rate) or learning_rate <= 0:
        raise ValueError('learning_rate must be positive and finite.')
    def shapes(parameters):
        return {key: tuple(len(row) for row in value) if key.endswith('_w') else len(value)
                for key, value in parameters.items()}
    if shapes(model) != shapes(gradient):
        raise ValueError('Gradient must have the same parameter names and shapes as the model.')
    slots, gradient_slots = list(parameter_slots(model)), list(parameter_slots(gradient))
    if not all(math.isfinite(row[j]) for row, j in slots + gradient_slots):
        raise ValueError('Parameters and gradients must be finite.')
    proposed = [(row, j, row[j] - learning_rate * g_row[g_j])
                for (row, j), (g_row, g_j) in zip(slots, gradient_slots)]
    if not all(math.isfinite(value) for _, _, value in proposed):
        raise ArithmeticError('Nonfinite parameter: lower the learning rate; model unchanged.')
    for row, j, value in proposed:
        row[j] = value


def evaluate(model, data):
    loss, _ = loss_gradient(model, data)
    matrix = [[0, 0], [0, 0]]
    for x, y in data:
        probabilities, _ = forward(model, x)
        prediction = max(range(2), key=lambda k: probabilities[k])
        matrix[y][prediction] += 1
    return {'loss': loss, 'accuracy': sum(matrix[i][i] for i in range(2)) / len(data),
            'confusion': matrix, 'samples': len(data)}


def train(model, train_data, validation_data, epochs=600, learning_rate=.1):
    """Fixed epoch budget; keep best VALIDATION-loss snapshot, never peek at test."""
    if type(epochs) is not int or epochs < 1:
        raise ValueError('epochs must be a positive integer.')
    model = copy.deepcopy(model)
    best_model, best_loss, best_epoch = copy.deepcopy(model), math.inf, 0
    history = []
    for epoch in range(epochs + 1):
        loss, gradient = loss_gradient(model, train_data)
        validation_loss, _ = loss_gradient(model, validation_data)
        if validation_loss < best_loss:
            best_model, best_loss, best_epoch = copy.deepcopy(model), validation_loss, epoch
        if epoch % 10 == 0 or epoch == epochs:
            history.append({'epoch': epoch, 'trainLoss': loss, 'validationLoss': validation_loss})
        if epoch < epochs:
            update(model, gradient, learning_rate)
    return best_model, history, best_epoch


def gradient_check(model, data, epsilon=1e-5):
    """Central finite differences. Avoid inputs exactly on ReLU's kink."""
    if not math.isfinite(epsilon) or epsilon <= 0:
        raise ValueError('epsilon must be positive and finite.')
    _, analytical = loss_gradient(model, data)
    errors = []
    for (row, j), (g_row, g_j) in zip(parameter_slots(model), parameter_slots(analytical)):
        original = row[j]
        try:
            row[j] = original + epsilon
            plus, _ = loss_gradient(model, data)
            row[j] = original - epsilon
            minus, _ = loss_gradient(model, data)
        finally:
            row[j] = original
        numerical = (plus - minus) / (2 * epsilon)
        errors.append(abs(numerical - g_row[g_j]))
    return {'parametersChecked': len(errors), 'maxAbsoluteError': max(errors)}
