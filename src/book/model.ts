/**
 * The wiki as a book: the same entries as the site, laid out to be read from
 * front to back and to be found by links. The timeline comes first, era by
 * era and event by event; then the threads; then people, places and sources
 * in alphabetical order; and last the page that says how the wiki is made.
 *
 * Every link in the book leads to an entry inside it, and every person,
 * place and source lists the events it belongs to. So there is always a way
 * on and a way back, on a device with no browser and no back button.
 */
import { createHash } from 'node:crypto';
import config from 'virtual:chronowiki/config';
import { i18nFor, isDefaultLocale } from '../i18n';
import type { MessageKey } from '../i18n/types';
import { CONFIDENCE_LEVELS, type WikiDate } from '../lib/dates';
import { neighbours } from '../lib/graph';
import { renderProse, type LinkType, type ProseContext, type ProseResult } from '../lib/prose';
import {
  getSite,
  isPublished,
  linkFor,
  proseContext,
  writtenLabel,
  type EntryI18n,
  type EventView,
  type PersonEntry,
  type PlaceEntry,
  type SourceEntry,
} from '../lib/site';
import { bookRef, type Book, type BookDoc } from './types';
import { esc } from './xml';

/** How many entries of the alphabetical parts go into one document. Small documents open fast on an e-reader. */
const PER_DOCUMENT = { people: 40, places: 40, sources: 30 };

/** The file name of the book in a language, without extension: `christwiki`, `christwiki-de`. */
export function bookSlug(code: string): string {
  const name = config.name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${name || 'wiki'}${isDefaultLocale(code) ? '' : `-${code}`}`;
}

/** A name for the book that stays the same from edition to edition, in the form of a UUID. */
function identifier(url: string, code: string): string {
  const hex = createHash('sha1').update(`${url}|${code}|book`).digest('hex');
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const count = Math.ceil(items.length / size);
  const each = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, index) => items.slice(index * each, (index + 1) * each));
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const capital = (text: string, code: string) => text.charAt(0).toLocaleUpperCase(code) + text.slice(1);

async function build(code: string, siteUrl: string): Promise<Book> {
  const site = await getSite(code);
  const { i18n } = site;
  const { t } = i18n;
  const modified = new Date();

  /** The `lang` attribute for an entry's words, where they are not in the book's language. */
  const lang = (entry: { i18n: EntryI18n }) => (entry.i18n.lang === code ? '' : ` lang="${entry.i18n.lang}" xml:lang="${entry.i18n.lang}"`);
  const link = (ref: string, text: string, attrs = '') => `<a href="${ref}"${attrs}>${esc(text)}</a>`;

  /** An entry's text for the book: links lead to entries in the book, citations to the source's entry. */
  function context(entry: Parameters<typeof proseContext>[1]): ProseContext {
    const web = proseContext(site, entry);
    return {
      ...web,
      medium: 'book',
      resolve(type, id) {
        const found = web.resolve(type, id);
        return found && { label: found.label, href: found.href ? bookRef(type, id) : '' };
      },
      source(id) {
        const found = web.source(id);
        const source = site.sources.get(id);
        return found && { ...found, href: source && isPublished(source) ? bookRef('source', id) : '' };
      },
    };
  }
  const prose = (entry: Parameters<typeof proseContext>[1], markdown: string): ProseResult => renderProse(markdown, context(entry));

  /** A name that links to its entry, or plain words where the entry is not published. */
  function named(type: LinkType, id: string): string {
    const found = linkFor(site, type, id);
    if (!found) return '';
    return found.href ? link(bookRef(type, id), found.label) : esc(found.label);
  }

  const eventRow = (event: EventView, note?: string) =>
    `<li>${link(bookRef('event', event.id), event.title, lang(event.entry))} <span class="when">${esc(note ?? event.dateLabel)}</span></li>`;
  const eventList = (events: EventView[]) => `<ul class="links">${events.map((event) => eventRow(event)).join('')}</ul>`;

  const docs: BookDoc[] = [];
  const part = (id: string, title: string, lead: string, rows: string[]): BookDoc => ({
    id: `part-${id}`,
    kind: 'part',
    title,
    level: 1,
    targets: [{ ref: bookRef('part', id), anchor: '' }],
    html: `<h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}<ul class="links">${rows.join('')}</ul>`,
  });

  // An index puts "The Cyrus Cylinder" under C. Only English titles are known to open with an article that is passed over.
  const filed = (title: string, entry: { i18n: EntryI18n }) => (entry.i18n.lang === 'en' ? title.replace(/^(The|An?)\s+/, '') : title);
  const people = [...site.people.values()].filter(isPublished).sort((a, b) => i18n.compare(a.data.name, b.data.name));
  const places = [...site.places.values()].filter(isPublished).sort((a, b) => i18n.compare(a.data.name, b.data.name));
  const sources = [...site.sources.values()]
    .filter(isPublished)
    .sort((a, b) => i18n.compare(filed(a.data.title, a), filed(b.data.title, b)));
  const eras = site.eras.filter((era) => site.byEra.has(era.id));
  const threads = site.threads.filter((thread) => site.byThread.has(thread.id));

  // --- the title page and how to read the book --------------------------------------
  const counts = i18n.list([
    t('common.events', { count: site.events.length }),
    t('book.people', { count: people.length }),
    t('places.count', { count: places.length }),
    t('book.sources', { count: sources.length }),
  ]);
  const edition = t('book.edition', { date: i18n.day(modified) });
  const address = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  docs.push({
    id: 'title',
    kind: 'title',
    title: config.name,
    level: 1,
    targets: [{ ref: bookRef('part', 'title'), anchor: '' }],
    html: `<div class="titlepage"><h1>${esc(config.name)}</h1><p class="lead">${esc(t('site.tagline'))}</p><p class="edition">${esc(edition)}<br/><a href="${esc(siteUrl)}">${esc(address)}</a></p><p class="edition">${esc(counts)}${config.license ? `<br/>${esc(t('footer.license', { license: config.license.name }))}` : ''}</p></div>`,
  });

  docs.push({
    id: 'how',
    kind: 'page',
    title: t('book.howTitle'),
    level: 1,
    targets: [{ ref: bookRef('part', 'how'), anchor: '' }],
    html: [
      `<h1>${esc(t('book.howTitle'))}</h1>`,
      `<p>${esc(t('book.howOrder'))}</p>`,
      `<p>${esc(t('book.howLinks'))}</p>`,
      `<p>${esc(t('book.howCitations'))}</p>`,
      `<p>${esc(t('book.howDates'))}</p>`,
      `<ul class="plain">${CONFIDENCE_LEVELS.map((level) => `<li><b>${esc(t(`confidence.${level}.label`))}.</b> ${esc(t(`confidence.${level}.description`))}</li>`).join('')}</ul>`,
      `<p>${esc(t('book.howUpdated', { site: config.name, url: address, edition }))}</p>`,
    ].join(''),
  });

  // --- the timeline: eras and their events ---------------------------------------
  docs.push(
    part(
      'timeline',
      t('nav.timeline'),
      t('home.lead', { count: site.events.length }),
      eras.map((era) => `<li>${link(bookRef('era', era.id), era.data.title, lang(era))} <span class="when">${esc(era.data.span)}</span></li>`),
    ),
  );

  for (const era of eras) {
    const events = site.byEra.get(era.id) ?? [];
    docs.push({
      id: `era-${era.id}`,
      kind: 'era',
      title: era.data.title,
      level: 2,
      targets: [{ ref: bookRef('era', era.id), anchor: '' }],
      html: [
        `<p class="kicker">${link(bookRef('part', 'timeline'), t('nav.timeline'))}</p>`,
        `<h1${lang(era)}>${esc(era.data.title)}</h1>`,
        `<p class="date"${lang(era)}>${esc(era.data.span)}</p>`,
        `<p class="lead"${lang(era)}>${esc(era.data.summary)}</p>`,
        `<div class="prose"${lang(era)}>${prose(era, era.body ?? '').html}</div>`,
        `<p class="label">${esc(t('eras.eventsOf'))}</p>`,
        eventList(events),
      ].join(''),
    });

    for (const event of events) docs.push(eventDoc(event));
  }

  function eventDoc(event: EventView): BookDoc {
    const { data, entry } = event;
    const era = event.eraEntry;
    const body = prose(entry, event.body);
    const dating = data.dating ? prose(entry, data.dating) : undefined;
    const confidence = t(`confidence.${event.date.confidence}.label`);

    // Everything cited anywhere in the entry, each passage and each source once.
    const bible = [...body.bible];
    const cites = [...body.cites];
    for (const ref of dating?.bible ?? []) if (!bible.some((b) => b.osis === ref.osis)) bible.push(ref);
    for (const cite of dating?.cites ?? []) if (!cites.some((c) => c.key === cite.key)) cites.push(cite);
    const bySource = new Map<string, typeof cites>();
    for (const cite of cites) bySource.set(cite.source.id, [...(bySource.get(cite.source.id) ?? []), cite]);

    const html: string[] = [
      `<p class="kicker">${link(bookRef('era', era.id), era.data.title, lang(era))}</p>`,
      `<h1${lang(entry)}>${esc(event.title)}</h1>`,
      `<p class="date">${esc(event.dateLabel)} · ${esc(confidence)}</p>`,
      `<p class="lead"${lang(entry)}>${esc(data.summary)}</p>`,
      `<div class="prose"${lang(entry)}>${body.html}</div>`,
    ];

    if (dating || event.date.confidence === 'firm') {
      html.push(`<h2 class="section">${esc(t('event.datingTitle'))}</h2>`);
      html.push(`<p class="note"><b>${esc(confidence)}.</b> ${esc(t(`confidence.${event.date.confidence}.description`))}</p>`);
      if (dating) html.push(`<div class="prose small"${lang(entry)}>${dating.html}</div>`);
    }

    if (bible.length > 0 || cites.length > 0) {
      html.push(`<h2 class="section">${esc(t('common.primarySources'))}</h2><ul class="sources">`);
      if (bible.length > 0) {
        const passages = bible.flatMap((ref) => ref.links.map((passage) => passage.label));
        html.push(`<li><b>${esc(t('sourceList.scripture'))}</b><br/><span class="cite"${lang(entry)}>${esc(passages.join('; '))}</span></li>`);
      }
      for (const group of bySource.values()) {
        const source = site.sources.get(group[0].source.id)!;
        const meta = [source.data.author, writtenLabel(site, source)].filter(Boolean).join(' · ');
        const title = isPublished(source) ? link(bookRef('source', source.id), source.data.title, lang(source)) : esc(source.data.title);
        const passages = group.map((cite) => `<a href="${esc(cite.url)}">${esc(cite.at ?? hostOf(cite.url))}</a>`).join('; ');
        html.push(`<li>${title}${meta ? ` <span class="when">${esc(meta)}</span>` : ''}<br/><span class="cite">${passages}</span></li>`);
      }
      html.push('</ul>');
      html.push(`<p class="meta">${esc(data.reviewed ? t('event.reviewed', { date: i18n.day(data.reviewed) }) : t('event.awaiting'))}</p>`);
    }

    const fact = (label: MessageKey, type: LinkType, ids: string[]) => {
      const names = ids.map((id) => named(type, id)).filter(Boolean);
      if (names.length > 0) html.push(`<p class="facts"><b>${esc(t(label))}</b> ${names.join(', ')}</p>`);
    };
    html.push(`<h2 class="section">${esc(t('event.aside'))}</h2>`);
    fact('event.where', 'place', event.places);
    fact('event.who', 'person', event.people);
    fact('event.threads', 'thread', event.threads);

    const follows = event.follows.flatMap((id) => site.eventsById.get(id) ?? []);
    const leadsTo = (site.leadsTo.get(event.id) ?? []).flatMap((id) => site.eventsById.get(id) ?? []);
    const along = event.threads.flatMap((id) => {
      const thread = site.threadsById.get(id);
      const { prev, next } = neighbours(site.byThread.get(id) ?? [], event.id);
      return thread && (prev || next) ? [{ thread, prev, next }] : [];
    });
    if (follows.length > 0 || leadsTo.length > 0 || along.length > 0) {
      html.push(`<h2 class="section">${esc(t('event.context'))}</h2>`);
      if (follows.length > 0) html.push(`<p class="label">${esc(t('event.growsOutOf'))}</p>${eventList(follows)}`);
      if (leadsTo.length > 0) html.push(`<p class="label">${esc(t('event.leadsTo'))}</p>${eventList(leadsTo)}`);
      for (const { thread, prev, next } of along) {
        html.push(`<p class="label">${link(bookRef('thread', thread.id), thread.data.title, lang(thread))}</p><ul class="links">`);
        if (prev) html.push(eventRow(prev, t('event.before', { date: prev.dateLabel })));
        if (next) html.push(eventRow(next, t('event.after', { date: next.dateLabel })));
        html.push('</ul>');
      }
    }

    const { prev, next } = neighbours(site.events, event.id);
    if (prev || next) {
      const rows = [
        prev && `${i18n.arrow.back} ${link(bookRef('event', prev.id), prev.title, lang(prev.entry))} <span class="when">${esc(t('event.earlier', { date: prev.dateLabel }))}</span>`,
        next && `${i18n.arrow.forward} ${link(bookRef('event', next.id), next.title, lang(next.entry))} <span class="when">${esc(t('event.later', { date: next.dateLabel }))}</span>`,
      ].filter(Boolean);
      html.push(`<p class="pager">${rows.join('<br/>')}</p>`);
    }

    return {
      id: `event-${event.id}`,
      kind: 'event',
      title: event.title,
      level: 3,
      targets: [{ ref: bookRef('event', event.id), anchor: '' }],
      html: html.join(''),
    };
  }

  // --- threads --------------------------------------------------------------------
  if (threads.length > 0) {
    docs.push(
      part(
        'threads',
        t('threads.title'),
        t('threads.lead'),
        threads.map((thread) => `<li>${link(bookRef('thread', thread.id), thread.data.title, lang(thread))}</li>`),
      ),
    );
    for (const thread of threads) {
      docs.push({
        id: `thread-${thread.id}`,
        kind: 'thread',
        title: thread.data.title,
        level: 2,
        targets: [{ ref: bookRef('thread', thread.id), anchor: '' }],
        html: [
          `<p class="kicker">${link(bookRef('part', 'threads'), t('threads.title'))}</p>`,
          `<h1${lang(thread)}>${esc(thread.data.title)}</h1>`,
          `<p class="lead"${lang(thread)}>${esc(thread.data.summary)}</p>`,
          `<div class="prose"${lang(thread)}>${prose(thread, thread.body ?? '').html}</div>`,
          `<p class="label">${esc(t('threads.whole'))}</p>`,
          eventList(site.byThread.get(thread.id) ?? []),
        ].join(''),
      });
    }
  }

  // --- people, places and sources, in alphabetical order ---------------------------
  function alphabetical<T extends { id: string }>(
    id: 'people' | 'places' | 'sources',
    type: LinkType,
    title: string,
    lead: string,
    entries: T[],
    nameOf: (entry: T) => string,
    render: (entry: T, anchor: string) => string,
  ) {
    if (entries.length === 0) return;
    const groups = chunk(entries, PER_DOCUMENT[id]);
    const titles = groups.map((group) =>
      group.length === 1 ? nameOf(group[0]) : t('common.range', { first: nameOf(group[0]), last: nameOf(group[group.length - 1]) }),
    );
    const number = (index: number) => String(index + 1).padStart(2, '0');
    docs.push(part(id, title, lead, groups.map((_, index) => `<li>${link(bookRef('chapter', `${id}-${number(index)}`), titles[index])}</li>`)));
    groups.forEach((group, index) => {
      const anchorOf = (entry: T) => `${type}-${entry.id}`;
      docs.push({
        id: `${id}-${number(index)}`,
        kind: 'index',
        title: titles[index],
        level: 2,
        targets: [
          { ref: bookRef('chapter', `${id}-${number(index)}`), anchor: '' },
          ...group.map((entry) => ({ ref: bookRef(type, entry.id), anchor: anchorOf(entry) })),
        ],
        html: [
          `<p class="kicker">${link(bookRef('part', id), title)}</p>`,
          `<h1>${esc(titles[index])}</h1>`,
          ...group.map((entry) => render(entry, anchorOf(entry))),
        ].join(''),
      });
    });
  }

  const appears = (label: MessageKey, events: EventView[]) =>
    events.length > 0 ? `<p class="label">${esc(t(label))}</p>${eventList(events)}` : '';
  const facts = (items: (string | undefined | false)[]) => {
    const shown = items.filter(Boolean) as string[];
    return shown.length > 0 ? `<p class="date">${shown.map(esc).join(' · ')}</p>` : '';
  };

  alphabetical<PersonEntry>(
    'people',
    'person',
    t('people.title'),
    t('people.lead', { count: people.length }),
    people,
    (person) => person.data.name,
    (person, anchor) => {
      const { data } = person;
      // Dates of an entry that is still in the original language are written that language's way, like its other words.
      const life = i18nFor(person.i18n.lang).lifespan(data.born as WikiDate | undefined, data.died as WikiDate | undefined);
      return [
        `<h2 class="entry" id="${anchor}"${lang(person)}>${esc(data.name)}</h2>`,
        facts([data.role, life, data.altNames.length > 0 && t('common.also', { names: data.altNames.join(', ') })]),
        `<p class="lead"${lang(person)}>${esc(data.summary)}</p>`,
        `<div class="prose"${lang(person)}>${prose(person, person.body ?? '').html}</div>`,
        appears('people.inTimeline', site.byPerson.get(person.id) ?? []),
      ].join('');
    },
  );

  const degrees = new Intl.NumberFormat(code, { maximumFractionDigits: 2 });
  alphabetical<PlaceEntry>(
    'places',
    'place',
    t('places.title'),
    t('places.lead', { count: places.length }),
    places,
    (place) => place.data.name,
    (place, anchor) => {
      const { data } = place;
      const latitude = t(data.lat >= 0 ? 'places.north' : 'places.south', { degrees: degrees.format(Math.abs(data.lat)) });
      const longitude = t(data.lon >= 0 ? 'places.east' : 'places.west', { degrees: degrees.format(Math.abs(data.lon)) });
      return [
        `<h2 class="entry" id="${anchor}"${lang(place)}>${esc(data.name)}</h2>`,
        facts([
          data.modern,
          i18n.region(data.region),
          t('places.coordinates', { lat: latitude, lon: longitude }),
          data.altNames.length > 0 && t('common.also', { names: data.altNames.join(', ') }),
        ]),
        data.location === 'known' ? '' : `<p class="note">${esc(t(`places.locationNote.${data.location}`))}</p>`,
        `<p class="lead"${lang(place)}>${esc(data.summary)}</p>`,
        `<div class="prose"${lang(place)}>${prose(place, place.body ?? '').html}</div>`,
        appears('places.happened', site.byPlace.get(place.id) ?? []),
      ].join('');
    },
  );

  alphabetical<SourceEntry>(
    'sources',
    'source',
    t('sources.title'),
    t('sources.lead', { count: sources.length }),
    sources,
    (source) => source.data.title,
    (source, anchor) => {
      const { data } = source;
      const isObject = ['inscription', 'artifact', 'manuscript'].includes(data.kind);
      const online = [
        `<a href="${esc(data.url)}">${esc(t(isObject ? 'sources.seeObject' : 'sources.readText', { host: hostOf(data.url) }))}</a>`,
        ...data.links.map((extra) => `<a href="${esc(extra.url)}"${lang(source)}>${esc(extra.label)}</a>`),
      ];
      const kept = [data.edition && `${t('sources.edition')}: ${data.edition}`, data.holding && `${t('sources.heldBy')}: ${data.holding}`].filter(Boolean) as string[];
      return [
        `<h2 class="entry" id="${anchor}"${lang(source)}>${esc(data.title)}</h2>`,
        facts([capital(t(`sourceKind.${data.kind}`), code), data.author, writtenLabel(site, source), data.language && i18n.languageName(data.language)]),
        `<p class="lead"${lang(source)}>${esc(data.summary)}</p>`,
        `<div class="prose"${lang(source)}>${prose(source, source.body ?? '').html}</div>`,
        kept.length > 0 ? `<p class="meta"${lang(source)}>${kept.map(esc).join('<br/>')}</p>` : '',
        `<p class="facts">${online.join(' · ')}</p>`,
        appears('sources.citedIn', site.bySource.get(source.id) ?? []),
      ].join('');
    },
  );

  // --- how the wiki is made ---------------------------------------------------------
  const about = site.pages.get('about');
  if (about) {
    const counted: Record<string, number> = { events: site.events.length, people: people.length, places: places.length, sources: sources.length };
    const labels = `<ul class="plain">${CONFIDENCE_LEVELS.map((level) => {
      const example = t(`confidence.${level}.example`);
      return `<li><b>${esc(t(`confidence.${level}.label`))}.</b> ${esc(t(`confidence.${level}.description`))}${example ? ` <span class="when">${esc(example)}</span>` : ''}</li>`;
    }).join('')}</ul>`;
    const body = prose(about, about.body ?? '')
      .html.replace(/<h2>\[[a-z-]+\]\s*/g, '<h2 class="section">')
      .replace(/\{(events|sources|places|people)\}/g, (_, name: string) => i18n.number(counted[name]))
      .replace('<p>{confidence-list}</p>', labels);
    docs.push({
      id: 'method',
      kind: 'page',
      title: about.data.title,
      level: 1,
      targets: [{ ref: bookRef('part', 'method'), anchor: '' }],
      html: `<h1${lang(about)}>${esc(about.data.title)}</h1><p class="lead"${lang(about)}>${esc(about.data.summary)}</p><div class="prose"${lang(about)}>${body}</div>`,
    });
  }

  const partsOf = (ids: string[]) =>
    ids.flatMap((id) => {
      const doc = docs.find((candidate) => candidate.id === `part-${id}`);
      return doc ? [{ ref: bookRef('part', id), title: doc.title }] : [];
    });

  return {
    meta: {
      title: config.name,
      tagline: t('site.tagline'),
      description: t('site.description'),
      language: code,
      dir: i18n.dir,
      identifier: identifier(siteUrl, code),
      modified,
      edition,
      url: siteUrl,
      rights: config.license ? `${config.license.name} (${config.license.url})` : undefined,
      slug: bookSlug(code),
      labels: { contents: t('book.contents'), parts: partsOf(['timeline', 'threads', 'people', 'places', 'sources']) },
    },
    docs,
  };
}

const built = new Map<string, Promise<Book>>();

/** The book in one language. Built once however many files are made from it. */
export function getBook(code: string, siteUrl: string): Promise<Book> {
  const key = `${code}|${siteUrl}`;
  let book = built.get(key);
  if (!book) {
    book = build(code, siteUrl);
    built.set(key, book);
  }
  return book;
}
