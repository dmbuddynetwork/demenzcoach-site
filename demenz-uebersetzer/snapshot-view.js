// Read-only page for a shared answer. The read token is in the URL fragment, so it is never sent
// to a server in a request line or referrer. All content is inserted as text, never as HTML.
(function () {
  const root = document.getElementById('shared-answer');
  const en = root.dataset.lang === 'en';
  const api = window.DemenzSnapshotAPI, store = window.DemenzSnapshotStore;
  const text = en ? {
    invalid: 'This link is not complete. Ask the person who sent it for the full link.',
    gone: 'This link has expired or was deleted.',
    unavailable: 'The answer is not available right now. Please try again later.',
    situation: 'The situation', goal: 'Goal', say: 'What you can say', avoid: 'Better to avoid', next: 'Next step', steps: 'Steps', question: 'A question',
    others: 'Note from another goal in this situation', until: d => `Stored until ${d}.`, remove: 'Delete this link', removing: 'Deleting …', removed: 'The link is deleted.', removeFailed: 'The link could not be deleted. Please try again later.',
    try: 'Try your own situation', translator: '/en/dementia-translator/', locale: 'en-GB', save: 'Safety notes'
  } : {
    invalid: 'Dieser Link ist nicht vollständig. Frage die Person, die ihn geschickt hat, nach dem ganzen Link.',
    gone: 'Dieser Link ist abgelaufen oder wurde gelöscht.',
    unavailable: 'Die Antwort ist gerade nicht verfügbar. Versuche es später noch einmal.',
    situation: 'Die Situation', goal: 'Ziel', say: 'Das kannst du sagen', avoid: 'Besser vermeiden', next: 'Nächster Schritt', steps: 'Schritte', question: 'Eine Rückfrage',
    others: 'Hinweis zu einem anderen Ziel in dieser Situation', until: d => `Gespeichert bis ${d}.`, remove: 'Diesen Link löschen', removing: 'Wird gelöscht …', removed: 'Der Link ist gelöscht.', removeFailed: 'Der Link konnte nicht gelöscht werden. Versuche es später noch einmal.',
    try: 'Eigene Situation ausprobieren', translator: '/de/demenz-uebersetzer/', locale: 'de-DE', save: 'Sicherheitshinweise'
  };
  const status = document.getElementById('shared-status'), content = document.getElementById('shared-content');
  const el = (name, props = {}, kids = []) => {
    const node = document.createElement(name);
    if (props.className) node.className = props.className;
    if (props.text != null) node.textContent = props.text;
    for (const [k, v] of Object.entries(props.attributes || {})) node.setAttribute(k, v);
    node.append(...kids.filter(Boolean));
    return node;
  };
  const para = value => typeof value === 'string' && value ? el('p', { text: value }) : null;
  const list = items => Array.isArray(items) && items.length ? el('ul', {}, items.filter(i => typeof i === 'string').map(i => el('li', { text: i }))) : null;
  const section = (title, ...kids) => { const nodes = kids.filter(Boolean); return nodes.length ? el('section', {}, [el('h2', { text: title }), ...nodes]) : null; };
  const telephone = href => typeof href === 'string' && /^tel:[0-9+]{2,6}$/u.test(href);

  // One safety note from a response: a stored message, the registered EN template, or fixed general information.
  const notesFor = (response, heading) => {
    const nodes = [];
    const body = response?.safetyMessage || response?.message;
    const template = response?.renderedWarning || null;
    if (body) nodes.push(el('p', { text: body }));
    if (response?.generalSafetyInfo?.text) nodes.push(el('p', { text: response.generalSafetyInfo.text }));
    return { body: nodes, template, heading };
  };
  const noteNode = (note, rendered) => {
    const kids = [];
    if (note.heading) kids.push(el('p', { className: 'shared-meta', text: note.heading }));
    kids.push(...note.body);
    const template = rendered || null;
    if (template && template.template) {
      kids.push(el('p', {}, [el('strong', { text: String(template.template.title || '') })]));
      kids.push(el('p', { text: String(template.template.text || '') }));
      const actions = (template.template.actions || []).filter(a => telephone(a?.href) && typeof a.label === 'string');
      if (actions.length) kids.push(el('p', {}, actions.map(a => el('a', { text: a.label, attributes: { href: a.href } }))));
    }
    return kids.length ? el('div', { className: 'shared-note', attributes: { role: 'note' } }, kids) : null;
  };

  const render = (snapshot, expiresAt) => {
    const response = snapshot.response || {};
    content.replaceChildren();
    content.append(
      section(text.situation, el('p', { className: 'shared-situation', text: snapshot.text }))
    );
    if (snapshot.selectedGoal?.label) content.append(el('p', { className: 'shared-goal', text: `${text.goal}: ${snapshot.selectedGoal.label}` }));
    const current = noteNode(notesFor(response, ''), null);
    const templated = snapshot.warnings.find(w => JSON.stringify(w.response) === JSON.stringify(response));
    const currentNote = response.kind === 'safety' || response.safetyLevel !== 'standard' || response.generalSafetyInfo
      ? noteNode(notesFor(response, ''), templated?.renderedWarning) : current;
    if (currentNote) content.append(currentNote);
    const card = el('div', { className: 'shared-card' });
    if (response.kind === 'answer') card.append(...[para(response.meaning), response.phrases?.length ? el('h2', { text: text.say }) : null, list(response.phrases),
      response.avoid ? el('h2', { text: text.avoid }) : null, para(response.avoid), response.nextStep ? el('h2', { text: text.next }) : null, para(response.nextStep)].filter(Boolean));
    else if (response.kind === 'self_support') card.append(...[para(response.meaning), el('h2', { text: text.steps }), list(response.steps),
      response.avoid ? el('h2', { text: text.avoid }) : null, para(response.avoid), response.nextStep ? el('h2', { text: text.next }) : null, para(response.nextStep)].filter(Boolean));
    else if (response.kind === 'clarification') card.append(...[el('h2', { text: text.question }), para(response.question), para(response.meaning), para(response.nextStep)].filter(Boolean));
    else if (response.kind === 'goal_clarification') card.append(...[el('h2', { text: text.question }), para(response.question)].filter(Boolean));
    if (card.childNodes.length) content.append(card);
    // Notes received for other goals of the same situation stay visible.
    for (const warning of snapshot.warnings || []) {
      if (JSON.stringify(warning.response) === JSON.stringify(response)) continue;
      const label = warning.selectedGoal?.label ? `${text.others}: „${warning.selectedGoal.label}“` : text.others;
      const node = noteNode(notesFor(warning.response, label), warning.renderedWarning);
      if (node) content.append(node);
    }
    const when = new Date(expiresAt);
    const meta = Number.isNaN(when.getTime()) ? null : el('p', { className: 'shared-meta', text: text.until(when.toLocaleDateString(text.locale)) });
    if (meta) content.append(meta);
    const actions = el('div', { className: 'shared-actions' }, [el('a', { className: 'primary', text: text.try, attributes: { href: text.translator } })]);
    const token = (location.hash.match(/^#r=([A-Za-z0-9_-]{43})$/u) || [])[1];
    const mine = token && store ? store.find(token) : null;
    if (mine) {
      const remove = el('button', { text: text.remove, attributes: { type: 'button' } });
      remove.addEventListener('click', async () => {
        remove.disabled = true; status.hidden = false; status.textContent = text.removing;
        const result = await api.remove(mine.readToken, mine.deleteToken);
        if (result.ok || result.status === 404) { store.remove(mine.readToken); content.hidden = true; status.textContent = text.removed; }
        else { remove.disabled = false; status.textContent = text.removeFailed; }
      });
      actions.append(remove);
    }
    content.append(actions);
    content.hidden = false;
    status.hidden = true;
  };

  const token = (location.hash.match(/^#r=([A-Za-z0-9_-]{43})$/u) || [])[1];
  if (!token) { status.textContent = text.invalid; return; }
  api.resolve(token).then(result => {
    if (result.ok && result.data?.snapshot && typeof result.data.snapshot.text === 'string') {
      render({ ...result.data.snapshot, warnings: Array.isArray(result.data.snapshot.warnings) ? result.data.snapshot.warnings : [] }, result.data.expiresAt);
      document.getElementById('shared-title').focus?.();
      return;
    }
    status.textContent = result.status === 404 ? text.gone : text.unavailable;
  });
})();
