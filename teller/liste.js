// Public fixed list only: no account, experiment assignment, analytics or private text.
document.querySelectorAll('[data-print-list]').forEach(button => {
  button.addEventListener('click', () => window.print());
});
