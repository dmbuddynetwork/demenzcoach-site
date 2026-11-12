// Public fixed list only: no account, experiment assignment, analytics or private text.
document.querySelectorAll('[data-print-list]').forEach(button => {
  button.addEventListener('click', () => window.print());
});

// Reuse the site's functional text-size preference; no account or measurement state.
const root = document.documentElement;
const fontToggle = document.querySelector('[data-font-toggle]');
const menu = document.querySelector('.site-menu');
const menuToggle = menu?.querySelector('summary');
const setLargeText = large => {
  root.classList.toggle('e-large', large);
  fontToggle?.setAttribute('aria-pressed', String(large));
};
try { setLargeText(localStorage.getItem('demenzcoach.textSize.v1') === 'large'); } catch { /* Storage may be blocked. */ }
fontToggle?.addEventListener('click', () => {
  const large = !root.classList.contains('e-large');
  setLargeText(large);
  try {
    if (large) localStorage.setItem('demenzcoach.textSize.v1', 'large');
    else localStorage.removeItem('demenzcoach.textSize.v1');
  } catch { /* The current page still reflects the choice. */ }
});
menu?.addEventListener('click', event => {
  if (event.target.closest('a')) menu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !menu?.open) return;
  menu.open = false;
  menuToggle?.focus();
});
document.addEventListener('click', event => {
  if (menu?.open && !menu.contains(event.target)) menu.open = false;
});
