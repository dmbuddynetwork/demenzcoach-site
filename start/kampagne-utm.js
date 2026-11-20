// Kampagnen-Link ohne UTM (/start/?k=…&a=…): UTM-Parameter ergänzen, bevor GA lädt.
// So landen Kampagne und Anzeige immer in den eingebauten GA4-Dimensionen
// „Sitzungskampagne“ und „Anzeigeninhalt“, ohne eigene Dimension (Limit 50/50).
(function () {
  try {
    var params = new URLSearchParams(location.search);
    var id = (params.get("k") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!id || params.get("vorschau") || params.get("utm_campaign")) return;
    var daten = window.DEMENZ_KAMPAGNEN;
    var kampagne = daten && daten.kampagnen && daten.kampagnen.filter(function (k) { return k.id === id; })[0];
    if (!kampagne) return;
    var anzeige = (params.get("a") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    params.set("utm_source", params.get("utm_source") || kampagne.src || kampagne.kanal || "ads");
    params.set("utm_medium", params.get("utm_medium") || (kampagne.kanal === "mail" ? "email" : "paid"));
    params.set("utm_campaign", id);
    if (anzeige) params.set("utm_content", anzeige);
    history.replaceState(null, "", location.pathname + "?" + params.toString() + location.hash);
  } catch (e) { /* Messung darf die Seite nie stören */ }
})();
