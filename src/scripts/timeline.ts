/**
 * Behaviour of the timeline page: tracks the era and the cards in view, marks
 * the era rail, filters the cards, keeps the filters in the URL, and drives the
 * linked map. Without this script the page is a complete, static timeline.
 */
import { locale, t } from './i18n';
import type { MapController } from './map';

const FILTER_KEYS = ['era', 'thread', 'region', 'confidence'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const cards = [...document.querySelectorAll<HTMLElement>('.event-card')];
const sections = [...document.querySelectorAll<HTMLElement>('.era')];
const rail = document.querySelector<HTMLElement>('[data-era-rail]');
const panel = document.querySelector<HTMLElement>('[data-map-panel]');
const mapRoot = panel?.querySelector<HTMLElement>('[data-map]');
const mapToggle = document.querySelector<HTMLButtonElement>('[data-map-toggle]');
const form = document.querySelector<HTMLFormElement>('[data-filter-bar]');

const cardById = new Map(cards.map((card) => [card.dataset.id!, card]));
const railLinks = new Map(
  [...(rail?.querySelectorAll<HTMLAnchorElement>('a[data-era]') ?? [])].map((link) => [link.dataset.era!, link]),
);

let map: MapController | undefined;
let mapLoading = false;
let currentEra: string | undefined;
let matching: Set<string> | null = null;
const inView = new Set<string>();

// --- map ----------------------------------------------------------------------

const eraEvents = (era: string) =>
  cards.filter((card) => card.dataset.era === era && (!matching || matching.has(card.dataset.id!))).map((c) => c.dataset.id!);

/**
 * The map follows the reader: it frames the places of the cards on screen. Where
 * those have no place (the undated opening chapters), it frames the whole era.
 */
let framed = '';
let frameTimer = 0;
function frameMap(animate = true) {
  if (!map) return;
  const onScreen = [...inView].filter((id) => !matching || matching.has(id)).sort();
  const key = `${currentEra} ${onScreen.join(' ')}`;
  if (key === framed) return;
  framed = key;
  if (onScreen.length > 0 && map.fitEvents(onScreen, animate)) return;
  if (currentEra) map.fitEvents(eraEvents(currentEra), animate);
}
/** Waits until scrolling pauses, so that the map moves once and not with every card. */
function frameMapSoon() {
  window.clearTimeout(frameTimer);
  frameTimer = window.setTimeout(() => frameMap(), 380);
}

function syncMap(animate = true) {
  if (!map) return;
  map.setFilter(matching);
  map.setVisible([...inView]);
  framed = '';
  frameMap(animate);
}

function selectEvent(id: string): boolean {
  const card = cardById.get(id);
  if (!card || card.closest('[hidden]')) return false;
  panel?.classList.remove('is-open');
  mapToggle?.setAttribute('aria-expanded', 'false');
  card.scrollIntoView({ block: 'center' });
  card.classList.add('is-highlighted');
  window.setTimeout(() => card.classList.remove('is-highlighted'), 2200);
  card.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  return true;
}

async function ensureMap() {
  if (map || mapLoading || !panel || !mapRoot) return;
  if (getComputedStyle(panel).display === 'none') return;
  mapLoading = true;
  try {
    const { createMap } = await import('./map');
    map = await createMap(mapRoot, {
      dataUrl: panel.dataset.mapData!,
      onSelect: selectEvent,
    });
    syncMap(false);
  } catch {
    panel.classList.add('is-failed');
    mapRoot.textContent = t('map.failedReload');
  } finally {
    mapLoading = false;
  }
}

mapToggle?.addEventListener('click', () => {
  const open = panel?.classList.toggle('is-open') ?? false;
  mapToggle.setAttribute('aria-expanded', String(open));
  if (open) void ensureMap();
});

panel?.querySelector('[data-map-close]')?.addEventListener('click', () => {
  panel.classList.remove('is-open');
  mapToggle?.setAttribute('aria-expanded', 'false');
  mapToggle?.focus();
});

matchMedia('(min-width: 80rem)').addEventListener('change', () => void ensureMap());
if ('requestIdleCallback' in window) requestIdleCallback(() => void ensureMap());
else setTimeout(() => void ensureMap(), 300);

// --- current era ----------------------------------------------------------------

function setCurrentEra(era: string) {
  if (era === currentEra) return;
  currentEra = era;
  for (const [id, link] of railLinks) {
    if (id === era) {
      link.setAttribute('aria-current', 'true');
      // On narrow screens the rail scrolls sideways: keep the current era in sight.
      const list = link.closest('ol');
      if (list && list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: link.offsetLeft - list.clientWidth / 2 + link.offsetWidth / 2, behavior: 'smooth' });
      }
    } else {
      link.removeAttribute('aria-current');
    }
  }
  const caption = panel?.querySelector('[data-map-caption]');
  const section = sections.find((s) => s.dataset.era === era);
  if (caption && section) {
    caption.textContent = `${section.querySelector('h2')?.textContent?.trim()} · ${section.querySelector('.era__span')?.textContent?.trim()}`;
  }
  frameMapSoon();
}

// A thin band a quarter of the way down the window decides which era is current.
const eraObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) setCurrentEra((entry.target as HTMLElement).dataset.era!);
    }
  },
  { rootMargin: '-25% 0px -74% 0px' },
);
for (const section of sections) eraObserver.observe(section);

/**
 * Work out the current era directly: the section crossing the band, or failing
 * that the first one still on screen or below. Needed at the top of the page,
 * where no era has reached the band yet, and after a filter hides sections.
 */
function locateCurrentEra() {
  const band = window.innerHeight * 0.25;
  const shown = sections.filter((section) => !section.hidden);
  const crossing = shown.find((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= band && rect.bottom >= band;
  });
  const era = (crossing ?? shown.find((section) => section.getBoundingClientRect().bottom > band) ?? shown[0])?.dataset.era;
  if (era) setCurrentEra(era);
}
locateCurrentEra();

// --- cards in view ----------------------------------------------------------------

let visibleTimer = 0;
const cardObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.id!;
      if (entry.isIntersecting) inView.add(id);
      else inView.delete(id);
    }
    window.clearTimeout(visibleTimer);
    visibleTimer = window.setTimeout(() => map?.setVisible([...inView]), 120);
    frameMapSoon();
  },
  { rootMargin: '-10% 0px -10% 0px' },
);
for (const card of cards) cardObserver.observe(card);

for (const card of cards) {
  const id = card.dataset.id!;
  card.addEventListener('pointerenter', () => map?.highlight(id));
  card.addEventListener('pointerleave', () => map?.highlight(null));
  card.addEventListener('focusin', () => map?.highlight(id));
  card.addEventListener('focusout', () => map?.highlight(null));
}

// --- filters ----------------------------------------------------------------------

if (form) {
  form.hidden = false;
  const status = form.querySelector<HTMLElement>('[data-filter-status]')!;
  const clear = form.querySelector<HTMLButtonElement>('[data-filter-clear]')!;
  const search = form.elements.namedItem('q') as HTMLInputElement;
  const boxes = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const groups = [...form.querySelectorAll<HTMLDetailsElement>('[data-filter-group]')];

  const selected = (key: FilterKey) => new Set(boxes.filter((box) => box.name === key && box.checked).map((box) => box.value));
  const words = (card: HTMLElement, attribute: string) => (card.dataset[attribute] ?? '').split(' ').filter(Boolean);
  const overlaps = (wanted: Set<string>, values: string[]) => wanted.size === 0 || values.some((v) => wanted.has(v));

  function read() {
    return {
      era: selected('era'),
      thread: selected('thread'),
      region: selected('region'),
      confidence: selected('confidence'),
      // The cards' search text uses plain apostrophes; a phone keyboard types curly ones.
      terms: search.value.toLocaleLowerCase(locale).replace(/[\u2018\u2019\u201A]/g, "'").replace(/[\u201C\u201D\u201E]/g, '"').split(/\s+/).filter(Boolean),
    };
  }

  function apply(updateUrl = true) {
    const filters = read();
    const active =
      filters.terms.length > 0 || FILTER_KEYS.some((key) => filters[key].size > 0);

    const matched = new Set<string>();
    for (const card of cards) {
      const ok =
        overlaps(filters.era, [card.dataset.era!]) &&
        overlaps(filters.thread, words(card, 'threads')) &&
        overlaps(filters.region, words(card, 'regions')) &&
        overlaps(filters.confidence, [card.dataset.confidence!]) &&
        filters.terms.every((term) => card.dataset.search!.includes(term));
      card.parentElement!.hidden = !ok;
      if (ok) matched.add(card.dataset.id!);
    }

    for (const section of sections) {
      const count = section.querySelectorAll('.events > li:not([hidden])').length;
      section.hidden = count === 0;
      const link = railLinks.get(section.dataset.era!);
      link?.parentElement?.classList.toggle('is-empty', count === 0);
      const badge = link?.querySelector('[data-era-count]');
      if (badge) badge.textContent = String(count);
    }

    for (const group of groups) {
      const count = selected(group.dataset.filterGroup as FilterKey).size;
      const badge = group.querySelector<HTMLElement>('[data-filter-count]')!;
      badge.hidden = count === 0;
      badge.textContent = String(count);
      group.classList.toggle('is-set', count > 0);
    }

    matching = active ? matched : null;
    locateCurrentEra();
    status.textContent = active
      ? t('filter.countOf', { matched: matched.size, count: cards.length })
      : t('filter.count', { count: cards.length });
    clear.hidden = !active;

    if (updateUrl) {
      const params = new URLSearchParams();
      for (const key of FILTER_KEYS) if (filters[key].size > 0) params.set(key, [...filters[key]].join(','));
      if (search.value.trim()) params.set('q', search.value.trim());
      const query = params.toString();
      history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    }
    syncMap();
  }

  // Restore filters from the URL, so that a filtered view can be shared.
  const params = new URLSearchParams(location.search);
  for (const key of FILTER_KEYS) {
    const wanted = new Set((params.get(key) ?? '').split(',').filter(Boolean));
    for (const box of boxes) if (box.name === key) box.checked = wanted.has(box.value);
  }
  search.value = params.get('q') ?? '';
  if ([...params.keys()].length > 0) apply(false);

  form.addEventListener('change', () => apply());
  let typing = 0;
  search.addEventListener('input', () => {
    window.clearTimeout(typing);
    typing = window.setTimeout(() => apply(), 150);
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('reset', () => window.setTimeout(() => apply()));

  // Only one filter menu is open at a time; clicking elsewhere or Escape closes it.
  for (const group of groups) {
    group.addEventListener('toggle', () => {
      if (group.open) for (const other of groups) if (other !== group) other.open = false;
    });
  }
  document.addEventListener('click', (event) => {
    for (const group of groups) if (group.open && !group.contains(event.target as Node)) group.open = false;
  });
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = groups.find((group) => group.open);
    if (open) {
      open.open = false;
      open.querySelector('summary')?.focus();
    }
  });
}
