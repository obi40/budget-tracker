import { describe, expect, it } from 'vitest';
import { amountKey, groupDigits } from './ui';

const type = (keys: string[], decimals = 3) => keys.reduce((t, k) => amountKey(t, k, decimals), '');

describe('amount keypad', () => {
  it('types digits and a decimal point', () => {
    expect(type(['1', '2', '.', '5'])).toBe('12.5');
    expect(type(['.', '7'])).toBe('0.7');
    expect(type(['1', '.', '.', '2'])).toBe('1.2'); // second point ignored
  });
  it('caps decimals at the currency precision', () => {
    expect(type(['1', '.', '2', '3', '4', '5'], 3)).toBe('1.234'); // JOD
    expect(type(['1', '.', '2', '3', '4'], 2)).toBe('1.23'); // USD/EUR
  });
  it('drops leading zeros and deletes', () => {
    expect(type(['0', '0', '5'])).toBe('5');
    expect(type(['4', '2', 'back'])).toBe('4');
    expect(type(['back'])).toBe('');
  });
  it('groups thousands for display', () => {
    expect(groupDigits('1234567.25')).toBe('1,234,567.25');
    expect(groupDigits('12.')).toBe('12.');
    expect(groupDigits('')).toBe('0');
  });
});
