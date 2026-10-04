import { describe, expect, it } from 'vitest';
import { smarten, smartenMarkdown } from '../../src/lib/typography';

describe('smarten', () => {
  it('curls double quotation marks', () => {
    expect(smarten('They confess the Son "of one substance" with the Father.')).toBe(
      'They confess the Son “of one substance” with the Father.',
    );
    expect(smarten('"Here I stand"')).toBe('“Here I stand”');
  });

  it('curls single quotation marks and apostrophes', () => {
    expect(smarten("Luther's theses")).toBe('Luther’s theses');
    expect(smarten("the bishops' letter")).toBe('the bishops’ letter');
    expect(smarten("he said 'no' twice")).toBe('he said ‘no’ twice');
  });

  it('handles a quotation inside a quotation', () => {
    expect(smarten(`"He answered, 'I am.'"`)).toBe('“He answered, ‘I am.’”');
  });

  it('opens after a bracket or a dash', () => {
    expect(smarten('("truly present")')).toBe('(“truly present”)');
    expect(smarten('the phrase—"begotten, not made"—stands')).toBe('the phrase—“begotten, not made”—stands');
  });

  it('closes before punctuation and at the end', () => {
    expect(smarten('"the ever-virgin Mary", and')).toBe('“the ever-virgin Mary”, and');
    expect(smarten('calls it "a robber council"')).toBe('calls it “a robber council”');
  });

  it('changes nothing the second time', () => {
    const once = smarten(`"Luther's 'theses'"`);
    expect(smarten(once)).toBe(once);
  });
});

describe('smartenMarkdown', () => {
  it('leaves link targets and code alone', () => {
    expect(smartenMarkdown(`see [the "text"](https://example.org/a'b) and \`x = "y"\``)).toBe(
      'see [the “text”](https://example.org/a\'b) and `x = "y"`',
    );
  });
});
