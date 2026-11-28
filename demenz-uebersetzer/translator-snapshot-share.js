// "Share this answer as a link" for the goal flow. Loaded only when the page config enables snapshot links.
// Nothing is stored on the server before the person confirms. The confirmation is asked once per original
// situation (per chain). The link holds only a random read token in the fragment, never the situation.
(function (root) {
  const copy = {
    de: {
      button: 'Antwort als Link teilen',
      title: 'Diesen Link speichern?',
      notice: 'Wir speichern dafür diese Situation und die Antwort dauerhaft auf unserem Server. Jede Person mit dem Link kann sie lesen. Gib den Link nur weiter, wenn du damit einverstanden bist. Du kannst ihn hier jederzeit löschen. Schon verschickte Kopien kannst du nicht zurückholen.',
      create: 'Link erstellen', cancel: 'Abbrechen', working: 'Der Link wird erstellt …',
      label: 'Dein Link', copyButton: 'Link kopieren', copied: 'Link kopiert.', copyFailed: 'Markiere den Link und kopiere ihn von Hand.',
      autoNotice: 'Diese Antwort hat jetzt einen eigenen Link. Zum Teilen kopierst du die Adresszeile. Der Link wird dauerhaft gespeichert, und jede Person mit dem Link kann die Antwort lesen.',
      remove: 'Link löschen', removing: 'Der Link wird gelöscht …', removed: 'Der Link ist gelöscht.', removeFailed: 'Der Link konnte nicht gelöscht werden. Versuche es später noch einmal.',
      until: date => `Gültig bis ${date}.`,
      noExpiry: 'Der Link läuft nicht ab.',
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
      notice: 'To do this we store this situation and the answer on our server permanently. Anyone with the link can read it. Only pass the link on if you are comfortable with that. You can delete it here at any time. Copies that were already sent cannot be taken back.',
      create: 'Create link', cancel: 'Cancel', working: 'Creating the link …',
      label: 'Your link', copyButton: 'Copy link', copied: 'Link copied.', copyFailed: 'Select the link and copy it by hand.',
      autoNotice: 'This answer now has its own link. To share it, copy the address bar. The link is stored permanently, and anyone with the link can read the answer.',
      remove: 'Delete link', removing: 'Deleting the link …', removed: 'The link is deleted.', removeFailed: 'The link could not be deleted. Please try again later.',
      until: date => `Valid until ${date}.`,
      noExpiry: 'The link does not expire.',
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

  // The address bar itself is the share link: the same page plus the read token in the fragment.
  const setAddress = readToken => { try { history.replaceState(history.state, '', `${location.pathname}#r=${readToken}`); } catch { /* sharing by the field below still works */ } };
  const clearAddress = () => { try { if (/^#r=/.test(location.hash)) history.replaceState(history.state, '', location.pathname); } catch { /* ignore */ } };
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
        current = null; result_.hidden = true; field.value = ''; start.hidden = false; clearAddress(); start.focus();
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
        setAddress(readToken);
        field.value = linkFor(readToken, en);
        const when = expiresAt ? new Date(expiresAt) : null;
        result_.querySelector('.translator-snapshot-until').textContent = !when || Number.isNaN(when.getTime()) ? text.noExpiry : text.until(when.toLocaleDateString(en ? 'en-GB' : 'de-DE'));
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

  // Automatic mode: the link is created as soon as the answer is shown and appears in the address bar.
  // Without a proof, a failed request or a full store, nothing changes and no link is shown.
  const createAuto = ({ chain, key, en }) => {
    const text = copy[en ? 'en' : 'de'];
    const api = root.DemenzSnapshotAPI;
    if (!api || !chain?.proofs?.get(key)) return null;
    const status = el('p', { className: 'translator-snapshot-status', attributes: { role: 'status', 'aria-live': 'polite' } });
    const node = el('section', { className: 'translator-snapshot-share translator-snapshot-auto', attributes: { 'data-snapshot-share': '', hidden: '' } }, [status]);
    (async () => {
      const proof = await proofToShare(chain, key);
      if (!proof || !node.isConnected) return;
      const created = await api.create(proof);
      if (!created.ok) return;
      const { readToken, deleteToken } = created.data || {};
      const shape = root.DemenzSnapshotStore?.tokenShape;
      if (!shape?.test(readToken) || !shape.test(deleteToken)) return;
      root.DemenzSnapshotStore.add({ readToken, deleteToken, expiresAt: String(created.data.expiresAt || ''), createdAt: new Date().toISOString() });
      // A newer answer may have replaced this one while the link was created.
      if (!node.isConnected) return;
      chain.activated = true;
      setAddress(readToken);
      // Daniel, 28. Nov: kein Hinweistext und kein Knopf „Link löschen“ unter der Antwort. Der Link steht still in der
      // Adresszeile und bleibt dauerhaft gültig.
    })();
    return node;
  };

  root.DemenzSnapshotShare = Object.freeze({ create, createAuto, clearAddress, linkFor, copy });
})(typeof window !== 'undefined' ? window : globalThis);
