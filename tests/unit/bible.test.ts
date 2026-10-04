import { describe, expect, it } from 'vitest';
import { BibleRefError, parseBibleRef } from '../../src/lib/bible';

const label = (s: string) => parseBibleRef(s).label;
const short = (s: string) => parseBibleRef(s).short;

describe('parseBibleRef labels', () => {
  it('verse range', () => expect(label('2 Kings 25:8-10')).toBe('2 Kings 25:8–10'));
  it('expands abbreviations', () => expect(label('Gen 12:1-3')).toBe('Genesis 12:1–3'));
  it('single verse', () => expect(label('John 3:16')).toBe('John 3:16'));
  it('whole chapter', () => expect(label('Psalm 137')).toBe('Psalm 137'));
  it('chapter range', () => expect(label('Matt 5-7')).toBe('Matthew 5–7'));
  it('psalm range uses plural', () => expect(label('Ps 120-134')).toBe('Psalms 120–134'));
  it('range across chapters', () => expect(label('Isa 44:28-45:4')).toBe('Isaiah 44:28–45:4'));
  it('two books', () =>
    expect(label('Jer 52:12-30; 2 Chr 36:17-21')).toBe('Jeremiah 52:12–30; 2 Chronicles 36:17–21'));
  it('verses in one chapter', () => expect(label('John 3:16,18')).toBe('John 3:16, 18'));
  it('chapters in one book', () => expect(label('Gen 12; 15; 17')).toBe('Genesis 12; 15; 17'));
  it('passages in one book', () => expect(label('Gen 15:1-6; 17:1-8')).toBe('Genesis 15:1–6; 17:1–8'));
  it('chapter then verses in one book', () => expect(label('Exod 19; 20:1-17')).toBe('Exodus 19; 20:1–17'));
  it('single-chapter book', () => expect(label('Jude 3')).toBe('Jude 3'));
  it('single-chapter book range', () => expect(label('Philemon 8-16')).toBe('Philemon 8–16'));
  it('deuterocanon', () => expect(label('1 Macc 4:36-59')).toBe('1 Maccabees 4:36–59'));
  it('accepts an en dash', () => expect(label('Ezra 1:1–4')).toBe('Ezra 1:1–4'));
  it('whole book', () => expect(label('Obadiah')).toBe('Obadiah'));
  it('whole multi-chapter book', () => expect(label('Ruth')).toBe('Ruth'));
  it('numbered book', () => expect(label('1 Cor 15:3-8')).toBe('1 Corinthians 15:3–8'));
});

describe('parseBibleRef short labels', () => {
  it('abbreviates', () => expect(short('2 Kings 25:8-10')).toBe('2 Kgs 25:8–10'));
  it('abbreviates psalms', () => expect(short('Psalm 137')).toBe('Ps 137'));
  it('abbreviates two books', () =>
    expect(short('Jer 52:12-30; 2 Chr 36:17-21')).toBe('Jer 52:12–30; 2 Chr 36:17–21'));
});

describe('parseBibleRef output', () => {
  it('returns OSIS', () => expect(parseBibleRef('Gen 12:1-3').osis).toBe('Gen.12.1-Gen.12.3'));
  it('builds the reader URL with hyphens', () =>
    expect(parseBibleRef('2 Kings 25:8-10').url).toBe(
      'https://www.biblegateway.com/passage/?search=2%20Kings%2025%3A8-10&version=NRSVUE',
    ));
  it('keeps the trimmed input', () => expect(parseBibleRef(' Gen 12:1-3 ').input).toBe('Gen 12:1-3'));
});

describe('parseBibleRef rejects', () => {
  for (const bad of [
    'Genesis 51:1',
    'Gen 1:40',
    'Foo 3:2',
    '',
    'Rev 23',
    'Gen 12:1-3 and following',
    'Gen 12:1-3; Gen 99:1',
  ]) {
    it(JSON.stringify(bad), () => expect(() => parseBibleRef(bad)).toThrow(BibleRefError));
  }
});
