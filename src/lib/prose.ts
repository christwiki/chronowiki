/**
 * Turns an entry's Markdown into HTML and resolves the wiki syntax:
 *
 *   [[bible:2 Kings 25:8-10]]        citation of Scripture
 *   [[cite:key]]                     citation of a source listed in the entry's `citations`
 *   [[person:id]], [[place:id|text]] internal links (also event, thread, source, era)
 *
 * Astro's own Markdown pipeline is not involved, so the same renderer serves
 * entry bodies and front-matter fields, and it can be unit-tested as a pure function.
 */
import { micromark } from 'micromark';
import { EN_QUOTES, smarten, smartenMarkdown, type Quotes } from './typography';
import { BibleRefError, EN_BIBLE, parseBibleRef, type BibleRef, type BibleStyle } from './bible';

export type LinkType = 'person' | 'place' | 'event' | 'thread' | 'source' | 'era';

const LINK_TYPES: readonly LinkType[] = ['person', 'place', 'event', 'thread', 'source', 'era'];

export interface CitationDef {
  source: string;
  at?: string;
  url?: string;
}

export interface SourceInfo {
  id: string;
  cite: string;
  title: string;
  url: string;
  href: string;
}

export interface ProseContext {
  /** Name and URL of an entry. An empty `href` means the entry exists but has no page yet. */
  resolve(type: LinkType, id: string): { href: string; label: string } | undefined;
  citations: Record<string, CitationDef>;
  source(id: string): SourceInfo | undefined;
  /**
   * The language of the text being rendered: how it writes Bible references,
   * its quotation marks, and whether titles lose their article inside a
   * sentence. All three default to English.
   */
  bible?: BibleStyle;
  quotes?: Quotes;
  articleRule?: 'english';
  /**
   * Where the text will be read. On the `web` (the default) a citation opens
   * the passage itself. In a `book`, which may be read on a device with no
   * browser, a citation of a source leads to that source's own entry and a
   * Bible reference is not a link: the reference is all a reader needs.
   */
  medium?: 'web' | 'book';
}

export type Token =
  | { kind: 'bible'; raw: string; ref: string }
  | { kind: 'cite'; raw: string; key: string }
  | { kind: 'link'; raw: string; type: LinkType; id: string; label?: string }
  | { kind: 'unknown'; raw: string; type: string };

export interface UsedCitation {
  key: string;
  source: SourceInfo;
  at?: string;
  url: string;
  label: string;
}

export interface ProseResult {
  html: string;
  /** Distinct Bible passages cited, in order of first appearance. */
  bible: BibleRef[];
  /** Distinct source citations used, in order of first appearance. */
  cites: UsedCitation[];
  /** Internal links, in order, repeats included. */
  links: { type: LinkType; id: string }[];
  errors: string[];
}

const TOKEN = /\[\[([a-z]+):([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Private-use characters survive Markdown untouched and cannot occur in content.
const OPEN = '';
const CLOSE = '';
const PLACEHOLDER = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');

function toToken(raw: string, type: string, target: string, label?: string): Token {
  const value = target.trim();
  if (type === 'bible') return { kind: 'bible', raw, ref: value };
  if (type === 'cite') return { kind: 'cite', raw, key: value };
  if ((LINK_TYPES as readonly string[]).includes(type)) {
    const token: Token = { kind: 'link', raw, type: type as LinkType, id: value };
    if (label !== undefined) token.label = label.trim();
    return token;
  }
  return { kind: 'unknown', raw, type };
}

/** Every wiki token in a piece of Markdown, in order. Used by the validator. */
export function scanTokens(markdown: string): Token[] {
  return [...markdown.matchAll(TOKEN)].map((m) => toToken(m[0], m[1], m[2], m[3]));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Citation label: the source's short form followed by the locator. A short form
 * may end in a comma ("Suetonius,") so that "Claudius 25.4" reads naturally
 * after it; the comma is dropped when there is no locator.
 */
export function citationLabel(cite: string, at?: string): string {
  return at ? `${cite} ${at}` : cite.replace(/,\s*$/, '');
}

/**
 * A link without a label shows the target's title. A title that opens with "The"
 * reads badly inside a sentence ("at the The First Council of Nicaea"), so the
 * article is dropped after "the" and written small after any other word. At the
 * start of a sentence, a line or a parenthesis the title stands as it is.
 */
export function titleInSentence(title: string, before: string): string {
  if (!title.startsWith('The ')) return title;
  const text = before.replace(/[ \t]+$/, '');
  if (text === '' || /[\n.!?(\[“"‘>*_-]$/.test(text)) return title;
  const previous = /([\p{L}\p{N}]+)$/u.exec(text)?.[1];
  if (previous?.toLowerCase() === 'the') return title.slice(4);
  return `the ${title.slice(4)}`;
}

function render(markdown: string, ctx: ProseContext, inline: boolean): ProseResult {
  const result: ProseResult = { html: '', bible: [], cites: [], links: [], errors: [] };
  const replacements: string[] = [];
  const bible = ctx.bible ?? EN_BIBLE;
  const quotes = ctx.quotes ?? EN_QUOTES;

  const fail = (token: Token, message: string): string => {
    result.errors.push(message);
    return escapeHtml(token.raw);
  };

  const htmlFor = (token: Token, before: string): string => {
    switch (token.kind) {
      case 'bible': {
        let ref: BibleRef;
        try {
          ref = parseBibleRef(token.ref, bible);
        } catch (error) {
          if (!(error instanceof BibleRefError)) throw error;
          return fail(token, `Invalid Bible reference "${token.ref}"`);
        }
        if (!result.bible.some((b) => b.osis === ref.osis)) result.bible.push(ref);
        if (ctx.medium === 'book') {
          return `<span class="cite cite--bible">(${ref.links.map((link) => escapeHtml(link.label)).join('; ')})</span>`;
        }
        // Most readers take the whole reference in one link; some take one passage at a time.
        return ref.links
          .map((link, index) => {
            const open = index === 0 ? '(' : '';
            const close = index === ref.links.length - 1 ? ')' : '';
            return `<a class="cite cite--bible" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${open}${escapeHtml(link.label)}${close}</a>`;
          })
          .join('; ');
      }
      case 'cite': {
        const def = ctx.citations[token.key];
        if (!def) return fail(token, `Citation key "${token.key}" is not defined in citations`);
        const source = ctx.source(def.source);
        if (!source) return fail(token, `Citation "${token.key}" points to unknown source "${def.source}"`);
        const url = def.url ?? source.url;
        const label = smarten(citationLabel(source.cite, def.at), quotes);
        if (!result.cites.some((c) => c.key === token.key)) {
          const used: UsedCitation = { key: token.key, source, url, label };
          if (def.at !== undefined) used.at = def.at;
          result.cites.push(used);
        }
        if (ctx.medium === 'book') {
          const text = `(${escapeHtml(label)})`;
          return source.href
            ? `<a class="cite cite--source" href="${escapeHtml(source.href)}">${text}</a>`
            : `<span class="cite cite--source">${text}</span>`;
        }
        return `<a class="cite cite--source" href="${escapeHtml(url)}" data-source="${escapeHtml(source.id)}" target="_blank" rel="noopener">(${escapeHtml(label)})</a>`;
      }
      case 'link': {
        const target = ctx.resolve(token.type, token.id);
        if (!target) return fail(token, `Unknown ${token.type} "${token.id}"`);
        result.links.push({ type: token.type, id: token.id });
        const label = token.label ?? (ctx.articleRule === 'english' ? titleInSentence(target.label, before) : target.label);
        const text = escapeHtml(smarten(label, quotes));
        // An entry that exists but is not published yet has no page to link to.
        if (!target.href) return `<span class="wikilink wikilink--pending">${text}</span>`;
        return `<a class="wikilink wikilink--${token.type}" href="${escapeHtml(target.href)}">${text}</a>`;
      }
      case 'unknown':
        return fail(token, `Unknown link type "${token.type}"`);
    }
  };

  const withPlaceholders = markdown.replace(TOKEN, (raw: string, type: string, target: string, label: string | undefined, offset: number) => {
    replacements.push(htmlFor(toToken(raw, type, target, label), markdown.slice(Math.max(0, offset - 40), offset)));
    return `${OPEN}${replacements.length - 1}${CLOSE}`;
  });

  let html = micromark(smartenMarkdown(withPlaceholders, quotes)).trim();
  if (inline) html = html.replace(/^<p>/, '').replace(/<\/p>$/, '');
  result.html = html.replace(PLACEHOLDER, (_, index: string) => replacements[Number(index)]);
  return result;
}

/** Render block Markdown (paragraphs, lists, quotations). */
export function renderProse(markdown: string, ctx: ProseContext): ProseResult {
  return render(markdown, ctx, false);
}

/** Render a single line without the wrapping paragraph, for summaries and titles. */
export function renderInline(markdown: string, ctx: ProseContext): ProseResult {
  return render(markdown, ctx, true);
}
