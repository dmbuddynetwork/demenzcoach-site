// Native modal semantics keep focus and background interaction inside this sheet.
// Authentication, account linkage and introductory allowance remain with their owners.
let currentSheet;
export function openSignupSheet(view, { anchor, en = false, onDismiss = () => {}, doc = document, returnFocus = null } = {}) {
  if (!anchor?.isConnected) return null;
  currentSheet?.close('replaced');
  const previousFocus = doc.activeElement;
  const root = doc.documentElement, body = doc.body;
  const overflow = [root, body].map(node => [node, node.style.getPropertyValue('overflow'), node.style.getPropertyPriority('overflow')]);
  const hadClass = body.classList.contains('dc-signup-sheet-open');
  const dialog = doc.createElement('dialog'); dialog.className = 'dc-signup-sheet';
  dialog.setAttribute('aria-modal', 'true');
  const tools = doc.createElement('div'); tools.className = 'dc-signup-sheet-tools';
  const closeButton = doc.createElement('button'); closeButton.type = 'button'; closeButton.className = 'dc-signup-sheet-close';
  closeButton.setAttribute('aria-label', en ? 'Close sign-in' : 'Anmeldung schließen'); closeButton.textContent = '×';
  tools.append(closeButton); dialog.append(tools, view);
  const heading = () => view.querySelector('.signup-state:not([hidden]) h3') || view.querySelector('.offer-body h3');
  const nameDialog = () => { const title = heading(); if (title) { dialog.setAttribute('aria-labelledby', title.id); title.tabIndex = -1; } };
  let finished = false;
  const viewport = doc.defaultView.visualViewport;
  const position = () => {
    dialog.style.setProperty('--dc-sheet-height', `${viewport?.height || doc.defaultView.innerHeight}px`);
    dialog.style.setProperty('--dc-sheet-bottom', `${viewport ? Math.max(0, doc.defaultView.innerHeight - viewport.height - viewport.offsetTop) : 0}px`);
  };
  const close = (reason = 'dismiss') => {
    if (finished) return; finished = true;
    observer.disconnect(); viewport?.removeEventListener('resize', position); viewport?.removeEventListener('scroll', position);
    doc.defaultView.removeEventListener('resize', position);
    if (dialog.open) dialog.close(); dialog.remove(); anchor.remove();
    for (const [node, value, priority] of overflow) { if (value) node.style.setProperty('overflow', value, priority); else node.style.removeProperty('overflow'); }
    if (!hadClass) body.classList.remove('dc-signup-sheet-open');
    if (currentSheet?.dialog === dialog) currentSheet = undefined;
    onDismiss(reason);
    if (!['removed', 'replaced'].includes(reason)) {
      const focus = returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus
        : previousFocus?.isConnected && previousFocus !== body && previousFocus.getClientRects().length ? previousFocus
        : doc.querySelector('.translator-ai-answer') || doc.querySelector('#translator-input');
      if (focus) { if (!focus.matches('input,button,a,textarea,select,[tabindex]')) focus.tabIndex = -1; focus.focus({ preventScroll: true }); }
    }
  };
  const observer = new MutationObserver(() => { if (!anchor.isConnected || !dialog.isConnected) close('removed'); });
  closeButton.addEventListener('click', () => close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('a[href],button,input,textarea,select,[tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); heading()?.focus(); return; }
    if (event.shiftKey && (doc.activeElement === first || !controls.includes(doc.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (doc.activeElement === last || !controls.includes(doc.activeElement))) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close('escape'); });
  dialog.addEventListener('close', () => close());
  view.addEventListener('dc-signup-state', nameDialog);
  doc.body.append(dialog); nameDialog(); position();
  root.style.setProperty('overflow', 'hidden'); body.style.setProperty('overflow', 'hidden'); body.classList.add('dc-signup-sheet-open');
  try { dialog.showModal(); } catch (error) { close('removed'); throw error; }
  heading()?.focus({ preventScroll: true });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  viewport?.addEventListener('resize', position); viewport?.addEventListener('scroll', position); doc.defaultView.addEventListener('resize', position);
  currentSheet = { dialog, close }; return currentSheet;
}
