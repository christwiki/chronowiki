/**
 * Behaviour of the quotations page: the names of the books and of the kinds of
 * line become buttons. Choosing one shows only its quotations, in the drawing
 * and in the list below it. Without this script the page is a complete drawing
 * and a complete list.
 */
import { t } from './i18n';

type Key = 'earlier' | 'later' | 'kind';

const diagram = document.querySelector<HTMLElement>('[data-quotation-diagram]');

if (diagram) {
  const lines = [...diagram.querySelectorAll<SVGAElement>('a[data-quotation]')];
  const rows = [...diagram.querySelectorAll<HTMLElement>('[data-diagram-row]')];
  const items = [...document.querySelectorAll<HTMLElement>('.quotation-list__item[data-quotation]')];
  const groups = [...document.querySelectorAll<HTMLElement>('[data-quotation-group]')];
  const status = diagram.querySelector<HTMLElement>('[data-diagram-status]');
  const hint = diagram.querySelector<HTMLElement>('[data-diagram-hint]');
  const count = diagram.querySelector<HTMLElement>('[data-diagram-count]');
  const clear = diagram.querySelector<HTMLButtonElement>('[data-diagram-clear]');
  const chosen: Partial<Record<Key, string>> = {};
  const buttons: { key: Key; value: string; button: HTMLButtonElement }[] = [];

  const matches = (element: Element, state: Partial<Record<Key, string>> = chosen) =>
    (['earlier', 'later', 'kind'] as const).every(
      (key) => state[key] === undefined || (element as HTMLElement | SVGElement).dataset[key] === state[key],
    );

  function apply() {
    const active = Object.values(chosen).some((value) => value !== undefined);
    for (const line of lines) line.classList.toggle('is-dim', !matches(line));
    for (const item of items) item.hidden = !matches(item);
    for (const group of groups) group.hidden = !group.querySelector('.quotation-list__item:not([hidden])');
    // A book none of whose lines is left steps back with them.
    const left = lines.filter((line) => matches(line));
    for (const row of rows) {
      const side = row.closest('.quotation-diagram__books--earlier') ? 'earlier' : 'later';
      row.classList.toggle('is-dim', !left.some((line) => line.dataset[side] === row.dataset.diagramRow));
    }
    for (const { key, value, button } of buttons) button.setAttribute('aria-pressed', String(chosen[key] === value));
    if (hint) hint.hidden = active;
    if (clear) clear.hidden = !active;
    if (count) {
      count.hidden = !active;
      count.textContent = t('quotations.countOf', { matched: left.length, count: lines.length });
    }
  }

  function toggle(key: Key, value: string) {
    chosen[key] = chosen[key] === value ? undefined : value;
    apply();
  }

  /** A name becomes a button with the same words and the same look. */
  function upgrade(label: HTMLElement, key: Key, value: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    for (const { name, value: attribute } of [...label.attributes]) button.setAttribute(name, attribute);
    button.append(...label.childNodes);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => toggle(key, value));
    // Pointing at a name, or reaching it with the keyboard, picks out its lines.
    const hot = (on: boolean) => {
      for (const line of lines) line.classList.toggle('is-hot', on && line.dataset[key] === value && matches(line));
    };
    button.addEventListener('pointerenter', () => hot(true));
    button.addEventListener('pointerleave', () => hot(false));
    button.addEventListener('focus', () => hot(true));
    button.addEventListener('blur', () => hot(false));
    label.replaceWith(button);
    buttons.push({ key, value, button });
    return button;
  }

  for (const label of diagram.querySelectorAll<HTMLElement>('span[data-diagram-group]')) {
    upgrade(label, label.dataset.diagramSide as Key, label.dataset.diagramGroup!);
  }
  const kinds = [...diagram.querySelectorAll<HTMLElement>('span[data-diagram-kind]')];
  // One kind of line leaves nothing to choose between.
  if (kinds.length > 1) for (const label of kinds) upgrade(label, 'kind', label.dataset.diagramKind!);

  clear?.addEventListener('click', () => {
    for (const key of ['earlier', 'later', 'kind'] as const) chosen[key] = undefined;
    apply();
  });
  if (status) status.hidden = false;
}
