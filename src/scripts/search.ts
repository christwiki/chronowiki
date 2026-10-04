/**
 * Site search. The index is built by Pagefind after the site build and loaded
 * only when the reader first opens the dialog.
 */
import { isRelevant } from '../lib/relevance';
import { t } from './i18n';

interface PagefindResult {
  url: string;
  excerpt: string;
  meta: { title?: string; kind?: string; date?: string };
}

interface Pagefind {
  init(): Promise<void>;
  options(options: Record<string, unknown>): Promise<void>;
  debouncedSearch(query: string, options?: object, delay?: number): Promise<{ results: { data(): Promise<PagefindResult> }[] } | null>;
}

const MAX_RESULTS = 12;

// Event cards carry a data-search attribute of their own (the text the timeline filter matches), so name the dialog.
const dialog = document.querySelector<HTMLDialogElement>('dialog[data-search]');

if (dialog) {
  const input = dialog.querySelector<HTMLInputElement>('[data-search-input]')!;
  const status = dialog.querySelector<HTMLElement>('[data-search-status]')!;
  const list = dialog.querySelector<HTMLOListElement>('[data-search-results]')!;
  let pagefind: Pagefind | null | undefined;

  async function load(): Promise<Pagefind | null> {
    if (pagefind !== undefined) return pagefind;
    try {
      const module = (await import(/* @vite-ignore */ dialog!.dataset.pagefindUrl!)) as Pagefind;
      await module.options({ excerptLength: 22 });
      await module.init();
      pagefind = module;
    } catch {
      pagefind = null;
    }
    return pagefind;
  }

  function open() {
    if (dialog!.open) return;
    dialog!.showModal();
    input.select();
    void load().then((engine) => {
      if (!engine) status.textContent = t('search.unavailable');
    });
  }

  function render(results: PagefindResult[], total: number, query: string) {
    list.replaceChildren(
      ...results.map((result) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = result.url;
        const kind = document.createElement('span');
        kind.className = 'search__kind';
        kind.textContent = [result.meta.kind, result.meta.date].filter(Boolean).join(' · ');
        const title = document.createElement('span');
        title.className = 'search__title';
        title.textContent = result.meta.title ?? result.url;
        const excerpt = document.createElement('span');
        excerpt.className = 'search__excerpt';
        // Pagefind returns escaped text with <mark> around the matched words.
        excerpt.innerHTML = result.excerpt;
        link.append(kind, title, excerpt);
        item.append(link);
        return item;
      }),
    );
    if (total === 0) status.textContent = t('search.nothing', { query });
    else if (total > results.length) status.textContent = t('search.showing', { shown: results.length, count: total });
    else status.textContent = t('search.results', { count: total });
  }

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    if (!query) {
      list.replaceChildren();
      status.textContent = t('search.hint');
      return;
    }
    const engine = await load();
    if (!engine) return;
    const search = await engine.debouncedSearch(query, {}, 200);
    // A null result means a newer keystroke has replaced this search.
    if (!search || input.value.trim() !== query) return;
    const loaded = await Promise.all(search.results.slice(0, MAX_RESULTS).map((r) => r.data()));
    const results = loaded.filter((result) => isRelevant(result.excerpt, query));
    const total = results.length < loaded.length ? results.length : search.results.length;
    if (input.value.trim() === query) render(results, total, query);
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    if (links.length === 0) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    if (next < 0) input.focus();
    else links[Math.min(next, links.length - 1)].focus();
  });

  // Enter in the field opens the first result instead of closing the dialog.
  dialog.querySelector('form')!.addEventListener('submit', (event) => {
    if (document.activeElement === input && input.value.trim()) {
      const first = list.querySelector<HTMLAnchorElement>('a');
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });

  // Clicking the backdrop closes the dialog.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  for (const button of document.querySelectorAll('[data-search-open]')) button.addEventListener('click', open);

  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const typing = target.matches('input, textarea, select') || target.isContentEditable;
    if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey)) {
      event.preventDefault();
      open();
    }
  });
}
