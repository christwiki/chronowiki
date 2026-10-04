import { describe, expect, it } from 'vitest';
import { validateContent, type RawContent, type RawEntry } from '../../src/lib/validate';

const entry = (id: string, data: Record<string, unknown>, body = '', file = `${id}.md`): RawEntry => ({
  id,
  file,
  data,
  body,
});

function fixture(): RawContent {
  return {
    eras: [
      entry('exile-and-return', {
        title: 'Exile and Return',
        order: 6,
        start: -597,
        end: -400,
        span: '597–400 BC',
        colour: 'era-6',
        summary: 'S',
      }),
    ],
    threads: [entry('temple-and-worship', { title: 'Temple and Worship', summary: 'S' })],
    people: [entry('jeremiah', { name: 'Jeremiah', role: 'Prophet', summary: 'S' })],
    places: [
      entry('jerusalem', {
        name: 'Jerusalem',
        modern: 'Jerusalem',
        lat: 31.78,
        lon: 35.23,
        kind: 'city',
        region: 'levant',
        summary: 'S',
      }),
    ],
    sources: [
      entry('babylonian-chronicle-abc-5', {
        title: 'Jerusalem Chronicle',
        cite: 'Babylonian Chronicle ABC 5',
        kind: 'chronicle',
        url: 'https://example.org/abc5',
        summary: 'S',
      }),
    ],
    events: [
      entry(
        'fall-of-jerusalem',
        {
          title: 'Fall of Jerusalem',
          summary: 'S',
          era: 'exile-and-return',
          date: { start: -586, confidence: 'estimated' },
          places: ['jerusalem'],
          people: ['jeremiah'],
          threads: ['temple-and-worship'],
          citations: { chron: { source: 'babylonian-chronicle-abc-5', at: 'rev. 11–13' } },
          dating: 'Fixed by [[cite:chron]].',
          reviewed: '2026-10-03',
        },
        `${'word '.repeat(90)} [[bible:2 Kings 25:8-10]] and [[person:jeremiah]].`,
        'events/exile-and-return/fall-of-jerusalem.md',
      ),
    ],
  };
}

const codes = (raw: RawContent, strict = false) => validateContent(raw, { strict }).map((i) => `${i.level}:${i.code}`);
const edit = (fn: (c: RawContent) => void) => {
  const c = fixture();
  fn(c);
  return c;
};
const ev = (c: RawContent) => c.events[0].data as Record<string, any>;

describe('validateContent', () => {
  it('passes a clean fixture, even in strict mode', () => {
    expect(validateContent(fixture(), { strict: true })).toEqual([]);
  });

  it('reports schema failures with the field path', () => {
    const issues = validateContent(edit((c) => { ev(c).summary = 'x'.repeat(281); }));
    expect(issues[0]).toMatchObject({
      level: 'error',
      code: 'schema',
      file: 'events/exile-and-return/fall-of-jerusalem.md',
    });
    expect(issues[0].message).toContain('summary');
  });

  it('reports front matter that is not valid YAML', () => {
    const issues = validateContent(edit((c) => { c.people[0].parseError = 'bad indentation of a mapping entry (3:126)'; }));
    expect(issues.find((i) => i.code === 'yaml')).toMatchObject({ level: 'error', file: 'jeremiah.md' });
    expect(issues.some((i) => i.code === 'schema')).toBe(false);
  });

  it('checks ids', () => expect(codes(edit((c) => { c.people[0].id = 'Jeremiah'; }))).toContain('error:id'));

  it('rejects two entries with the same id', () => {
    const c = edit((c) => { c.people.push({ ...c.people[0], file: 'other/jeremiah.md' }); });
    expect(codes(c)).toContain('error:id');
  });

  it('checks the era folder', () =>
    expect(codes(edit((c) => { c.events[0].file = 'events/patriarchs/fall-of-jerusalem.md'; }))).toContain(
      'error:era-folder',
    ));

  it('checks front matter references', () =>
    expect(codes(edit((c) => { ev(c).people = ['nobody']; }))).toContain('error:ref'));

  it('checks the era reference', () => expect(codes(edit((c) => { c.eras = []; }))).toContain('error:ref'));

  it('checks citation sources', () =>
    expect(codes(edit((c) => { ev(c).citations.chron.source = 'nothing'; }))).toContain('error:ref'));

  it('checks wiki links', () =>
    expect(codes(edit((c) => { c.events[0].body += ' [[place:atlantis]]'; }))).toContain('error:ref'));

  it('checks tokens', () =>
    expect(
      codes(edit((c) => { c.events[0].body += ' [[bible:Gen 99:1]] [[cite:nope]]'; })).filter((x) => x === 'error:token'),
    ).toHaveLength(2));

  it('checks tokens in the dating note', () =>
    expect(codes(edit((c) => { ev(c).dating = 'See [[cite:nope]].'; }))).toContain('error:token'));

  it('requires a primary citation in the body', () =>
    expect(codes(edit((c) => { c.events[0].body = 'word '.repeat(90); }))).toContain('error:primary'));

  it('requires a dating note unless firm', () => {
    expect(codes(edit((c) => { delete ev(c).dating; }))).toContain('error:dating');
    expect(
      codes(edit((c) => { delete ev(c).dating; ev(c).date.confidence = 'firm'; ev(c).citations = {}; })),
    ).not.toContain('error:dating');
  });

  it('requires a place unless undated', () =>
    expect(codes(edit((c) => { ev(c).places = []; }))).toContain('error:place'));

  it('rejects 0,0 coordinates', () =>
    expect(codes(edit((c) => { Object.assign(c.places[0].data as object, { lat: 0, lon: 0 }); }))).toContain(
      'error:place',
    ));

  it('detects self-reference in follows', () =>
    expect(codes(edit((c) => { ev(c).follows = ['fall-of-jerusalem']; }))).toContain('error:follows'));

  it('detects follows cycles', () => {
    const c = edit((c) => {
      c.events.push(
        entry(
          'edict-of-cyrus',
          { ...ev(c), title: 'Edict', date: { start: -538, confidence: 'estimated' }, follows: ['fall-of-jerusalem'] },
          c.events[0].body,
          'events/exile-and-return/edict-of-cyrus.md',
        ),
      );
      ev(c).follows = ['edict-of-cyrus'];
    });
    expect(codes(c)).toContain('error:follows');
  });

  it('warns when following a later event', () => {
    const c = edit((c) => {
      c.events.push(
        entry(
          'edict-of-cyrus',
          { ...ev(c), title: 'Edict', date: { start: -538, confidence: 'estimated' }, follows: [] },
          c.events[0].body,
          'events/exile-and-return/edict-of-cyrus.md',
        ),
      );
      ev(c).follows = ['edict-of-cyrus'];
    });
    expect(codes(c)).toEqual(['warning:follows-order']);
  });

  it('warns when the year is far outside the era', () =>
    expect(codes(edit((c) => { ev(c).date.start = -900; }))).toContain('warning:era-range'));

  it('detects duplicate names', () => {
    const c = edit((c) => {
      c.people.push(entry('jeremias', { name: 'Jeremias', altNames: ['Jeremiah'], role: 'Prophet', summary: 'S' }));
    });
    expect(codes(c)).toContain('error:duplicate');
  });

  it('compares names in any script and ignores accents', () => {
    const person = (id: string, name: string, altNames: string[] = []) =>
      entry(id, { name, altNames, role: 'R', summary: 'S' });
    const withPeople = (...extra: RawEntry[]) => codes(edit((c) => { c.people.push(...extra); }));
    // Two different Korean names are not duplicates of each other.
    expect(
      withPeople(person('kil-sun-joo', 'Kil Sun-joo', ['길선주']), person('yi-seung-hun', 'Yi Seung-hun', ['이승훈'])),
    ).not.toContain('error:duplicate');
    // The same name in another script is.
    expect(withPeople(person('a', 'Kil Sun-joo', ['길선주']), person('b', 'Gil Seon-ju', ['길선주']))).toContain(
      'error:duplicate',
    );
    // Accents do not make a name different.
    expect(withPeople(person('a', 'Óscar Romero'), person('b', 'Oscar Romero'))).toContain('error:duplicate');
  });

  it('flags unused citations, orphans, drafts and missing review as warnings', () => {
    const c = edit((c) => {
      ev(c).citations.extra = { source: 'babylonian-chronicle-abc-5' };
      c.places.push(
        entry('babylon', {
          name: 'Babylon',
          modern: 'Hillah, Iraq',
          lat: 32.54,
          lon: 44.42,
          kind: 'city',
          region: 'mesopotamia-and-persia',
          summary: 'S',
          draft: true,
        }),
      );
      delete ev(c).reviewed;
    });
    expect(codes(c).sort()).toEqual(['warning:draft', 'warning:orphan', 'warning:reviewed', 'warning:unused-citation']);
    expect(codes(c, true).sort()).toEqual(['error:draft', 'error:orphan', 'error:reviewed', 'error:unused-citation']);
  });

  it('checks drafts only for structure', () => {
    const c = edit((c) => {
      Object.assign(ev(c), { draft: true, places: [], dating: undefined, citations: {} });
      c.events[0].body = 'TODO';
    });
    // The place and the source lose their only reference; the person is still listed by the draft.
    expect(codes(c).sort()).toEqual(['warning:draft', 'warning:orphan', 'warning:orphan']);
  });

  it('still checks references of drafts', () => {
    const c = edit((c) => { Object.assign(ev(c), { draft: true, people: ['nobody'] }); });
    expect(codes(c)).toContain('error:ref');
  });

  it('warns on body length', () =>
    expect(codes(edit((c) => { c.events[0].body = 'Short [[bible:2 Kings 25:8-10]].'; }))).toContain('warning:length'));
});

describe('regions', () => {
  const regionCodes = (raw: RawContent, regions?: string[]) =>
    validateContent(raw, { regions }).filter((i) => i.file === 'jerusalem.md').map((i) => `${i.level}:${i.code}`);

  it('accepts a place in one of the wiki’s regions', () => expect(regionCodes(fixture(), ['levant', 'egypt'])).toEqual([]));

  it('rejects a place in a region the wiki does not have, and names the ones it has', () => {
    const issues = validateContent(fixture(), { regions: ['egypt', 'italy'] }).filter((i) => i.file === 'jerusalem.md');
    expect(issues.map((i) => `${i.level}:${i.code}`)).toEqual(['error:schema']);
    expect(issues[0].message).toContain('"levant"');
    expect(issues[0].message).toContain('egypt, italy');
  });

  it('does not check regions when it is not told which exist', () => expect(regionCodes(fixture())).toEqual([]));
});
