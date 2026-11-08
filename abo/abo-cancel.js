// Kündigungsseite (§ 312k BGB). Einziger Netzwerkaufruf: POST {endpoint}/cancel.
// Bestätigung per Link aus der E-Mail: kuendigung-bestaetigen.html (POST {endpoint}/cancel/confirm).
(() => {
  const config = window.DEMENZ_ABO_CONFIG;
  const $ = (id) => document.getElementById(id);
  const form = $("cancel-form");
  const kind = () => form.querySelector("input[name=kind]:checked")?.value ?? "ordentlich";

  const fail = (message) => {
    $("cancel-error").textContent = message;
    $("cancel-error").hidden = false;
    $("cancel-error").scrollIntoView({ behavior: "smooth", block: "center" });
  };

  for (const input of form.querySelectorAll("input[name=kind]")) {
    input.addEventListener("change", () => { $("reason-block").hidden = kind() !== "ausserordentlich"; });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    $("cancel-error").hidden = true;
    const body = {
      kind: kind(),
      name: $("name").value.trim(),
      email: $("email").value.trim(),
      reason: $("reason").value.trim(),
      requestedDate: $("date").value || undefined
    };
    if (body.name.length < 2) return fail("Bitte gib deinen Namen ein.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(body.email)) return fail("Bitte gib die E-Mail-Adresse deines Abos ein.");
    if (body.kind === "ausserordentlich" && body.reason.length < 3) return fail("Bitte nenne kurz den Grund.");
    $("cancel-button").disabled = true;
    try {
      const response = await fetch(`${config.endpoint}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || String(response.status));
      $("done-time").textContent = result.receivedAtText;
      $("done-kind").textContent = result.kindText;
      $("done-name").textContent = result.name;
      $("done-email").textContent = result.email;
      $("done-id").textContent = result.id;
      if (result.requestedDate) {
        $("done-date").textContent = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(`${result.requestedDate}T12:00:00`));
        $("done-date-line").hidden = false;
      }
      // Außerordentliche Kündigung und Widerruf führt erst der Link in der E-Mail aus (Schutz vor Fremden).
      $("done-mail").hidden = Boolean(result.confirmByMail);
      $("done-confirm").hidden = !result.confirmByMail;
      $("cancel-form-section").hidden = true;
      $("cancel-done").hidden = false;
      window.scrollTo({ top: 0 });
    } catch {
      $("cancel-button").disabled = false;
      fail("Das hat gerade nicht geklappt. Bitte versuch es noch einmal oder schreib an dementica@minini.de.");
    }
  });

  $("print-button").addEventListener("click", () => window.print());
})();
