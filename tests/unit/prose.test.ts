import { describe, expect, it } from 'vitest';
import { citationLabel, renderInline, renderProse, scanTokens, titleInSentence, type ProseContext } from '../../src/lib/prose';

const ctx: ProseContext = {
  resolve: (type, id) => {
    if (type === 'person' && id === 'jeremiah') return { href: '/people/jeremiah/', label: 'Jeremiah' };
    if (type === 'place' && id === 'babylon') return { href: '/places/babylon/', label: 'Babylon' };
    if (type === 'person' && id === 'stub') return { href: '', label: 'Stub Person' };
    return undefined;
  },
  citations: {
    chron: { source: 'babylonian-chronicle-abc-5', at: 'rev. 11–13', url: 'https://example.org/abc5#rev11' },
    plain: { source: 'babylonian-chronicle-abc-5' },
    ghost: { source: 'no-such-source' },
  },
  source: (id) =>
    id === 'babylonian-chronicle-abc-5'
      ? {
          id,
          cite: 'Babylonian Chronicle ABC 5',
          title: 'Jerusalem Chronicle',
          url: 'https://example.org/abc5',
          href: '/sources/babylonian-chronicle-abc-5/',
        }
      : undefined,
};

describe('scanTokens', () => {
  it('finds every token kind', () => {
    const tokens = scanTokens(
      'A [[bible:Gen 12:1-3]] b [[cite:chron]] c [[person:jeremiah|the prophet]] d [[foo:bar]]',
    );
    expect(tokens).toEqual([
      { kind: 'bible', raw: '[[bible:Gen 12:1-3]]', ref: 'Gen 12:1-3' },
      { kind: 'cite', raw: '[[cite:chron]]', key: 'chron' },
      { kind: 'link', raw: '[[person:jeremiah|the prophet]]', type: 'person', id: 'jeremiah', label: 'the prophet' },
      { kind: 'unknown', raw: '[[foo:bar]]', type: 'foo' },
    ]);
  });
  it('trims whitespace inside tokens', () => {
    expect(scanTokens('[[ person : jeremiah | the prophet ]]')).toEqual([]);
    expect(scanTokens('[[person: jeremiah |the prophet ]]')).toEqual([
      { kind: 'link', raw: '[[person: jeremiah |the prophet ]]', type: 'person', id: 'jeremiah', label: 'the prophet' },
    ]);
  });
});

describe('renderProse', () => {
  it('wraps paragraphs', () => {
    expect(renderProse('One.\n\nTwo.', ctx).html).toBe('<p>One.</p>\n<p>Two.</p>');
  });

  it('renders emphasis and escapes raw HTML', () => {
    const { html } = renderProse('An *old* <script>x</script> text.', ctx);
    expect(html).toContain('<em>old</em>');
    expect(html).not.toContain('<script>');
  });

  it('renders a Bible citation as a parenthetical link', () => {
    const r = renderProse('The city fell [[bible:2 Kings 25:8-10]].', ctx);
    expect(r.html).toBe(
      '<p>The city fell <a class="cite cite--bible" href="https://www.biblegateway.com/passage/?search=2%20Kings%2025%3A8-10&amp;version=NRSVUE" target="_blank" rel="noopener">(2 Kings 25:8–10)</a>.</p>',
    );
    expect(r.bible.map((b) => b.osis)).toEqual(['2Kgs.25.8-2Kgs.25.10']);
    expect(r.errors).toEqual([]);
  });

  it('renders a source citation with its deep link', () => {
    const r = renderProse('Recorded in Babylon [[cite:chron]].', ctx);
    expect(r.html).toContain(
      '<a class="cite cite--source" href="https://example.org/abc5#rev11" data-source="babylonian-chronicle-abc-5" target="_blank" rel="noopener">(Babylonian Chronicle ABC 5 rev. 11–13)</a>',
    );
    expect(r.cites).toEqual([
      {
        key: 'chron',
        source: ctx.source('babylonian-chronicle-abc-5'),
        at: 'rev. 11–13',
        url: 'https://example.org/abc5#rev11',
        label: 'Babylonian Chronicle ABC 5 rev. 11–13',
      },
    ]);
  });

  it('falls back to the source URL', () => {
    const r = renderProse('See [[cite:plain]].', ctx);
    expect(r.html).toContain('href="https://example.org/abc5"');
    expect(r.html).toContain('(Babylonian Chronicle ABC 5)');
  });

  it('renders wiki links with default and custom labels', () => {
    const r = renderProse('[[person:jeremiah]] wrote to [[place:babylon|the exiles’ city]].', ctx);
    expect(r.html).toContain('<a class="wikilink wikilink--person" href="/people/jeremiah/">Jeremiah</a>');
    expect(r.html).toContain('<a class="wikilink wikilink--place" href="/places/babylon/">the exiles’ city</a>');
    expect(r.links).toEqual([
      { type: 'person', id: 'jeremiah' },
      { type: 'place', id: 'babylon' },
    ]);
  });

  it('reports problems and leaves the raw token visible', () => {
    const r = renderProse('[[person:nobody]] [[cite:missing]] [[cite:ghost]] [[bible:Gen 99:1]] [[foo:bar]]', ctx);
    expect(r.errors).toEqual([
      'Unknown person "nobody"',
      'Citation key "missing" is not defined in citations',
      'Citation "ghost" points to unknown source "no-such-source"',
      'Invalid Bible reference "Gen 99:1"',
      'Unknown link type "foo"',
    ]);
    expect(r.html).toContain('[[person:nobody]]');
  });

  it('lists a repeated citation once', () => {
    const r = renderProse('[[cite:chron]] and again [[cite:chron]]. [[bible:Gen 1:1]] [[bible:Genesis 1:1]]', ctx);
    expect(r.cites).toHaveLength(1);
    expect(r.bible).toHaveLength(1);
  });

  it('renders an unpublished entry as plain text, without an error', () => {
    const r = renderProse('See [[person:stub]].', ctx);
    expect(r.html).toBe('<p>See <span class="wikilink wikilink--pending">Stub Person</span>.</p>');
    expect(r.errors).toEqual([]);
  });

  it('escapes labels', () => {
    const r = renderProse('[[person:jeremiah|<b>J</b> & co]]', ctx);
    expect(r.html).toContain('&lt;b&gt;J&lt;/b&gt; &amp; co</a>');
  });

  it('keeps tokens intact next to Markdown punctuation', () => {
    const r = renderProse('*He wept* [[bible:Lam 1:1-2]], _then_ left.', ctx);
    expect(r.html).toContain('<em>He wept</em> <a class="cite cite--bible"');
    expect(r.html).toContain('(Lamentations 1:1–2)</a>, <em>then</em> left.');
  });
});

describe('renderInline', () => {
  it('does not wrap in a paragraph', () => {
    expect(renderInline('Fall of *Jerusalem*', ctx).html).toBe('Fall of <em>Jerusalem</em>');
  });
});

describe('citationLabel', () => {
  it('appends the locator', () => expect(citationLabel('Tacitus, Annals', '15.44')).toBe('Tacitus, Annals 15.44'));
  it('keeps a trailing comma before a locator', () =>
    expect(citationLabel('Suetonius,', 'Claudius 25.4')).toBe('Suetonius, Claudius 25.4'));
  it('drops a trailing comma when there is no locator', () => expect(citationLabel('Suetonius,')).toBe('Suetonius'));
});

describe('titleInSentence', () => {
  const title = 'The First Council of Nicaea';

  it('keeps a title at the start of a sentence, a line or a parenthesis', () => {
    expect(titleInSentence(title, '')).toBe(title);
    expect(titleInSentence(title, 'He went home. ')).toBe(title);
    expect(titleInSentence(title, 'as told elsewhere (')).toBe(title);
    expect(titleInSentence(title, 'first line\n\n')).toBe(title);
    expect(titleInSentence(title, '- ')).toBe(title);
  });

  it('drops the article after "the"', () => {
    expect(titleInSentence(title, 'He attended the ')).toBe('First Council of Nicaea');
    expect(titleInSentence(title, 'The ')).toBe('First Council of Nicaea');
  });

  it('writes the article small after any other word', () => {
    expect(titleInSentence(title, 'It is discussed under ')).toBe('the First Council of Nicaea');
    expect(titleInSentence(title, 'the council; see ')).toBe('the First Council of Nicaea');
  });

  it('leaves other titles alone', () => {
    expect(titleInSentence('Luther’s Ninety-five Theses', 'see ')).toBe('Luther’s Ninety-five Theses');
    expect(titleInSentence('Theodosius', 'under ')).toBe('Theodosius');
  });
});
