"""Independent invariants and finite differences; no test framework install."""
import copy
import math
import unittest
from math_lab import (evaluate, fit_scaler, forward, gradient_check, init_model,
                      loss_gradient, make_data, parameter_slots,
                      regression_loss_gradient, softmax, train, transform, update)


class MathLabTests(unittest.TestCase):
    def test_softmax_stable_and_shift_invariant(self):
        p = softmax([10000, 10001, 9999])
        q = softmax([0, 1, -1])
        self.assertAlmostEqual(sum(p), 1)
        for a, b in zip(p, q):
            self.assertAlmostEqual(a, b)
        self.assertEqual(softmax([0, -10000]), [1, 0])
        for bad in [[], [math.inf], [math.nan]]:
            with self.assertRaises(ValueError):
                softmax(bad)

    def test_regression_gradient_and_simultaneous_update(self):
        data = [(-2, -3), (-1, -1), (0, 1), (1, 3), (2, 5)]
        loss, dw, db = regression_loss_gradient(data, 0, 0)
        self.assertEqual((loss, dw, db), (4.5, -4, -1))
        self.assertEqual(regression_loss_gradient(data, 2, 1), (0, 0, 0))
        after, _, _ = regression_loss_gradient(data, .4, .1)
        self.assertLess(after, loss)
        eps = 1e-5
        for w, b in [(0.3, -.2), (1.4, 2.1)]:
            _, dw, db = regression_loss_gradient(data, w, b)
            numerical_w = (regression_loss_gradient(data, w+eps, b)[0]-regression_loss_gradient(data, w-eps, b)[0])/(2*eps)
            numerical_b = (regression_loss_gradient(data, w, b+eps)[0]-regression_loss_gradient(data, w, b-eps)[0])/(2*eps)
            self.assertAlmostEqual(dw, numerical_w, places=8)
            self.assertAlmostEqual(db, numerical_b, places=8)

    def test_data_determinism_balance_and_split(self):
        parts = make_data()
        self.assertEqual(parts, make_data())
        self.assertNotEqual(parts, make_data(seed=12))
        self.assertEqual([len(part) for part in parts], [240, 80, 80])
        for part in parts:
            self.assertEqual(sum(y for _, y in part), len(part)//2)
        keys = [{tuple(x) for x, _ in part} for part in parts]
        self.assertFalse(keys[0] & keys[1] or keys[0] & keys[2] or keys[1] & keys[2])

    def test_train_only_scaling_and_immutability(self):
        data = [([1, 7], 0), ([3, 7], 1)]
        original = copy.deepcopy(data)
        scaler = fit_scaler(data)
        self.assertEqual(scaler, {'mean': [2., 7.], 'scale': [1., 1]})
        self.assertEqual(transform(data, scaler), [([-1., 0.], 0), ([1., 0.], 1)])
        self.assertEqual(transform([([101, 7], 1)], scaler), [([99., 0.], 1)])
        self.assertEqual(data, original)

    def test_all_parameter_gradients_independent_finite_difference(self):
        data = [([-.7, .2], 0), ([.4, -.3], 1), ([.8, .9], 1)]
        for seed in [7, 2025, 81]:
            for hidden in [0, 3, 8]:
                model = init_model(hidden, seed)
                original = copy.deepcopy(model)
                check = gradient_check(model, data)
                self.assertLess(check['maxAbsoluteError'], 1e-7)
                self.assertEqual(model, original)
                self.assertEqual(check['parametersChecked'], 6 if hidden==0 else 5*hidden+2)

    def test_cross_entropy_does_not_clip_large_wrong_scores(self):
        model = {'output_w': [[0., 0.], [0., 0.]], 'output_b': [1000., 0.]}
        loss, gradient = loss_gradient(model, [([0., 0.], 1)])
        self.assertEqual(loss, 1000.)
        self.assertEqual(gradient['output_b'], [1., -1.])

    def test_relu_inactive_units_have_zero_gradient(self):
        model = {'hidden_w': [[0., 0.]], 'hidden_b': [-1.],
                 'output_w': [[.5], [-.5]], 'output_b': [0., 0.]}
        _, gradient = loss_gradient(model, [([1., 1.], 1)])
        self.assertEqual(gradient['hidden_w'], [[0., 0.]])
        self.assertEqual(gradient['hidden_b'], [0.])
        self.assertEqual(gradient['output_w'], [[0.], [0.]])
        self.assertEqual(gradient['output_b'], [.5, -.5])

    def test_mean_loss_and_logit_gradient_conservation(self):
        data = [([-.7, .2], 0), ([.4, -.3], 1)]
        model = init_model(3)
        loss, gradient = loss_gradient(model, data)
        double_loss, double_gradient = loss_gradient(model, data+data)
        self.assertAlmostEqual(loss, double_loss)
        for (row, j), (other, k) in zip(parameter_slots(gradient), parameter_slots(double_gradient)):
            self.assertAlmostEqual(row[j], other[k])
        self.assertAlmostEqual(sum(gradient['output_b']), 0.)
        for j in range(3):
            self.assertAlmostEqual(sum(row[j] for row in gradient['output_w']), 0.)

    def test_one_small_update_decreases_loss(self):
        data = [([-.7, .2], 0), ([.4, -.3], 1)]
        for hidden in [0, 8]:
            model = init_model(hidden)
            loss, gradient = loss_gradient(model, data)
            update(model, gradient, .01)
            after, _ = loss_gradient(model, data)
            self.assertLess(after, loss)

    def test_selected_snapshot_is_validation_best_and_input_is_unchanged(self):
        raw_train, raw_validation, _ = make_data(per_cluster=10)
        scaler = fit_scaler(raw_train)
        train_data, validation = transform(raw_train, scaler), transform(raw_validation, scaler)
        model = init_model(3)
        original = copy.deepcopy(model)
        selected, history, selected_epoch = train(model, train_data, validation, epochs=20)
        self.assertEqual(model, original)
        self.assertEqual([row['epoch'] for row in history], [0, 10, 20])
        selected_loss = evaluate(selected, validation)['loss']
        self.assertLessEqual(selected_loss, min(row['validationLoss'] for row in history)+1e-12)
        self.assertTrue(0 <= selected_epoch <= 20)
        self.assertIsNot(selected, model)

    def test_feature_label_and_configuration_errors_are_explicit(self):
        model = init_model(0)
        for features in [[], [1], [1, 2, 3], [math.nan, 1], [math.inf, 1], ['1', 2]]:
            with self.assertRaises(ValueError):
                forward(model, features)
        for label in [-1, 2, 1.0, True, '1']:
            with self.assertRaises(ValueError):
                loss_gradient(model, [([1., 2.], label)])
        for hidden in [True, -1, 3.5]:
            with self.assertRaises(ValueError):
                init_model(hidden)
        for count in [True, 4, 6.5]:
            with self.assertRaises(ValueError):
                make_data(per_cluster=count)

    def test_update_rejects_wrong_shapes_and_is_atomic_on_failure(self):
        model = init_model(8)
        original = copy.deepcopy(model)
        _, wrong_gradient = loss_gradient(init_model(0), [([.2, .4], 1)])
        with self.assertRaises(ValueError):
            update(model, wrong_gradient, .1)
        self.assertEqual(model, original)
        _, gradient = loss_gradient(model, [([.2, .4], 1)])
        gradient['hidden_w'][0].pop()
        with self.assertRaises(ValueError):
            update(model, gradient, .1)
        self.assertEqual(model, original)
        for bad in [math.nan, math.inf, 1e308]:
            _, gradient = loss_gradient(model, [([.2, .4], 1)])
            gradient['output_b'][-1] = bad
            with self.assertRaises((ValueError, ArithmeticError)):
                update(model, gradient, 10)
            self.assertEqual(model, original)

    def test_invalid_difference_step_does_not_mutate_model(self):
        model = init_model(3)
        original = copy.deepcopy(model)
        for epsilon in [0, -1, math.inf, math.nan]:
            with self.assertRaises(ValueError):
                gradient_check(model, [([.2, .4], 1)], epsilon)
            self.assertEqual(model, original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
