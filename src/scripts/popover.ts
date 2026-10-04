/**
 * Source cards. Hovering, focusing or (on touch screens) tapping a citation of
 * a non-biblical source shows a card describing the source, with a link to the
 * cited passage. A mouse click still follows the link straight to the passage.
 */
const card = document.querySelector<HTMLElement>('#source-card');

if (card) {
  const OPEN_DELAY = 180;
  const CLOSE_DELAY = 220;
  let anchor: HTMLAnchorElement | undefined;
  let timer: number | undefined;

  const template = (id: string) =>
    document.querySelector<HTMLTemplateElement>(`template[data-source-card="${CSS.escape(id)}"]`);

  function place(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = card!;
    const margin = 8;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    const below = rect.bottom + margin;
    const top = below + height > window.innerHeight - margin && rect.top - height - margin > 0 ? rect.top - height - margin : below;
    card!.style.left = `${left}px`;
    card!.style.top = `${top}px`;
  }

  function open(target: HTMLAnchorElement) {
    const source = template(target.dataset.source ?? '');
    if (!source) return;
    if (anchor === target && card!.matches(':popover-open')) return;
    close();
    card!.replaceChildren(source.content.cloneNode(true));
    card!.querySelector<HTMLAnchorElement>('[data-passage-link]')?.setAttribute('href', target.href);
    card!.showPopover();
    place(target);
    target.setAttribute('aria-expanded', 'true');
    target.setAttribute('aria-describedby', card!.id);
    anchor = target;
  }

  function close() {
    window.clearTimeout(timer);
    if (card!.matches(':popover-open')) card!.hidePopover();
    anchor?.removeAttribute('aria-expanded');
    anchor?.removeAttribute('aria-describedby');
    anchor = undefined;
  }

  const later = (fn: () => void, delay: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fn, delay);
  };

  const citation = (event: Event) =>
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a.cite--source[data-source]') : null;

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const target = citation(event);
    if (target) later(() => open(target), OPEN_DELAY);
    else if (event.target instanceof Node && card.contains(event.target)) window.clearTimeout(timer);
  });

  document.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'mouse') return;
    if (citation(event) || (event.target instanceof Node && card.contains(event.target))) later(close, CLOSE_DELAY);
  });

  document.addEventListener('focusin', (event) => {
    const target = citation(event);
    if (target) open(target);
    else if (!(event.target instanceof Node && card.contains(event.target))) close();
  });

  // On a touch screen the first tap opens the card; the link inside it leads on.
  document.addEventListener('click', (event) => {
    const target = citation(event);
    const touch = event instanceof PointerEvent && event.pointerType !== 'mouse' && event.pointerType !== '';
    if (target && touch && anchor !== target) {
      event.preventDefault();
      open(target);
    } else if (!target && !(event.target instanceof Node && card.contains(event.target))) {
      close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && anchor) {
      const previous = anchor;
      close();
      previous.focus();
    }
  });

  window.addEventListener('scroll', () => anchor && place(anchor), { passive: true });
  window.addEventListener('resize', close);
}
