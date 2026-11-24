// Regeln für Kampagnen (Anzeigen + Landingpages). Läuft im Browser (Verwaltung) und in Node (Prüfung vor dem Build).
// Quelle der Regeln: Daniel (8. und 20. Nov 2026): nichtmedizinisch, keine erfundenen Zahlen/Bewertungen, keine falsche Dringlichkeit, Zielgruppe 60+.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.DemenzKampagnenRegeln = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MOMENTE = ['nachhause', 'wiederholt', 'mutter', 'wer', 'geld', 'arbeit', 'waschen'];
  const STATUS = ['entwurf', 'aktiv', 'pausiert'];
  const KANAELE = ['meta', 'tiktok', 'google', 'mail', 'organisch', 'sonstige'];
  const FORMATE = ['feed', 'story', 'reel', 'suche', 'mail'];
  const LIMITS = { ueberschrift: 70, unterzeile: 90, frage: 60, name: 60, text: 200, titel: 40, beschreibung: 40, knopf: 25 };
  // Medizinisch: Diagnose, Behandlung, Wirkversprechen (NON_MEDICAL_PURPOSE.md in der App).
  const MEDIZIN = /diagnos|therapi|behandl|heilen|heilt|linder|medikament|tablette|arzneimittel|symptom|stadium|schlaganfall|delir|depression|leitlinie|wirksam|klinisch|bewiesen/iu;
  // Erfundene Belege und falsche Dringlichkeit (UWG): Zahlen mit Prozent/Millionen, Sterne, Testsieger, Countdown-Druck.
  const BELEGE = /\d+\s*(%|prozent|millionen|mio|tausend|nutzer|familien|bewertungen)|sterne|testsieger|nr\.?\s*1|garantiert|nur noch heute|letzte chance|nur heute|läuft ab|schnell sein|ausverkauft/iu;
  const DEMENZ_VERSPRECHEN = /nie wieder streit|garantiert ruhig|ohne streit/iu;
  const ID = /^[a-z0-9-]{3,30}$/u;
  const text = (v) => typeof v === 'string' ? v.trim() : '';
  function felder(prefix, obj, regeln, fehler) {
    for (const [name, max] of Object.entries(regeln)) {
      const wert = text(obj?.[name]);
      if (wert.length > max) fehler.push(`${prefix}.${name}: ${wert.length} Zeichen, erlaubt sind ${max}`);
      if (MEDIZIN.test(wert)) fehler.push(`${prefix}.${name}: medizinisches Wort („${wert.match(MEDIZIN)[0]}“), die App bleibt nichtmedizinisch`);
      if (BELEGE.test(wert)) fehler.push(`${prefix}.${name}: erfundener Beleg oder falsche Dringlichkeit („${wert.match(BELEGE)[0]}“)`);
      if (DEMENZ_VERSPRECHEN.test(wert)) fehler.push(`${prefix}.${name}: Wirkversprechen („${wert.match(DEMENZ_VERSPRECHEN)[0]}“)`);
    }
  }
  function pruefeKampagne(k, nummer) {
    const fehler = [], p = `Kampagne ${k?.id || '#' + (nummer + 1)}`;
    if (!ID.test(k?.id || '')) fehler.push(`${p}: id nur a-z, 0-9 und Bindestrich, 3 bis 30 Zeichen`);
    if (!text(k?.name)) fehler.push(`${p}: name fehlt`);
    if (!STATUS.includes(k?.status)) fehler.push(`${p}: status muss ${STATUS.join(', ')} sein`);
    if (!KANAELE.includes(k?.kanal)) fehler.push(`${p}: kanal muss ${KANAELE.join(', ')} sein`);
    const lp = k?.landing || {};
    if (!text(lp.ueberschrift)) fehler.push(`${p}.landing.ueberschrift fehlt`);
    if (lp.moment && !MOMENTE.includes(lp.moment)) fehler.push(`${p}.landing.moment unbekannt: ${lp.moment}`);
    felder(`${p}.landing`, lp, { ueberschrift: LIMITS.ueberschrift, unterzeile: LIMITS.unterzeile, frage: LIMITS.frage }, fehler);
    felder(p, k, { name: LIMITS.name }, fehler);
    const adIds = new Set();
    for (const [i, a] of (k?.anzeigen || []).entries()) {
      const ap = `${p}.anzeige ${a?.id || '#' + (i + 1)}`;
      if (!ID.test(a?.id || '') && !/^[a-z0-9]{2,12}$/u.test(a?.id || '')) fehler.push(`${ap}: id nur a-z und 0-9, 2 bis 12 Zeichen`);
      if (adIds.has(a?.id)) fehler.push(`${ap}: id doppelt`); adIds.add(a?.id);
      if (!FORMATE.includes(a?.format)) fehler.push(`${ap}: format muss ${FORMATE.join(', ')} sein`);
      if (!text(a?.text)) fehler.push(`${ap}: text fehlt`);
      felder(ap, a, { text: LIMITS.text, titel: LIMITS.titel, beschreibung: LIMITS.beschreibung, knopf: LIMITS.knopf }, fehler);
    }
    return fehler;
  }
  function pruefe(daten) {
    const fehler = [];
    if (daten?.version !== 1) fehler.push('version muss 1 sein');
    felder('standard', daten?.standard, { ueberschrift: LIMITS.ueberschrift, unterzeile: LIMITS.unterzeile, frage: LIMITS.frage }, fehler);
    if (!text(daten?.standard?.ueberschrift)) fehler.push('standard.ueberschrift fehlt');
    const ids = new Set();
    for (const [i, k] of (daten?.kampagnen || []).entries()) {
      if (ids.has(k?.id)) fehler.push(`Kampagne ${k.id}: id doppelt`); ids.add(k?.id);
      fehler.push(...pruefeKampagne(k, i));
    }
    return fehler;
  }
  // Tracking-Link je Anzeige: Kanal, Kampagne und Anzeige als feste Kennungen, keine Personendaten.
  function link(k, anzeigenId, basis = 'https://dementiacoachapp.com') {
    const q = new URLSearchParams({ k: k.id });
    if (anzeigenId) q.set('a', anzeigenId);
    q.set('src', k.tracking?.src || k.kanal);
    q.set('utm_source', k.tracking?.src || k.kanal);
    q.set('utm_medium', k.kanal === 'mail' ? 'email' : 'paid');
    q.set('utm_campaign', k.tracking?.utm_campaign || k.id);
    if (anzeigenId) q.set('utm_content', anzeigenId);
    return `${basis}/start/?${q.toString()}`;
  }
  return { MOMENTE, STATUS, KANAELE, FORMATE, LIMITS, pruefe, pruefeKampagne, link };
});
