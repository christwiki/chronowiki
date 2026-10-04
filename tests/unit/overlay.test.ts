import { describe, expect, it } from 'vitest';
import { getLocale } from '../../src/i18n';
import { applyOverlay, sourceHash, wordsOf } from '../../src/i18n/overlay';
import { parseBibleRef } from '../../src/lib/bible';
import { renderProse, type ProseContext } from '../../src/lib/prose';
import { smarten } from '../../src/lib/typography';
import type { RawTranslation } from '../../src/lib/load';
import type { RawContent, RawEntry } from '../../src/lib/validate';
import { validateTranslations } from '../../src/lib/validate-i18n';

const de = getLocale('de');

const event = {
  title: 'The First Deportation to Babylon',
  summary: 'Nebuchadnezzar takes Jerusalem.',
  era: 'exile-and-return',
  date: { start: -597, display: '597 BC', confidence: 'firm' },
  places: ['babylon'],
  people: ['jehoiachin'],
  citations: { chronicle: { source: 'chronicle-5', at: 'rev. 11–13', url: 'https://example.org/abc5' } },
  dating: 'The chronicle gives the day [[cite:chronicle]].',
};
const body = 'Kings tells of the siege [[bible:2 Kings 24:10-12]] and so does the chronicle [[cite:chronicle]].';

describe('wordsOf', () => {
  it('collects the fields that hold words, under the overlay’s names', () => {
    expect(wordsOf('events', event)).toEqual({
      title: event.title,
      summary: event.summary,
      dating: event.dating,
      dateDisplay: '597 BC',
      citations: { chronicle: { at: 'rev. 11–13' } },
    });
  });

  it('leaves out what an entry does not have', () => {
    expect(wordsOf('threads', { title: 'Covenant', summary: 'Promises.' })).toEqual({ title: 'Covenant', summary: 'Promises.' });
  });

  it('takes a source’s link labels in order', () => {
    const words = wordsOf('sources', { title: 'T', cite: 'T', summary: 'S', links: [{ label: 'Latin text', url: 'https://example.org' }] });
    expect(words.links).toEqual(['Latin text']);
  });
});

describe('sourceHash', () => {
  it('is twelve hex digits', () => expect(sourceHash('events', event, body)).toMatch(/^[0-9a-f]{12}$/));

  it('changes when a word of the original changes', () => {
    const before = sourceHash('events', event, body);
    expect(sourceHash('events', { ...event, summary: 'Nebuchadnezzar takes the city.' }, body)).not.toBe(before);
    expect(sourceHash('events', event, `${body} More.`)).not.toBe(before);
    expect(sourceHash('events', { ...event, citations: { chronicle: { ...event.citations.chronicle, at: 'rev. 12' } } }, body)).not.toBe(before);
  });

  it('does not change when only facts change, which every language shares', () => {
    const before = sourceHash('events', event, body);
    expect(sourceHash('events', { ...event, places: ['babylon', 'jerusalem'] }, body)).toBe(before);
    expect(sourceHash('events', { ...event, date: { ...event.date, month: 3 } }, body)).toBe(before);
    expect(sourceHash('events', { ...event, citations: { chronicle: { ...event.citations.chronicle, url: 'https://example.org/other' } } }, body)).toBe(before);
  });
});

describe('applyOverlay', () => {
  const overlay = {
    source: 'aaaaaaaaaaaa',
    title: 'Die erste Wegführung nach Babylon',
    summary: 'Nebukadnezzar nimmt Jerusalem ein.',
    dateDisplay: '597 v. Chr.',
    citations: { chronicle: { at: 'Rs. 11–13' } },
  };

  it('puts the translated words in and keeps the facts', () => {
    const merged = applyOverlay('events', event, overlay);
    expect(merged.title).toBe(overlay.title);
    expect(merged.date).toEqual({ start: -597, display: '597 v. Chr.', confidence: 'firm' });
    expect(merged.places).toEqual(['babylon']);
    expect(merged.citations.chronicle).toEqual({ source: 'chronicle-5', at: 'Rs. 11–13', url: 'https://example.org/abc5' });
  });

  it('does not change the original', () => {
    applyOverlay('events', event, overlay);
    expect(event.title).toBe('The First Deportation to Babylon');
    expect(event.citations.chronicle.at).toBe('rev. 11–13');
  });

  it('falls back to the original for what the overlay leaves out', () => {
    expect(applyOverlay('events', event, { source: 'aaaaaaaaaaaa', title: 'T' }).dating).toBe(event.dating);
  });

  it('relabels a source’s links by position', () => {
    const source = { title: 'T', links: [{ label: 'Latin text', url: 'https://example.org/la' }] };
    expect(applyOverlay('sources', source, { source: 'aaaaaaaaaaaa', links: ['Lateinischer Text'] }).links).toEqual([
      { label: 'Lateinischer Text', url: 'https://example.org/la' },
    ]);
  });
});

describe('Bible references in German', () => {
  it('names the books in German and puts a comma between chapter and verse', () => {
    const ref = parseBibleRef('2 Kings 25:8-10', de.bible);
    expect(ref.label).toBe('2 Könige 25,8–10');
    expect(ref.short).toBe('2 Kön 25,8–10');
  });

  it('joins verses of one chapter with a full stop', () => {
    expect(parseBibleRef('2 Kings 24:1-6, 10', de.bible).label).toBe('2 Könige 24,1–6.10');
  });

  it('links each passage to the German reader', () => {
    const ref = parseBibleRef('Jer 52:12-30; 2 Chr 36:17-21', de.bible);
    expect(ref.links.map((link) => link.label)).toEqual(['Jeremia 52,12–30', '2 Chronik 36,17–21']);
    expect(ref.links.map((link) => decodeURIComponent(link.url))).toEqual([
      'https://www.bibleserver.com/EU/Jeremia52,12-30',
      'https://www.bibleserver.com/EU/2.Chronik36,17-21',
    ]);
  });

  it('keeps a verse list in one link', () => {
    const ref = parseBibleRef('2 Kings 24:1-6, 10', de.bible);
    expect(ref.links).toHaveLength(1);
    expect(decodeURIComponent(ref.links[0].url)).toBe('https://www.bibleserver.com/EU/2.Könige24,1-6.10');
  });

  it('uses the name the reader knows where it differs', () => {
    expect(decodeURIComponent(parseBibleRef('Sir 1:1', de.bible).url)).toBe('https://www.bibleserver.com/EU/Sirach1,1');
    expect(decodeURIComponent(parseBibleRef('Ps 51', de.bible).url)).toBe('https://www.bibleserver.com/EU/Psalm51');
  });

  it('falls back to the English reader for a book the German reader lacks', () => {
    const ref = parseBibleRef('1 Esd 3:1', de.bible);
    expect(ref.label).toBe('3 Esra 3,1');
    expect(ref.url).toContain('biblegateway.com');
  });

  it('gives the same passage whatever the language', () => {
    expect(parseBibleRef('2 Kings 25:8-10', de.bible).osis).toBe(parseBibleRef('2 Kings 25:8-10').osis);
  });

  it('still gives English one link for the whole reference', () => {
    expect(parseBibleRef('Jer 52:12-30; 2 Chr 36:17-21').links).toHaveLength(1);
  });
});

describe('typography in German', () => {
  it('uses the German quotation marks', () => {
    expect(smarten('belagerte "die Stadt Juda" und', de.quotes)).toBe('belagerte „die Stadt Juda“ und');
    expect(smarten("er sagte 'nein'", de.quotes)).toBe('er sagte ‚nein‘');
  });
  it('keeps the apostrophe', () => expect(smarten("Luthers Thesen und Hus' Tod", de.quotes)).toBe('Luthers Thesen und Hus’ Tod'));
  it('changes nothing the second time', () => {
    const once = smarten('"die Stadt Juda"', de.quotes);
    expect(smarten(once, de.quotes)).toBe(once);
  });
});

describe('rendering German text', () => {
  const ctx: ProseContext = {
    resolve: (type, id) => (type === 'event' && id === 'nicaea' ? { href: '/de/events/nicaea/', label: 'Das Konzil von Nizäa' } : undefined),
    citations: {},
    source: () => undefined,
    bible: de.bible,
    quotes: de.quotes,
  };

  it('writes the citation the German way and links each passage', () => {
    const { html } = renderProse('So Jeremia [[bible:Jer 52:12-30; 2 Chr 36:17-21]].', ctx);
    expect(html).toContain('>(Jeremia 52,12–30</a>; <a');
    expect(html).toContain('>2 Chronik 36,17–21)</a>');
  });

  it('does not apply the English rule about "The" to German titles', () => {
    expect(renderProse('Siehe [[event:nicaea]].', ctx).html).toContain('>Das Konzil von Nizäa</a>');
  });
});

describe('validateTranslations', () => {
  const entry = (id: string, data: object, text = ''): RawEntry => ({ id, file: `events/x/${id}.md`, data, body: text });
  const content = {
    events: [entry('deportation', event, body)],
    people: [entry('jehoiachin', { name: 'Jehoiachin', role: 'King', summary: 'S' })],
    places: [entry('babylon', { name: 'Babylon', modern: 'Iraq', summary: 'S' })],
    sources: [entry('chronicle-5', { title: 'Chronicle 5', cite: 'Chronicle 5', summary: 'S' })],
    threads: [],
    eras: [],
  } as unknown as RawContent;
  const options = { locales: [{ code: 'en', status: 'live' as const }, { code: 'de', status: 'preview' as const }], defaultLocale: 'en' };

  const good = {
    source: sourceHash('events', event, body),
    title: 'Die erste Wegführung',
    summary: 'Nebukadnezzar nimmt Jerusalem ein.',
    dateDisplay: '597 v. Chr.',
    dating: 'Die Chronik nennt den Tag [[cite:chronicle]].',
  };
  const goodBody = 'Die Königsbücher erzählen von der Belagerung [[bible:2 Kings 24:10-12]], die Chronik ebenso [[cite:chronicle]].';
  const translation = (data: object, text = goodBody, file = 'i18n/de/events/deportation.md'): RawTranslation => {
    const [, locale, collection, name] = file.split('/');
    return { id: name.replace(/\.md$/, ''), file, data, body: text, locale, collection };
  };
  const codes = (list: RawTranslation[]) => validateTranslations(content, [], list, options).map((issue) => issue.code);

  it('accepts a complete translation that cites what the original cites', () => expect(codes([translation(good)])).toEqual([]));

  it('rejects a translation of an entry that does not exist', () =>
    expect(codes([translation(good, goodBody, 'i18n/de/events/nothing.md')])).toEqual(['i18n-orphan']));

  it('rejects a language the site does not have', () =>
    expect(codes([translation(good, goodBody, 'i18n/fr/events/deportation.md')])).toEqual(['i18n-locale']));

  it('requires every word of the original to be translated', () => {
    const { summary: _summary, ...partial } = good;
    expect(codes([translation(partial)])).toEqual(['i18n-missing']);
    expect(codes([translation(good, '')])).toContain('i18n-missing');
  });

  it('requires a label where the original writes its date in words', () => {
    const { dateDisplay: _display, ...partial } = good;
    expect(codes([translation(partial)])).toEqual(['i18n-missing']);
  });

  it('rejects a field that is not a word of this kind of entry', () =>
    expect(codes([translation({ ...good, role: 'König' })])).toEqual(['i18n-field']));

  it('rejects a translation that drops a citation', () => {
    const dropped = 'Die Königsbücher erzählen von der Belagerung [[bible:2 Kings 24:10-12]].';
    expect(codes([translation({ ...good, dating: 'Die Chronik nennt den Tag.' }, dropped)])).toEqual(['i18n-citations']);
  });

  it('rejects a translation that cites a passage the original does not', () => {
    const added = `${goodBody} Vgl. [[bible:Jer 52:28]].`;
    expect(codes([translation(good, added)])).toEqual(['i18n-citations']);
  });

  it('rejects a citation key the original does not define', () =>
    expect(codes([translation(good, `${goodBody} [[cite:ration]]`)])).toContain('token'));

  it('rejects a link to an entry that does not exist', () =>
    expect(codes([translation(good, `${goodBody} [[person:nobody]]`)])).toContain('ref'));

  it('warns when the original has changed since', () =>
    expect(validateTranslations(content, [], [translation({ ...good, source: 'aaaaaaaaaaaa' })], options)).toMatchObject([
      { level: 'warning', code: 'i18n-stale' },
    ]));

  it('checks the hash is a hash', () => expect(codes([translation({ ...good, source: 'recently' })])).toEqual(['schema']));

  it('holds a summary to the same length as the original’s', () =>
    expect(codes([translation({ ...good, summary: 'x'.repeat(281) })])).toEqual(['length']));
});
