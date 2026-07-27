import { describe, expect, it } from 'vitest';

import { MetricValue as MetricValueModel } from '@app/shared/models/dto/analytics/metric-value';
import { MetricValue } from './metric-value';

describe('MetricValue', () => {
  const pipe = new MetricValue();

  it('returns em dash for null value', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('returns em dash for undefined value', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('formats a decimal with es-CO comma separator and 2 fraction digits', () => {
    const value: MetricValueModel = { amount: '0.123' };
    expect(pipe.transform(value, 2)).toBe('0,12');
  });

  it('formats a whole number with 0 fraction digits', () => {
    const value: MetricValueModel = { amount: '5' };
    expect(pipe.transform(value, 0)).toBe('5');
  });

  it('defaults to 2 fraction digits when caller omits the argument', () => {
    const value: MetricValueModel = { amount: '3.14159' };
    expect(pipe.transform(value)).toBe('3,14');
  });

  it('returns em dash when amount is not a valid number', () => {
    const value: MetricValueModel = { amount: 'abc' };
    expect(pipe.transform(value)).toBe('—');
  });
});