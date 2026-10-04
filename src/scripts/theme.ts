/** Theme switch: toggles between light and dark and remembers the choice. */
const root = document.documentElement;

function current(): 'light' | 'dark' {
  const chosen = root.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: 'light' | 'dark') {
  root.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  button.addEventListener('click', () => apply(current() === 'dark' ? 'light' : 'dark'));
}
