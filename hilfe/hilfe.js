// Verkaufsseite /hilfe/ (A/B-Test gegen /start/, Daniel, 26. Nov 2026).
// Runde 3 (Daniel: „eine Landingpage, die direkt verkauft, statt den 50-Seiten-Funnel“): kein Fragebogen. Jeder Knopf öffnet
// sofort die Kasse auf dieser Seite (abo/kasse.js, dieselbe wie /start/?direkt=1). Stripe fragt die E-Mail selbst.
// Live-Demo mit Sätzen aus abo/plan-data.js, Stimmen aus start/stimmen.js, Messung über DemenzConsent.
// Ohne Skript bleiben alle Knöpfe normale Links auf /start/?direkt=1.
import '/abo/plan-data.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const config = window.DEMENZ_ABO_CONFIG || {};
const clean = (value, max = 30) => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, max);
const guessApp = () => {
  const agent = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|FBIOS/u.test(agent)) return 'fb_app';
  if (/Instagram/u.test(agent)) return 'ig_app';
  if (/musical_ly|BytedanceWebview|TikTok/iu.test(agent)) return 'tiktok_app';
  return 'ads';
};
// Quelle: „lp_“ + Kanal. So sind Käufe über diese Seite in Statistik und Kasse vom alten Weg (/start/) getrennt.
const channel = clean(params.get('src') || params.get('utm_source')) || guessApp();
const source = `lp_${channel}`.slice(0, 30);
const campaign = clean(params.get('utm_campaign') || params.get('k'), 60);
const track = (name, extra = {}, marketing = '') => {
  try { window.DemenzConsent?.track?.(name, { entry: source, ...extra }); } catch { /* ohne Einwilligung nichts */ }
  try { if (marketing) window.DemenzConsent?.trackMarketing?.(marketing); } catch { /* */ }
  // Kauf-Trichter ohne Einwilligung (abo/zaehler.js, nur Summen je Tag): Apple-Pay-Tipp und -Bestätigung.
  if (name === 'apple_pay_quick_tap') count('applepay');
  if (name === 'apple_pay_quick_confirm') count('applepay_ok');
};
// Weg im Kauf-Trichter: „lp“ für /hilfe/, „kw“ für den Kurzweg (Quelle kw_<kanal>). Je Seitenaufruf höchstens einmal je Stufe.
const way = /^kw_/u.test(source) || location.pathname.startsWith('/hilfe/kurz') ? 'kw' : 'lp';
const count = stage => { try { window.DemenzZaehler?.once(`${way}_${stage}`); } catch { /* Zählen stört nie */ } };
count('view');

// ---- Preise: feste Werte, dann die Werte des Servers (dieselben wie in der Kasse) ----------------------------------
let offer = { yearly: 6999, monthly: 1299, trialDays: 7 };
let plan = 'yearly';
const guaranteeDays = 30;
const euro = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
// Nur ein belegbarer Vergleich (Jahrespreis gegenüber 12 Monatszahlungen), wie auf /start/.
// Willkommenspreis wie auf /start/ (49,99 € im ersten Jahr, danach 69,99 €), damit beide Test-Arme dasselbe Angebot haben.
// Das Fenster kommt vom Server (abo/angebot.js, POST /offer) mit echtem Ende. Danach gilt der normale Preis.
let offersOn = true;
const deal = () => (offersOn ? window.DemenzAngebot?.current?.() || null : null);
const firstYear = () => deal()?.firstYear ?? offer.yearly;
const saving = () => (deal() ? Math.floor((1 - firstYear() / (offer.monthly * 12)) * 100) : Math.floor((1 - offer.yearly / (offer.monthly * 12)) * 20) * 5);
const yearlyText = () => (deal() ? `${euro(firstYear())} im ersten Jahr, danach ${euro(offer.yearly)} pro Jahr` : `${euro(offer.yearly)} pro Jahr`);
const until = () => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(deal().expiresAt));
const priceText = key => `${key === 'yearly' ? yearlyText() : `${euro(offer.monthly)} pro Monat`} inkl. MwSt.`;
const termsText = () => `${offer.trialDays > 0 ? `${offer.trialDays} Tage kostenlos, dann ` : ''}${priceText(plan)} ${plan === 'yearly' ? 'Laufzeit 1 Jahr, danach mit 1 Monat Frist kündbar.' : 'Jederzeit zum Monatsende kündbar.'}${plan === 'yearly' && deal() ? ` Willkommenspreis gilt bis ${until()} Uhr.` : ''}`;
const buttonText = () => (offer.trialDays > 0 ? `Für ${euro(0)} starten` : `Für ${euro(plan === 'yearly' ? offer.yearly : offer.monthly)} starten`);

const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
};

// Ein Preisblock je Platz ([data-buy-slot]): zwei Pläne, ein Knopf, Bedingungen direkt darunter.
const blocks = [];
const planCard = (key, where) => el('button', { type: 'button', class: 'lp-plan', role: 'radio', 'data-plan': key, 'aria-checked': String(plan === key),
  onclick: () => { select(key); track('lp_plan', { plan: key, where }); } }, [
  el('span', { class: 'lp-plan-dot', 'aria-hidden': 'true' }),
  el('span', { class: 'lp-plan-text' }, [
    el('span', { class: 'lp-plan-row' }, [el('strong', { 'data-name': '' }), el('span', { class: 'lp-plan-tag', 'data-tag': '' })]),
    el('span', { 'data-price': '' })
  ])
]);
const fillCard = card => {
  const yearly = card.dataset.plan === 'yearly';
  card.querySelector('[data-name]').textContent = yearly ? '12-Monats-Plan' : '1-Monats-Plan';
  card.querySelector('[data-price]').textContent = yearly
    ? (deal() ? `${euro(firstYear())} im ersten Jahr\nDanach ${euro(offer.yearly)} im Jahr` : `${euro(offer.yearly)} im Jahr\nDas sind ${euro(Math.round(offer.yearly / 12))} im Monat`)
    : `${euro(offer.monthly)} im Monat`;
  const tag = card.querySelector('[data-tag]');
  tag.textContent = yearly && saving() >= 10 ? `Spare ${saving()} %` : '';
  tag.hidden = !tag.textContent;
};
const legal = () => el('p', { class: 'lp-legal' }, [
  `${offer.trialDays > 0 ? `Nach ${offer.trialDays} Tagen beginnt das Abo und läuft` : 'Das Abo beginnt sofort und läuft'} zum gewählten Preis weiter, bis du kündigst. Der Jahresplan hat eine Laufzeit von einem Jahr und ist danach mit einer Frist von einem Monat kündbar, der Monatsplan jederzeit zum Monatsende.${deal() ? ' Der Sonderpreis gilt für das erste Jahr des Jahresplans.' : ''} Alle Preise inklusive gesetzlicher Umsatzsteuer. Kündigen geht online ohne Anmeldung. Es gelten die `,
  el('a', { href: '/nutzungsbedingungen.html', text: 'Nutzungsbedingungen' }), ' und die ',
  el('a', { href: '/abo/widerruf.html', text: 'Widerrufsbelehrung' }),
  '. Allgemeine Kommunikations- und Alltagshilfe, kein Medizinprodukt.'
]);
const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>';
// Die Garantie gibt es schon (AGB 6a, /abo/garantie.html, Kündigungsart „garantie“). Hier wird sie nur sichtbar gemacht.
const guaranteeBox = where => {
  const icon = el('span', { class: 'lp-guarantee-icon' });
  icon.innerHTML = SHIELD;
  return el('div', { class: 'lp-guarantee' }, [icon, el('p', {}, [
    el('strong', { text: `${guaranteeDays} Tage Geld-zurück-Garantie` }),
    el('span', { text: 'Hilft es dir nicht, bekommst du dein Geld zurück. Ohne Begründung. ' }),
    el('a', { href: '/abo/garantie.html', onclick: () => track('garantie_link', { where }), text: 'Bedingungen' })
  ])]);
};
// Eine kurze echte Stimme (start/stimmen.js, Vorname mit Zustimmung, Text unverändert). Keine Sterne, keine Zahlen.
const voiceNearPrice = () => {
  const all = Array.isArray(window.DemenzStimmen) ? window.DemenzStimmen : [];
  const voice = all.find(entry => entry.name === 'Timo') || all[1];
  if (!voice) return null;
  return el('figure', { class: 'lp-voice-mini' }, [
    el('blockquote', { text: `„${voice.text}“` }),
    el('figcaption', {}, [el('strong', { text: `${voice.name}, ${voice.rolle}` }), el('span', { text: ' · Vorname mit Zustimmung' })]),
    document.getElementById('stimmen') && el('a', { class: 'lp-link', href: '#stimmen', onclick: () => { track('stimmen_mehr'); const list = document.querySelector('.lp-voices-all'); if (list) list.open = true; }, text: `Alle ${all.length} Stimmen lesen` })
  ]);
};
const mountBuy = slot => {
  const where = slot.querySelector('[data-go]')?.dataset.go || 'buy';
  const cards = ['yearly', 'monthly'].map(key => planCard(key, where));
  const terms = el('p', { class: 'lp-terms' });
  const button = el('button', { type: 'button', class: 'lp-btn', 'data-buy': where });
  // Apple Pay nur im ersten Preisblock (Daniel, 26. Nov 2026, wie RevenueCat Express Checkout und /start/?ap=1): Auf Geräten mit
  // Apple Pay liegt der unsichtbare Express-Knopf von Stripe über unserem Knopf, ein Tipp öffnet direkt das Apple-Pay-Fenster.
  // Ohne Apple Pay (z. B. Instagram- und Facebook-Browser) bleibt alles wie bisher: Knopf → gehostete Stripe-Seite.
  const pay = blocks.length === 0 ? {
    slots: { yearly: el('div', { class: 'lp-ap-slot', id: 'lp-ap-yearly', hidden: '' }), monthly: el('div', { class: 'lp-ap-slot', id: 'lp-ap-monthly', hidden: '' }) },
    ready: {}, mounted: {},
    mark: el('span', { class: 'lp-ap-mark', role: 'img', 'aria-label': 'Apple Pay', hidden: '' }),
    alt: el('button', { type: 'button', class: 'lp-link lp-ap-alt', 'data-buy': `${where}_andere`, hidden: '', text: 'Mit Karte oder anderer Zahlart bezahlen' })
  } : null;
  if (pay) pay.mark.innerHTML = APPLE_PAY_MARK;
  const cta = pay ? el('div', { class: 'lp-cta-wrap' }, [button, pay.slots.yearly, pay.slots.monthly]) : button;
  const block = el('div', { class: 'lp-buy-block' }, [
    el('div', { class: 'lp-plans', role: 'radiogroup', 'aria-label': 'Plan wählen' }, cards),
    terms, pay?.mark, cta, pay?.alt,
    // Vertrauen am Preis (27. Nov 2026, Konzept K3+K4): Garantie als Siegel unter dem Knopf, im ersten Block eine echte Stimme.
    guaranteeBox(where),
    el('ul', { class: 'lp-pills' }, [el('li', { text: 'Online kündbar, ohne Anmeldung' })]),
    blocks.length === 0 ? voiceNearPrice() : null,
    legal()
  ]);
  slot.replaceChildren(block);
  slot.classList.add('is-ready');
  blocks.push({ cards, terms, button, block, pay, where });
};
const APPLE_PAY_MARK = '<svg viewBox="0 0 60 24" aria-hidden="true"><path d="M13.6 7.3c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.4-.6.6-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3zm.9 1.5c-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.2 2.7 2.2s1.5-.7 2.8-.7 1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.4 1.2-2.5 0 0-2.3-.9-2.3-3.5 0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.1-1.8z" fill="#000"/><text x="20" y="18" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="14" font-weight="600" fill="#000">Pay</text></svg>';
// Express-Knopf für den gewählten Plan einhängen. kasse.js lädt Stripe.js und eine Sitzung nur, wenn das Gerät Apple Pay kann.
const mountApplePay = () => {
  const item = blocks.find(entry => entry.pay);
  const kasse = window.DemenzKasse;
  if (!item || !kasse?.mountApplePay || !config.firebase?.apiKey) return;
  const key = plan, pay = item.pay;
  if (pay.mounted[key]) return;
  pay.mounted[key] = true;
  kasse.mountApplePay(pay.slots[key], { plan: key, offer: key === 'yearly' && deal() ? window.DemenzAngebot.forCheckout() : null, source, campaign,
    track: name => track(name, { where: item.where, plan: key }), onError: message => { item.terms.textContent = message; } })
    .then(shown => { if (shown) { pay.ready[key] = true; syncApplePay(); } else pay.mounted[key] = false; });
};
const syncApplePay = () => {
  const pay = blocks.find(entry => entry.pay)?.pay;
  if (!pay) return;
  for (const key of ['yearly', 'monthly']) pay.slots[key].hidden = key !== plan || !pay.ready[key];
  pay.mark.hidden = pay.alt.hidden = !pay.ready[plan];
};
let applePayWanted = false;
const refresh = () => {
  for (const item of blocks) {
    for (const card of item.cards) { fillCard(card); card.setAttribute('aria-checked', String(card.dataset.plan === plan)); }
    item.terms.textContent = termsText();
    item.button.textContent = buttonText();
    item.block.querySelector('.lp-legal').replaceWith(legal());
  }
  if (stickyButton) stickyButton.textContent = buttonText();
  if (stickyNote) stickyNote.textContent = `${offer.trialDays > 0 ? `${offer.trialDays} Tage kostenlos, dann ` : ''}${plan === 'yearly' ? (deal() ? `${euro(firstYear())} im ersten Jahr` : `${euro(offer.yearly)} im Jahr`) : `${euro(offer.monthly)} im Monat`}`;
  const yearlyFaq = document.querySelector('[data-faq-yearly]');
  const monthlyFaq = document.querySelector('[data-faq-monthly]');
  if (yearlyFaq) yearlyFaq.textContent = deal() ? `${euro(firstYear())} im ersten Jahr, danach ${euro(offer.yearly)}` : euro(offer.yearly);
  if (monthlyFaq) monthlyFaq.textContent = euro(offer.monthly);
};

// ---- Kasse: Plan wählen, Knopf, sofort Stripe (über abo/kasse.js) -------------------------------------------------
let prepared = '';
const prepare = () => {
  const kasse = window.DemenzKasse;
  const key = `${plan}|${plan === 'yearly' ? deal()?.token || '' : ''}`;
  if (!kasse?.prepare || prepared === key) return;
  prepared = key;
  kasse.prepare({ plan, source, campaign, offer: checkoutOffer() });
};
const checkoutOffer = () => (plan === 'yearly' && deal() ? window.DemenzAngebot.forCheckout() : null);
function select(key) {
  plan = key;
  refresh();
  syncApplePay();
  if (prepared) prepare();
  if (applePayWanted) mountApplePay();
}
const buy = where => {
  track('lp_checkout', { where, plan }, 'InitiateCheckout');
  count('cta');
  const kasse = window.DemenzKasse;
  if (!kasse || !config.firebase?.apiKey) {
    location.href = `/abo/?plan=${plan}&src=${source}${campaign ? `&c=${campaign}` : ''}&weiter=1`;
    return;
  }
  // Zurück-Taste des Handys schließt die Kasse statt die Seite zu verlassen.
  history.pushState({ sheet: true }, '', location.href);
  count('kasse');
  kasse.open({ plan, source, campaign, offer: checkoutOffer(), stripePage: where.endsWith('_andere'), track: name => track(name, { where }),
    onClose: () => { if (history.state?.sheet) history.back(); },
    // Fenster abgelaufen: normaler Preis wird angezeigt, der Kunde tippt erneut (wie /start/).
    onOfferExpired: () => { const gone = deal(); if (gone) window.DemenzAngebot.drop(gone.kind); refresh(); } });
};
addEventListener('popstate', () => { if (window.DemenzKasse?.isOpen?.()) window.DemenzKasse.close(); });
document.addEventListener('click', event => {
  const target = event.target.closest('[data-buy]');
  if (!target) return;
  event.preventDefault();
  buy(target.dataset.buy || target.dataset.go || 'buy');
});
// Tempo: Konto und Stripe-Sitzung vorbereiten, sobald jemand den Knopf berührt oder der Preis eine Weile sichtbar ist.
document.addEventListener('pointerdown', event => { if (event.target.closest('[data-buy], .lp-plan')) prepare(); }, { passive: true });

for (const slot of document.querySelectorAll('[data-buy-slot]')) mountBuy(slot);
const sticky = $('sticky');
const stickyLink = sticky?.querySelector('[data-buy]');
let stickyButton = null, stickyNote = null;
if (stickyLink) {
  // Die Knopfleiste nutzt denselben gewählten Plan. Kein Link mehr, ein Knopf.
  const button = el('button', { type: 'button', class: 'lp-btn', 'data-buy': 'sticky' });
  stickyNote = el('p', { class: 'lp-sticky-note' });
  stickyLink.replaceWith(stickyNote, button);
  stickyButton = button;
}
refresh();

if (config.endpoint) {
  fetch(`${config.endpoint}/config`).then(response => (response.ok ? response.json() : null)).then(data => {
    if (!data?.plans?.yearly?.amount || !data?.plans?.monthly?.amount) return;
    offer = { yearly: data.plans.yearly.amount, monthly: data.plans.monthly.amount, trialDays: data.trialDays ?? 7 };
    offersOn = Boolean(data.offers?.intro || data.offers?.exit);
    refresh();
  }).catch(() => { /* feste Preise bleiben */ });
}
// Willkommensfenster holen (oder fortsetzen). Läuft es ab, springt die Anzeige auf den normalen Preis.
let expiryTimer = null;
const watchExpiry = () => {
  clearTimeout(expiryTimer);
  const current = deal();
  if (current) expiryTimer = setTimeout(() => { window.DemenzAngebot.drop(current.kind); refresh(); watchExpiry(); }, Math.max(0, current.expiresAt - Date.now()) + 500);
};
if (window.DemenzAngebot && !window.DemenzAngebot.ended('intro')) {
  window.DemenzAngebot.start('intro').then(() => { refresh(); watchExpiry(); }).catch(() => {});
} else watchExpiry();

// ---- Live-Demo: Satz antippen, Antwort sofort sehen. Nur feste, geprüfte Texte, keine KI-Anfrage. ------------------
const data = window.DEMENZ_PLAN_DATA || {};
const items = [...(data.situations || []), ...(data.weeks || [])].filter(item => item.key && item.say?.length);
const art = { nachhause: 'nach-hause.webp', wiederholt: 'ruhig-uhrzeit.webp', arbeit: 'work.webp', mutter: 'ruhig-mutter.webp',
  wer: 'ruhig-wer.webp', geld: 'ruhig-geld.webp', waschen: 'ruhig-waschen.webp', schongegessen: 'ruhig-gegessen.webp' };
const chips = [...document.querySelectorAll('[data-demo]')];
const show = (key, { focus = false, user = false } = {}) => {
  const item = items.find(entry => entry.key === key);
  if (!item) return;
  for (const chip of chips) { const on = chip.dataset.demo === key; chip.setAttribute('aria-checked', String(on)); chip.tabIndex = on ? 0 : -1; if (on && focus) chip.focus(); }
  $('a-quote').textContent = `„${item.quote}“`;
  $('a-say').replaceChildren(...item.say.slice(0, 3).map(text => el('li', { text })));
  const image = $('a-art');
  if (art[key]) { image.src = `/assets/zeichnungen/${art[key]}`; image.hidden = false; } else image.hidden = true;
  const card = $('answer'); card.classList.remove('is-new'); void card.offsetWidth; card.classList.add('is-new');
  if (user) track('lp_demo', { item: key });
};
chips.forEach(chip => {
  if (!items.some(entry => entry.key === chip.dataset.demo)) { chip.remove(); return; }
  chip.addEventListener('click', () => show(chip.dataset.demo, { user: true }));
  chip.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const list = chips.filter(item => item.isConnected);
    const next = list[(list.indexOf(chip) + step + list.length) % list.length];
    show(next.dataset.demo, { focus: true, user: true });
  });
});
// Vorschau aus der Anzeige: ?zeige=<schlüssel> zeigt diese Situation zuerst.
const wanted = clean(params.get('zeige'));
if (wanted && chips.some(chip => chip.dataset.demo === wanted)) show(wanted);
for (const name of Object.values(art)) { const pre = new Image(); pre.src = `/assets/zeichnungen/${name}`; }

// ---- Stimmen: echte Texte (start/stimmen.js, Vornamen mit Zustimmung). Keine Sterne, keine Zahlen. ---------------------
const mountVoices = () => {
  const voices = Array.isArray(window.DemenzStimmen) ? window.DemenzStimmen : [];
  const section = $('stimmen');
  if (!voices.length || !section) return;
  const card = (voice, clamp) => {
    const figure = el(clamp ? 'figure' : 'li', { class: 'lp-voice', ...(clamp ? { role: 'listitem' } : {}) });
    const text = el('p', { text: `„${voice.text}“` });
    figure.append(el('strong', { text: `${voice.name}, ${voice.rolle}` }), text);
    if (clamp && voice.text.length > 150) {
      text.classList.add('is-clamped');
      const more = el('button', { type: 'button', class: 'lp-link', text: 'Mehr lesen', 'aria-expanded': 'false' });
      more.addEventListener('click', () => {
        const open = text.classList.toggle('is-clamped') === false;
        more.textContent = open ? 'Weniger' : 'Mehr lesen'; more.setAttribute('aria-expanded', String(open));
      });
      figure.append(more);
    }
    return figure;
  };
  $('voices').append(...[0, 2, 3, 5, 10, 48, 49, 8].map(index => voices[index]).filter(Boolean).map(voice => card(voice, true)));
  $('voices-all').append(...voices.map(voice => card(voice, false)));
  $('voices-all-title').textContent = `Alle ${voices.length} Stimmen lesen`;
  section.hidden = false;
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountVoices, { once: true }); else mountVoices();

// ---- Beobachter: Knopfleiste, Vorbereitung der Kasse, Lesetiefe ----------------------------------------------------
if ('IntersectionObserver' in window) {
  const slots = [...document.querySelectorAll('[data-buy-slot]')];
  // Feste Knopfleiste unten: nur wenn kein Preisblock sichtbar ist und die Seite gescrollt wurde.
  if (sticky) {
    const visible = new Map();
    const update = () => { sticky.hidden = window.scrollY <= 400 || [...visible.values()].some(Boolean); };
    const watcher = new IntersectionObserver(entries => { for (const entry of entries) visible.set(entry.target, entry.isIntersecting); update(); }, { threshold: 0 });
    for (const slot of slots) watcher.observe(slot);
    addEventListener('scroll', update, { passive: true });
  }
  // Preis 1,5 Sekunden sichtbar: Kasse im Hintergrund vorbereiten, damit der Klick sofort zu Stripe führt.
  let timer = null;
  const warm = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { count('price'); clearTimeout(timer); timer = setTimeout(() => { prepare(); applePayWanted = true; mountApplePay(); warm.disconnect(); }, 1500); }
    else clearTimeout(timer);
  }, { threshold: .4 });
  for (const slot of slots) warm.observe(slot);
  // Ein Ereignis, wenn jemand bis zum Ablauf („So geht es weiter“) liest.
  const path = document.querySelector('.lp-path');
  if (path) {
    const reader = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { track('lp_read_price'); reader.disconnect(); }
    }, { threshold: .5 });
    reader.observe(path);
  }
}
