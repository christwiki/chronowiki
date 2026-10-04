import { describe, expect, it } from 'vitest';
import { defineWiki, english, german, missingRegionNames, type RegionInput } from '../../src/config';
import { DEFAULT_LOCALE, i18nFor, LOCALES, localeOfPath, localizedPath, neutralPath } from '../../src/i18n';
import { checkLocale } from '../../src/i18n/check';
import { en } from '../../src/i18n/messages/en';
import { fill, lookup, translate } from '../../src/i18n/translate';

describe('fill', () => {
  it('puts values into a message', () => expect(fill('Read how {site} is made', 'en', { site: 'Christwiki' })).toBe('Read how Christwiki is made'));

  it('leaves an unknown placeholder alone', () => expect(fill('{a} and {b}', 'en', { a: 'x' })).toBe('x and {b}'));

  it('chooses the plural form by the language’s rules', () => {
    const events = { one: '{count} event', other: '{count} events' };
    expect(fill(events, 'en', { count: 1 })).toBe('1 event');
    expect(fill(events, 'en', { count: 0 })).toBe('0 events');
    expect(fill(events, 'en', { count: 361 })).toBe('361 events');
  });

  it('uses the forms a language has beyond one and other', () => {
    // Polish: 1 wydarzenie, 2 wydarzenia, 5 wydarzeń.
    const events = { one: '{count} wydarzenie', few: '{count} wydarzenia', many: '{count} wydarzeń', other: '{count} wydarzenia' };
    expect(fill(events, 'pl', { count: 1 })).toBe('1 wydarzenie');
    expect(fill(events, 'pl', { count: 3 })).toBe('3 wydarzenia');
    expect(fill(events, 'pl', { count: 5 })).toBe('5 wydarzeń');
  });

  it('writes numbers as the language does, and leaves strings as they are', () => {
    expect(fill('{count} sources', 'en', { count: 1037 })).toBe('1,037 sources');
    expect(fill('{count} Quellen', 'de', { count: 1037 })).toBe('1.037 Quellen');
    expect(fill('{year} BC', 'en', { year: '1446' })).toBe('1446 BC');
  });
});

describe('translate', () => {
  it('finds a message by its dotted key', () => expect(translate(en, 'en', 'nav.timeline')).toBe('Timeline'));
  it('fails loudly on a key that does not exist', () => expect(() => translate(en, 'en', 'nav.nothing')).toThrow(/Unknown message/));
  it('does not mistake a group of messages for a message', () => expect(lookup(en, 'nav')).toBeUndefined());
});

describe('every language of the theme', () => {
  for (const locale of LOCALES) {
    it(`${locale.code}: has the keys and placeholders of the English messages, nothing empty, and every book of the Bible`, () => {
      expect(checkLocale(locale)).toEqual([]);
    });
  }

  it('has codes that can open an address', () => {
    expect(new Set(LOCALES.map((locale) => locale.code)).size).toBe(LOCALES.length);
  });
});

describe('checkLocale', () => {
  const broken = (change: (messages: any) => void) => {
    const messages = structuredClone(en) as any;
    change(messages);
    return checkLocale({ ...english(), messages });
  };

  it('finds a missing message', () => {
    expect(broken((m) => delete m.nav.timeline)).toEqual(['the message "nav.timeline" is missing']);
  });

  it('finds a message the theme does not have', () => {
    expect(broken((m) => (m.nav.blog = 'Blog'))).toEqual(['there is no message "nav.blog"']);
  });

  it('finds a lost or invented placeholder', () => {
    expect(broken((m) => (m.footer.lead = 'Found a mistake?'))[0]).toContain('"footer.lead" must have the placeholders of the English one: {site}');
    expect(broken((m) => (m.nav.map = 'Map of {place}'))[0]).toContain('"nav.map" must have the placeholders of the English one: none');
  });

  it('finds a plural written as a text, and a text written as a plural', () => {
    expect(broken((m) => (m.filter.count = '{count} events'))[0]).toContain('must be a plural');
    expect(broken((m) => (m.nav.map = { one: 'Map', other: 'Maps' }))[0]).toContain('must be a text');
  });

  it('finds an empty message', () => expect(broken((m) => (m.nav.map = ' '))).toEqual(['the message "nav.map" is empty']));

  it('lets a wiki fill in or leave out the examples for its date labels', () => {
    expect(en.confidence.firm.example).toBe('');
    expect(broken((m) => (m.confidence.firm.example = 'The Council of Nicaea, AD 325.'))).toEqual([]);
  });

  it('lets a wiki add names of source languages', () => {
    expect(broken((m) => (m.languages.Sumerian = 'Sumerian'))).toEqual([]);
  });

  it('finds a book of the Bible without a name', () => {
    const { Gen: _, ...books } = english().bible.books;
    expect(checkLocale({ ...english(), bible: { ...english().bible, books } })).toEqual(['these books of the Bible have no name: Gen']);
  });

  it('finds a code that cannot open an address', () => {
    expect(checkLocale({ ...english(), code: 'Deutsch (CH)' })[0]).toContain('cannot open an address');
  });
});

describe('a wiki’s own wording', () => {
  it('is laid over the theme’s, message by message', () => {
    const locale = english({ messages: { site: { tagline: 'Rome on one timeline.' } } });
    expect(locale.messages.site.tagline).toBe('Rome on one timeline.');
    expect(locale.messages.site.description).toBe(en.site.description);
    expect(locale.messages.nav.timeline).toBe('Timeline');
    expect(checkLocale(locale)).toEqual([]);
  });

  it('replaces a plural whole', () => {
    const locale = english({ messages: { filter: { count: { other: '{count} entries' } } } });
    expect(locale.messages.filter.count).toEqual({ other: '{count} entries' });
  });

  it('does not change the theme’s messages', () => {
    english({ messages: { nav: { timeline: 'Chronology' } } });
    expect(en.nav.timeline).toBe('Timeline');
    expect(english().messages.nav.timeline).toBe('Timeline');
  });

  it('makes a language a preview on request', () => {
    expect(german().status).toBe('live');
    expect(german({ status: 'preview' }).status).toBe('preview');
  });
});

describe('defineWiki', () => {
  const regions: RegionInput[] = [
    { id: 'levant', name: { en: 'Levant', de: 'Levante' } },
    { id: 'egypt', name: 'Egypt' },
    { id: 'italy', name: { en: 'Italy' } },
  ];

  it('writes in English when no language is named', () => {
    const wiki = defineWiki({ name: 'W', regions });
    expect(wiki.defaultLocale).toBe('en');
    expect(wiki.locales.map((locale) => locale.code)).toEqual(['en']);
  });

  it('takes the first language as the one the content is written in', () => {
    expect(defineWiki({ name: 'W', regions, locales: [german(), english()] }).defaultLocale).toBe('de');
  });

  it('keeps the regions in their order and names them in every language', () => {
    const wiki = defineWiki({ name: 'W', regions, locales: [english(), german()] });
    expect(wiki.regions).toEqual(['levant', 'egypt', 'italy']);
    expect(wiki.regionNames.de).toEqual({ levant: 'Levante', egypt: 'Egypt', italy: 'Italy' });
    expect(wiki.regionNames.en.levant).toBe('Levant');
  });

  it('says which names are missing in which language', () => {
    expect(missingRegionNames({ name: 'W', regions, locales: [english(), german()] })).toEqual([['de', 'italy']]);
  });

  it('takes a language written out in full, live and with English Bible references unless it says otherwise', () => {
    const { status: _status, bible: _bible, ...french } = { ...english(), code: 'fr', name: 'Français' };
    const wiki = defineWiki({ name: 'W', regions, locales: [english(), french] });
    expect(wiki.locales[1].status).toBe('live');
    expect(wiki.locales[1].bible).toBe(english().bible);
    expect(checkLocale(wiki.locales[1])).toEqual([]);
  });

  it('refuses a language listed twice and a region id that is not an id', () => {
    expect(() => defineWiki({ name: 'W', regions, locales: [english(), english()] })).toThrow(/listed twice/);
    expect(() => defineWiki({ name: 'W', regions: [{ id: 'The Levant', name: 'Levant' }] })).toThrow(/region id/);
  });
});

describe('the wiki’s settings in a page', () => {
  it('names a region in the page’s language', () => {
    expect(i18nFor('en').region('levant')).toBe('Levant');
    expect(i18nFor('de').region('levant')).toBe('Levante');
    // One name given for all languages.
    expect(i18nFor('de').region('mesopotamia')).toBe('Mesopotamia');
  });

  it('names the language the wiki is written in', () => {
    expect(i18nFor('en').originalLanguage).toBe('English');
    expect(i18nFor('de').originalLanguage).toBe('Englisch');
  });
});

describe('addresses', () => {
  it('keeps English at the root and puts every other language under its code', () => {
    expect(localizedPath('/events/council-of-nicaea/', DEFAULT_LOCALE)).toBe('/events/council-of-nicaea/');
    expect(localizedPath('/events/council-of-nicaea/', 'de')).toBe('/de/events/council-of-nicaea/');
    expect(localizedPath('/', 'de')).toBe('/de/');
  });

  it('builds links in the language', () => {
    expect(i18nFor('en').href('/people/')).toBe('/people/');
    expect(i18nFor('de').href('/people/')).toBe('/de/people/');
    expect(i18nFor('de').href('/?thread=covenant')).toBe('/de/?thread=covenant');
    expect(i18nFor('de').href('/about/#corrections')).toBe('/de/about/#corrections');
    expect(i18nFor('de').href('/data/map.json')).toBe('/de/data/map.json');
  });

  it('does not put a language into the address of a shared file', () => {
    expect(i18nFor('de').asset('/geo/')).toBe('/geo/');
    expect(i18nFor('de').asset('/pagefind/pagefind.js')).toBe('/pagefind/pagefind.js');
  });

  it('reads the language of an address', () => {
    expect(localeOfPath('/de/events/x/')).toBe('de');
    expect(localeOfPath('/events/x/')).toBe('en');
    expect(localeOfPath('/')).toBe('en');
    // "/design/" is not the German site.
    expect(localeOfPath('/design/')).toBe('en');
  });

  it('takes the language out of an address', () => {
    expect(neutralPath('/de/events/x/')).toBe('/events/x/');
    expect(neutralPath('/de/')).toBe('/');
    expect(neutralPath('/events/x/')).toBe('/events/x/');
  });

  it('lists the same page in the other languages', () => {
    const alternates = i18nFor('de').alternates('/de/events/x/');
    expect(alternates.find((alternate) => alternate.code === 'en')?.href).toBe('/events/x/');
    expect(alternates.filter((alternate) => alternate.current).map((alternate) => alternate.code)).toEqual(
      alternates.some((alternate) => alternate.code === 'de') ? ['de'] : [],
    );
  });
});

describe('formatting', () => {
  it('sorts as the language sorts', () => {
    const names = ['Zwingli', 'Äbtissin', 'Abraham'];
    expect([...names].sort(i18nFor('de').compare)).toEqual(['Abraham', 'Äbtissin', 'Zwingli']);
  });

  it('joins lists as the language does', () => {
    expect(i18nFor('en').list(['Rome', 'Paris', 'Beijing'])).toBe('Rome, Paris, and Beijing');
    expect(i18nFor('de').list(['Rom', 'Paris', 'Peking'])).toBe('Rom, Paris und Peking');
  });

  it('names the language of a source', () => {
    expect(i18nFor('de').languageName('Latin')).toBe('Latein');
    expect(i18nFor('de').languageName('Greek and Latin')).toBe('Griechisch und Latein');
    expect(i18nFor('de').languageName('Hebrew, Aramaic and Greek')).toBe('Hebräisch, Aramäisch und Griechisch');
    // A description that is more than a list of languages is left as written.
    expect(i18nFor('de').languageName('Syriac, translated from Greek')).toBe('Syriac, translated from Greek');
    expect(i18nFor('en').languageName('Latin')).toBe('Latin');
  });

  it('writes a day of our own time day first, as the dates of the timeline are written', () => {
    const day = new Date(Date.UTC(2026, 9, 4));
    expect(i18nFor('en').day(day)).toBe('4 October 2026');
    expect(i18nFor('de').day(day)).toBe('4. Oktober 2026');
  });

  it('turns the arrows round where the text runs right to left', () => {
    expect(i18nFor('en').arrow).toEqual({ back: '←', forward: '→' });
  });
});
