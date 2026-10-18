import { expect, it } from 'vitest';
import { formatResultNumber } from '../src/engine/result-format';
it.each([
  [0, '0'],
  [80, '80'],
  [12345.67, '12,345.67'],
  [0.125, '0.125'],
  [1e-24, '1E-24'],
  [-1e-24, '-1E-24'],
  [1e18, '1E18'],
  [7.61985302416047e-24, '7.61985302416E-24'],
])('displays %s as %s without turning a nonzero result into zero', (value, expected) => {
  expect(formatResultNumber(Number(value), 'en-US')).toBe(expected);
});
