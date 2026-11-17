// "Share this answer as a link" for the goal flow. Loaded only when the page config enables snapshot links.
// Nothing is stored on the server before the person confirms. The confirmation is asked once per original
// situation (per chain). The link holds only a random read token in the fragment, never the situation.
(function (root) {
  const copy = {
    de: {
      button: 'Antwort als Link teilen',
      title: 'Diesen Link speichern?',
      notice: 'Wir speichern dafür diese Situation und die Antwort 30 Tage auf unserem Server. Jede Person mit dem Link kann sie lesen. Gib den Link nur weiter, wenn du damit einverstanden bist. Du kannst ihn hier jederzeit löschen. Schon verschickte Kopien kannst du nicht zurückholen.',
      create: 'Link erstellen', cancel: 'Abbrechen', working: 'Der Link wird erstellt …',
      label: 'Dein Link', copyButton: 'Link kopieren', copied: 'Link kopiert.', copyFailed: 'Markiere den Link und kopiere ihn von Hand.',
      remove: 'Link löschen', removing: 'Der Link wird gelöscht …', removed: 'Der Link ist gelöscht.', removeFailed: 'Der Link konnte nicht gelöscht werden. Versuche es später noch einmal.',
      until: date => `Gültig bis ${date}.`,
      errors: {
        snapshot_creation_disabled: 'Teilen per Link ist gerade nicht verfügbar.',
        snapshot_rate_limited: 'Du hast heute schon viele Links erstellt. Versuche es später noch einmal.',
        snapshot_capacity: 'Teilen per Link ist gerade ausgelastet. Versuche es später noch einmal.',
        unshareable: 'Dieser Stand der Antwort lässt sich nicht als Link teilen.',
        fallback: 'Der Link konnte nicht erstellt werden. Versuche es später noch einmal.'
      }
    },
    en: {
      button: 'Share this answer as a link',
      title: 'Save this link?',
      notice: 'To do this we store this situation and the answer on our server for 30 days. Anyone with the link can read it. Only pass the link on if you are comfortable with that. You can delete it here at any time. Copies that were already sent cannot be taken back.',
      create: 'Create link', cancel: 'Cancel', working: 'Creating the link …',
      label: 'Your link', copyButton: 'Copy link', copied: 'Link copied.', copyFailed: 'Select the link and copy it by hand.',
      remove: 'Delete link', removing: 'Deleting the link …', removed: 'The link is deleted.', removeFailed: 'The link could not be deleted. Please try again later.',
      until: date => `Valid until ${date}.`,
      errors: {
        snapshot_creation_disabled: 'Sharing by link is not available right now.',
        snapshot_rate_limited: 'You have created many links today. Please try again later.',
        snapshot_capacity: 'Sharing by link is busy right now. Please try again later.',
        unshareable: 'This version of the answer cannot be shared as a link.',
        fallback: 'The link could not be created. Please try again later.'
      }
    }
  };

  const el = (name, props = {}, children = []) => {
    const node = document.createElement(name);
    if (props.className) node.className = props.className;
    if (props.text) node.textContent = props.text;
    for (const [key, value] of Object.entries(props.attributes || {})) node.setAttribute(key, value);
    node.append(...children);
    return node;
  };
  const btn = (text, className, onClick) => {
    const node = el('button', { className, text, attributes: { type: 'button' } });
    node.addEventListener('click', onClick);
    return node;
  };

  // The proof of the shown answer, composed with the newest chain when another goal came later.
  const proofToShare = async (chain, key) => {
    const own = chain.proofs.get(key);
    if (!own) return null;
    if (!chain.latest || own === chain.latest) return own;
    const composed = await root.DemenzSnapshotAPI.compose(chain.latest, own);
    return composed.ok && typeof composed.data?.proof === 'string' ? composed.data.proof : null;
  };

  const linkFor = (readToken, en) => `${location.origin}${en ? '/en/shared.html' : '/de/geteilt.html'}#r=${readToken}`;

  const create = ({ chain, key, en }) => {
    const text = copy[en ? 'en' : 'de'];
    const api = root.DemenzSnapshotAPI;
    if (!api || !chain?.proofs?.get(key)) return null;
    const status = el('p', { className: 'translator-snapshot-status', attributes: { role: 'status', 'aria-live': 'polite' } });
    const field = el('input', { attributes: { type: 'text', readonly: '', autocomplete: 'off', spellcheck: 'false', 'aria-label': text.label } });
    field.className = 'translator-snapshot-url';
    const copyButton = btn(text.copyButton, 'translator-copy', async () => {
      try { await navigator.clipboard.writeText(field.value); status.textContent = text.copied; }
      catch { field.select(); status.textContent = text.copyFailed; }
    });
    let current = null;
    const removeButton = btn(text.remove, 'translator-copy translator-snapshot-remove', async () => {
      if (!current) return;
      removeButton.disabled = true; status.textContent = text.removing;
      const result = await api.remove(current.readToken, current.deleteToken);
      // 404 means the record is already gone (expired or deleted elsewhere).
      if (result.ok || result.status === 404) {
        root.DemenzSnapshotStore?.remove(current.readToken);
        current = null; result_.hidden = true; field.value = ''; start.hidden = false; start.focus();
        status.textContent = text.removed;
      } else { removeButton.disabled = false; status.textContent = text.removeFailed; }
    });
    const result_ = el('div', { className: 'translator-snapshot-result', attributes: { hidden: '' } }, [
      el('label', {}, [el('span', { text: text.label }), field]), el('p', { className: 'translator-snapshot-until' }), el('div', { className: 'translator-snapshot-actions' }, [copyButton, removeButton])
    ]);
    const make = async () => {
      confirmButton.disabled = true; cancelButton.disabled = true; start.disabled = true;
      status.textContent = text.working;
      try {
        const proof = await proofToShare(chain, key);
        if (!proof) { status.textContent = text.errors.unshareable; return; }
        const created = await api.create(proof);
        if (!created.ok) { status.textContent = text.errors[created.code] || text.errors.fallback; return; }
        const { readToken, deleteToken, expiresAt } = created.data || {};
        if (!root.DemenzSnapshotStore?.tokenShape.test(readToken) || !root.DemenzSnapshotStore.tokenShape.test(deleteToken)) { status.textContent = text.errors.fallback; return; }
        chain.activated = true;
        root.DemenzSnapshotStore.add({ readToken, deleteToken, expiresAt: String(expiresAt || ''), createdAt: new Date().toISOString() });
        current = { readToken, deleteToken };
        field.value = linkFor(readToken, en);
        const when = new Date(expiresAt);
        result_.querySelector('.translator-snapshot-until').textContent = Number.isNaN(when.getTime()) ? '' : text.until(when.toLocaleDateString(en ? 'en-GB' : 'de-DE'));
        confirmPanel.hidden = true; start.hidden = true; result_.hidden = false; removeButton.disabled = false;
        status.textContent = '';
        field.focus(); field.select();
      } finally { confirmButton.disabled = false; cancelButton.disabled = false; start.disabled = false; }
    };
    const confirmButton = btn(text.create, 'translator-copy translator-snapshot-confirm', make);
    const cancelButton = btn(text.cancel, 'translator-copy', () => { confirmPanel.hidden = true; start.setAttribute('aria-expanded', 'false'); status.textContent = ''; start.focus(); });
    const confirmPanel = el('div', { className: 'translator-snapshot-confirm-panel', attributes: { role: 'group', 'aria-label': text.title, hidden: '' } }, [
      el('p', { text: text.notice }), el('div', { className: 'translator-snapshot-actions' }, [confirmButton, cancelButton])
    ]);
    const start = btn(text.button, 'translator-copy translator-snapshot-start', () => {
      // One question per original situation. Later states of the same flow do not ask again.
      if (chain.activated) { void make(); return; }
      confirmPanel.hidden = false; start.setAttribute('aria-expanded', 'true'); confirmButton.focus();
    });
    start.setAttribute('aria-expanded', 'false');
    return el('section', { className: 'translator-snapshot-share', attributes: { 'data-snapshot-share': '' } }, [start, confirmPanel, status, result_]);
  };

  root.DemenzSnapshotShare = Object.freeze({ create, linkFor, copy });
})(typeof window !== 'undefined' ? window : globalThis);
