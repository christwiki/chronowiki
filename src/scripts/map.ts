/**
 * The map. Drawn by the site itself from Natural Earth shapes: no tiles, no
 * outside service, no modern borders. One instance serves the timeline's side
 * panel, the full map page and the small maps on entry pages.
 */
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
// The shapes travel with the theme. `?url` has the build copy each file to the site and hand back its address.
import detailUrl from '../geo/near-east-10m.json?url';
import worldUrl from '../geo/world-50m.json?url';
import type { MapData, MapEvent, MapPlace } from '../routes/map-data';
import { locale, t } from './i18n';

export interface MapOptions {
  /** URL of /data/map.json */
  dataUrl: string;
  /** Pan, zoom, focusable pins and place cards. Off for the small maps on entry pages. */
  interactive?: boolean;
  /** Show only these places, and fit the view to them. */
  only?: string[];
  /**
   * 'always' zooms on any scroll over the map. 'modifier' zooms only on a pinch
   * or on scroll with Ctrl or Cmd held, so that scrolling the page past a map
   * beside the text does not get caught by it. Default 'modifier'.
   */
  wheelZoom?: 'always' | 'modifier';
  /** Called when the reader picks an event in a place card. Return true to cancel the link. */
  onSelect?: (eventId: string) => boolean | void;
}

export interface MapController {
  /** Events whose places are emphasised and labelled. */
  setVisible(eventIds: string[]): void;
  /** Restrict the map to these events; null shows all. */
  setFilter(eventIds: Set<string> | null): void;
  /** Fit the view to the places of these events. */
  fitEvents(eventIds: string[], animate?: boolean): boolean;
  /** Pulse the places of one event. */
  highlight(eventId: string | null): void;
  destroy(): void;
}

interface Pin {
  place: MapPlace;
  /** Position in the base projection, before zoom. */
  x: number;
  y: number;
  events: MapEvent[];
  active: MapEvent[];
  group: SVGGElement;
  radius: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const WORLD: GeoPermissibleObjects = {
  type: 'Polygon',
  coordinates: [
    [
      [-170, -55],
      [-170, 72],
      [180, 72],
      [180, -55],
      [-170, -55],
    ],
  ],
};
/** [west, south, east, north] of the detailed layer; must match scripts/build-map-data.ts. */
const DETAIL = [-12, 10, 62, 60] as const;
const DETAIL_ZOOM = 5;
const MAX_ZOOM = 260;
/** A view never spans less than this many degrees of longitude. */
const MIN_SPAN_DEGREES = 9;
const MAX_CARD_EVENTS = 7;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A message made safe to set inside a double-quoted HTML attribute. */
const attr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

export async function createMap(root: HTMLElement, options: MapOptions): Promise<MapController> {
  const interactive = options.interactive ?? true;
  root.classList.add('map');
  root.classList.toggle('map--static', !interactive);

  const [data, world] = await Promise.all([
    json<MapData>(options.dataUrl),
    json<Topology>(worldUrl),
  ]);

  // --- scaffold -----------------------------------------------------------------
  const svg = el('svg', { class: 'map__svg' });
  if (interactive) {
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', t('map.help'));
    svg.classList.toggle('map__svg--free-wheel', options.wheelZoom === 'always');
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const defs = el('defs');
  const clipId = `map-clip-${Math.random().toString(36).slice(2, 8)}`;
  const clip = el('clipPath', { id: clipId });
  const clipShape = el('path', { 'clip-rule': 'evenodd' });
  clip.append(clipShape);
  defs.append(clip);

  const base = el('g', { class: 'map__base' });
  const land = el('path', { class: 'map__land' });
  const detail = el('path', { class: 'map__land map__land--detail' });
  const rivers = el('path', { class: 'map__rivers' });
  const lakes = el('path', { class: 'map__lakes' });
  base.append(land, detail, rivers, lakes);
  const pinLayer = el('g', { class: 'map__pins' });
  const labelLayer = el('g', { class: 'map__labels', 'aria-hidden': 'true' });
  svg.append(defs, base, pinLayer, labelLayer);
  root.replaceChildren(svg);

  const card = document.createElement('div');
  card.className = 'map__card';
  card.hidden = true;
  let controls: HTMLDivElement | undefined;
  if (interactive) {
    controls = document.createElement('div');
    controls.className = 'map__controls';
    controls.innerHTML = `
      <button type="button" data-zoom="in" aria-label="${attr(t('map.zoomIn'))}">+</button>
      <button type="button" data-zoom="out" aria-label="${attr(t('map.zoomOut'))}">−</button>
      <button type="button" data-zoom="fit" aria-label="${attr(t('map.fit'))}">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    root.append(controls, card);
  }

  // --- data -----------------------------------------------------------------------
  const only = options.only ? new Set(options.only) : undefined;
  const placeById = new Map(data.places.map((place) => [place.id, place]));
  const eventById = new Map(data.events.map((event) => [event.id, event]));
  const eventsAt = new Map<string, MapEvent[]>();
  for (const event of data.events) {
    for (const id of event.places) eventsAt.set(id, [...(eventsAt.get(id) ?? []), event]);
  }

  const projection = geoMercator();
  const path = geoPath(projection);
  const landShape = feature(world, world.objects.land);
  const lakeShape = feature(world, world.objects.lakes);
  const riverShape = feature(world, world.objects.rivers);
  let detailShape: GeoPermissibleObjects | undefined;
  let detailRequested = false;

  let width = 0;
  let height = 0;
  let transform: ZoomTransform = zoomIdentity;
  let filter: Set<string> | null = null;
  let visible = new Set<string>();
  let fitted: string[] = [];
  let highlighted: string | null = null;
  let openPin: Pin | undefined;
  const pins: Pin[] = [];

  for (const place of data.places) {
    if (only ? !only.has(place.id) : !eventsAt.has(place.id)) continue;
    const group = el('g', { class: 'map__pin' });
    group.dataset.place = place.id;
    if (place.location !== 'known') group.classList.add('is-uncertain');
    group.append(el('circle', { class: 'map__pin-hit', r: 11 }), el('circle', { class: 'map__pin-dot', r: 2.5 }));
    pinLayer.append(group);
    pins.push({ place, x: 0, y: 0, events: eventsAt.get(place.id) ?? [], active: [], group, radius: 2.5 });
  }

  // --- zoom -----------------------------------------------------------------------
  const svgSelection = select(svg) as Selection<SVGSVGElement, unknown, null, undefined>;
  let behaviour: ZoomBehavior<SVGSVGElement, unknown> | undefined;

  function applyTransform(next: ZoomTransform) {
    transform = next;
    base.setAttribute('transform', next.toString());
    const showDetail = next.k >= DETAIL_ZOOM;
    if (showDetail && !detailRequested) void loadDetail();
    const useDetail = showDetail && detailShape !== undefined;
    detail.style.display = useDetail ? '' : 'none';
    if (useDetail) land.setAttribute('clip-path', `url(#${clipId})`);
    else land.removeAttribute('clip-path');
    positionPins();
    scheduleLabels();
    if (openPin) placeCard(openPin);
  }

  if (interactive) {
    const freeWheel = options.wheelZoom === 'always';
    behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      // A trackpad pinch arrives as a wheel event with ctrlKey set.
      .filter((event: Event) => {
        if (event.type === 'wheel') return freeWheel || (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
        return !(event as MouseEvent).button;
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => applyTransform(event.transform))
      // Labels are laid out a frame late while moving; settle them when the move ends.
      .on('end', () => drawLabels());
    svgSelection.call(behaviour).on('dblclick.zoom', null);
  }

  function moveTo(next: ZoomTransform, animate: boolean) {
    if (!behaviour) {
      applyTransform(next);
      return;
    }
    if (animate && !reducedMotion()) svgSelection.transition().duration(650).call(behaviour.transform, next);
    else svgSelection.call(behaviour.transform, next);
  }

  // --- layout -----------------------------------------------------------------------
  function layout() {
    const rect = root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    width = rect.width;
    height = rect.height;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    projection.fitExtent(
      [
        [0, 0],
        [width, height],
      ],
      WORLD,
    );
    land.setAttribute('d', path(landShape) ?? '');
    lakes.setAttribute('d', path(lakeShape) ?? '');
    rivers.setAttribute('d', path(riverShape) ?? '');
    if (detailShape) drawDetail();
    for (const pin of pins) {
      const point = projection([pin.place.lon, pin.place.lat]);
      [pin.x, pin.y] = point ?? [NaN, NaN];
    }
    behaviour?.extent([
      [0, 0],
      [width, height],
    ]);
    behaviour?.translateExtent([
      [-width * 0.2, -height * 0.2],
      [width * 1.2, height * 1.2],
    ]);
    return true;
  }

  function drawDetail() {
    if (!detailShape) return;
    detail.setAttribute('d', path(detailShape) ?? '');
    // The coarse land is hidden inside the detailed area, so the two never overlap.
    const [west, south, east, north] = DETAIL;
    const [x0, y0] = projection([west, north]) ?? [0, 0];
    const [x1, y1] = projection([east, south]) ?? [0, 0];
    const big = 1e5;
    clipShape.setAttribute('d', `M${-big},${-big}H${big}V${big}H${-big}Z M${x0},${y0}H${x1}V${y1}H${x0}Z`);
  }

  async function loadDetail() {
    detailRequested = true;
    try {
      const topo = await json<Topology>(detailUrl);
      detailShape = feature(topo, topo.objects.land);
      drawDetail();
      applyTransform(transform);
    } catch {
      // The coarse layer stays in place.
    }
  }

  // --- pins -----------------------------------------------------------------------
  function shown(event: MapEvent) {
    return filter === null || filter.has(event.id);
  }

  function refreshPins() {
    for (const pin of pins) {
      const events = pin.events.filter(shown);
      pin.active = events.filter((event) => visible.has(event.id));
      const isActive = only ? true : pin.active.length > 0;
      const present = only ? true : events.length > 0;
      pin.radius = isActive ? 4.5 + Math.min(3, Math.sqrt(pin.active.length) - 1) * 1.6 : 2.5;
      pin.group.style.display = present ? '' : 'none';
      pin.group.classList.toggle('is-active', isActive);
      const colour = (pin.active[0] ?? events[0])?.colour;
      if (colour) pin.group.style.setProperty('--pin-colour', `var(${colour})`);
      pin.group.querySelector('.map__pin-dot')!.setAttribute('r', String(pin.radius));
      if (interactive) {
        // Only emphasised pins are tab stops; the timeline itself is the full keyboard route.
        if (isActive) {
          pin.group.setAttribute('tabindex', '0');
          pin.group.setAttribute('role', 'button');
          pin.group.setAttribute('aria-label', t('map.pin', { place: pin.place.name, count: events.length }));
        } else {
          pin.group.removeAttribute('tabindex');
          pin.group.removeAttribute('role');
          pin.group.setAttribute('aria-hidden', 'true');
        }
        if (isActive) pin.group.removeAttribute('aria-hidden');
      }
      // Emphasised pins are drawn last, above the others.
      if (isActive) pinLayer.append(pin.group);
    }
    applyHighlight();
    scheduleLabels();
  }

  function positionPins() {
    for (const pin of pins) {
      pin.group.setAttribute('transform', `translate(${transform.applyX(pin.x)},${transform.applyY(pin.y)})`);
    }
  }

  function applyHighlight() {
    const places = new Set(highlighted ? (eventById.get(highlighted)?.places ?? []) : []);
    for (const pin of pins) pin.group.classList.toggle('is-highlighted', places.has(pin.place.id));
  }

  // --- labels -----------------------------------------------------------------------
  let labelFrame = 0;
  function scheduleLabels() {
    cancelAnimationFrame(labelFrame);
    labelFrame = requestAnimationFrame(drawLabels);
  }

  function drawLabels() {
    const placed: [number, number, number, number][] = [];
    const nodes: SVGTextElement[] = [];
    const candidates = pins
      .filter((pin) => pin.group.classList.contains('is-active') && pin.group.style.display !== 'none')
      .sort((a, b) => b.active.length - a.active.length || a.place.name.localeCompare(b.place.name, locale));

    // Pins themselves are obstacles for labels.
    for (const pin of candidates) {
      const x = transform.applyX(pin.x);
      const y = transform.applyY(pin.y);
      placed.push([x - pin.radius, y - pin.radius, x + pin.radius, y + pin.radius]);
    }

    for (const pin of candidates) {
      const x = transform.applyX(pin.x);
      const y = transform.applyY(pin.y);
      if (x < 0 || y < 0 || x > width || y > height) continue;
      const textWidth = pin.place.name.length * 6.6 + 4;
      const gap = pin.radius + 5;
      const options: [number, number, 'start' | 'end' | 'middle'][] = [
        [x + gap, y + 4, 'start'],
        [x - gap, y + 4, 'end'],
        [x, y - gap - 2, 'middle'],
        [x, y + gap + 11, 'middle'],
      ];
      for (const [lx, ly, anchor] of options) {
        const left = anchor === 'start' ? lx : anchor === 'end' ? lx - textWidth : lx - textWidth / 2;
        const box: [number, number, number, number] = [left, ly - 11, left + textWidth, ly + 3];
        if (box[0] < 2 || box[2] > width - 2 || box[1] < 2 || box[3] > height - 2) continue;
        if (placed.some((p) => p[0] < box[2] && p[2] > box[0] && p[1] < box[3] && p[3] > box[1])) continue;
        placed.push(box);
        const text = el('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'map__label' });
        text.textContent = pin.place.name;
        nodes.push(text);
        break;
      }
    }
    labelLayer.replaceChildren(...nodes);
  }

  // --- fitting -----------------------------------------------------------------------
  function fitPlaces(placeIds: Iterable<string>, animate: boolean) {
    if (width === 0) return;
    const points = [...placeIds].flatMap((id) => {
      const place = placeById.get(id);
      const point = place && projection([place.lon, place.lat]);
      return point ? [point] : [];
    });
    if (points.length === 0) {
      moveTo(zoomIdentity, animate);
      return;
    }
    let [x0, y0] = points[0];
    let [x1, y1] = points[0];
    for (const [x, y] of points) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    // Keep some surroundings in view even for a single place.
    const origin = projection([0, 0]) ?? [0, 0];
    const minSpan = Math.abs((projection([MIN_SPAN_DEGREES, 0]) ?? [0, 0])[0] - origin[0]);
    const spanX = Math.max(x1 - x0, minSpan);
    const spanY = Math.max(y1 - y0, minSpan * 0.7);
    const padding = 0.62;
    const k = Math.max(1, Math.min(MAX_ZOOM, padding / Math.max(spanX / width, spanY / height)));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    moveTo(zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k), animate);
  }

  function fitEvents(eventIds: string[], animate = true) {
    const places = new Set(eventIds.flatMap((id) => eventById.get(id)?.places ?? []));
    if (places.size === 0) return false;
    fitted = eventIds;
    fitPlaces(places, animate);
    return true;
  }

  // --- place card -----------------------------------------------------------------------
  function placeCard(pin: Pin) {
    const x = transform.applyX(pin.x);
    const y = transform.applyY(pin.y);
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const left = Math.min(Math.max(8, x - cardWidth / 2), width - cardWidth - 8);
    const above = y - pin.radius - 10 - cardHeight;
    const top = above >= 8 ? above : Math.min(y + pin.radius + 10, height - cardHeight - 8);
    card.style.left = `${left}px`;
    card.style.top = `${Math.max(8, top)}px`;
  }

  function openCard(pin: Pin) {
    const events = pin.events.filter(shown);
    const ordered = [...pin.active, ...events.filter((event) => !pin.active.includes(event))];
    const list = ordered.slice(0, MAX_CARD_EVENTS);
    const heading = document.createElement('p');
    heading.className = 'map__card-title';
    if (pin.place.href) {
      const link = document.createElement('a');
      link.href = pin.place.href;
      link.textContent = pin.place.name;
      heading.append(link);
    } else {
      heading.textContent = pin.place.name;
    }
    const modern = document.createElement('p');
    modern.className = 'map__card-meta';
    modern.textContent =
      pin.place.location === 'known'
        ? pin.place.modern
        : `${pin.place.modern} · ${t('places.locationTag', { kind: t(`places.location.${pin.place.location}`) })}`;
    const items = document.createElement('ul');
    items.setAttribute('role', 'list');
    for (const event of list) {
      const item = document.createElement('li');
      item.style.setProperty('--era-colour', `var(${event.colour})`);
      const link = document.createElement('a');
      link.href = event.href;
      link.dataset.event = event.id;
      const date = document.createElement('span');
      date.className = 'map__card-date';
      date.textContent = event.date;
      link.append(date, document.createTextNode(event.title));
      item.append(link);
      items.append(item);
    }
    card.replaceChildren(heading, modern, items);
    if (ordered.length > list.length) {
      const more = document.createElement('p');
      more.className = 'map__card-meta';
      more.textContent = t('map.more', { count: ordered.length - list.length });
      card.append(more);
    }
    card.hidden = false;
    openPin = pin;
    pin.group.setAttribute('aria-expanded', 'true');
    placeCard(pin);
  }

  function closeCard() {
    card.hidden = true;
    openPin?.group.removeAttribute('aria-expanded');
    openPin = undefined;
  }

  // --- events -----------------------------------------------------------------------
  const abort = new AbortController();
  const { signal } = abort;

  if (interactive) {
    const pinOf = (target: EventTarget | null) => {
      const group = target instanceof Element ? target.closest<SVGGElement>('.map__pin') : null;
      return group ? pins.find((pin) => pin.group === group) : undefined;
    };

    pinLayer.addEventListener(
      'click',
      (event) => {
        const pin = pinOf(event.target);
        if (!pin) return;
        if (openPin === pin) closeCard();
        else openCard(pin);
      },
      { signal },
    );

    pinLayer.addEventListener(
      'keydown',
      (event) => {
        const pin = pinOf(event.target);
        if (pin && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openCard(pin);
          card.querySelector('a')?.focus();
        }
      },
      { signal },
    );

    card.addEventListener(
      'click',
      (event) => {
        const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-event]') : null;
        if (link?.dataset.event && options.onSelect?.(link.dataset.event) === true) {
          event.preventDefault();
          closeCard();
        }
      },
      { signal },
    );

    root.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && openPin) {
          const pin = openPin;
          closeCard();
          pin.group.focus();
          return;
        }
        if (event.target !== svg || !behaviour) return;
        const step = 60;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [step, 0],
          ArrowRight: [-step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        };
        if (event.key in moves) {
          event.preventDefault();
          const [dx, dy] = moves[event.key];
          svgSelection.call(behaviour.translateBy, dx / transform.k, dy / transform.k);
        } else if (event.key === '+' || event.key === '=') {
          svgSelection.call(behaviour.scaleBy, 1.6);
        } else if (event.key === '-') {
          svgSelection.call(behaviour.scaleBy, 1 / 1.6);
        }
      },
      { signal },
    );

    svg.addEventListener(
      'click',
      (event) => {
        if (!pinOf(event.target)) closeCard();
      },
      { signal },
    );

    controls?.addEventListener(
      'click',
      (event) => {
        const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-zoom]') : null;
        if (!button || !behaviour) return;
        const action = button.dataset.zoom;
        if (action === 'fit') fitEvents(fitted.length > 0 ? fitted : data.events.filter(shown).map((e) => e.id), true);
        else svgSelection.transition().duration(reducedMotion() ? 0 : 250).call(behaviour.scaleBy, action === 'in' ? 1.8 : 1 / 1.8);
      },
      { signal },
    );
  }

  const resize = new ResizeObserver(() => {
    const before = width;
    if (!layout()) return;
    if (before === 0 || Math.abs(before - width) > 1) {
      if (only) fitPlaces(only, false);
      else if (fitted.length > 0) fitEvents(fitted, false);
      else applyTransform(zoomIdentity);
    }
  });
  resize.observe(root);

  if (layout()) {
    if (only) fitPlaces(only, false);
    else applyTransform(zoomIdentity);
  }
  refreshPins();
  root.dataset.mapReady = 'true';

  return {
    setVisible(eventIds) {
      visible = new Set(eventIds);
      refreshPins();
    },
    setFilter(eventIds) {
      filter = eventIds;
      closeCard();
      refreshPins();
    },
    fitEvents,
    highlight(eventId) {
      highlighted = eventId;
      applyHighlight();
    },
    destroy() {
      abort.abort();
      resize.disconnect();
      cancelAnimationFrame(labelFrame);
      root.replaceChildren();
    },
  };
}
