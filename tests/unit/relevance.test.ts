import { describe, expect, it } from 'vitest';
import { isRelevant } from '../../src/lib/relevance';

describe('isRelevant', () => {
  it('accepts a result that marks the word searched for', () => {
    expect(isRelevant('the council of <mark>Nicaea</mark> met in 325', 'nicaea')).toBe(true);
  });

  it('accepts another form of the same word', () => {
    expect(isRelevant('he was <mark>baptised</mark> at Easter', 'baptism')).toBe(true);
  });

  it('ignores accents and case', () => {
    expect(isRelevant('at <mark>Medellín</mark> in 1968', 'medellin')).toBe(true);
  });

  it('accepts a result that matches any one of several words', () => {
    expect(isRelevant('the <mark>synod</mark> met at Whitby', 'whitby synod')).toBe(true);
  });

  it('rejects the single letter Pagefind falls back to', () => {
    expect(isRelevant('S. Bunimovitz and <mark>Z.</mark> Lederman', 'zxqvjkwpz')).toBe(false);
    expect(isRelevant('Shorter Catechism <mark>q.</mark> 1', 'qqqqqqqq')).toBe(false);
  });

  it('keeps a short word when the query itself is short', () => {
    expect(isRelevant('Leo <mark>X</mark> condemns Luther', 'leo x')).toBe(true);
  });

  it('rejects an excerpt that marks nothing', () => {
    expect(isRelevant('no marks here', 'anything')).toBe(false);
  });
});
