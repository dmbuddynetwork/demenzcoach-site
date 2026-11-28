// Die Rückkehr-URL ist kein Zahlungsnachweis. Nur der geschützte Serverstatus
// darf die Erfolgsansicht öffnen. Hier werden keine Kaufereignisse ausgelöst.
export function createPaymentStatusController({ sessionID, loadStatus, render, activate, verified = () => {} }) {
  let checking = false;
  let activated = false;
  let verifiedOnce = false;
  return async function check() {
    if (checking) return;
    checking = true;
    render("checking");
    try {
      if (!sessionID) throw new Error("missing session");
      const status = await loadStatus(sessionID);
      // Das alte Live-Schema liefert keine geschützte Zahlungs-/Zugangsprüfung.
      // Seine Statuswerte begründen weder Erfolg noch Freischaltung.
      const legacy = status && !Object.hasOwn(status, "outcome") && !Object.hasOwn(status, "active")
        && ["open", "complete", "expired"].includes(status.status)
        && ["paid", "unpaid", "no_payment_required"].includes(status.paymentStatus);
      const active = status.status === "complete" && status.active === true && ["paid", "trialing", "no_payment_due"].includes(status.outcome);
      const outcome = legacy ? "legacy" : active ? status.outcome
        : ["failed", "action_required", "pending", "elsewhere"].includes(status.outcome) ? status.outcome : "unverified";
      render(outcome);
      if (!verifiedOnce && status.status === "complete" && typeof status.active === "boolean"
        && ["paid", "trialing", "no_payment_due", "pending", "failed", "action_required"].includes(status.outcome)) {
        verifiedOnce = true;
        verified();
      }
      if (active && !activated) {
        activated = true;
        activate();
      }
    } catch {
      render("unverified");
    } finally {
      checking = false;
    }
  };
}

export const paymentStatusText = Object.freeze({
  checking: ["Zahlungsstatus prüfen", "Wir prüfen deine Zahlung. Bitte schließe kein zweites Abo ab."],
  legacy: ["Prüfe deinen Zahlungsstatus", "Hier können wir deinen Zahlungsstatus noch nicht sicher bestätigen. Prüfe ihn in der Abo-Verwaltung. Bitte schließe kein zweites Abo ab."],
  pending: ["Deine Zahlung wird noch geprüft", "Bei einer Lastschrift kann die Bestätigung mehrere Werktage dauern. Dein Zugang wird nach der Bestätigung freigeschaltet. Bitte schließe kein zweites Abo ab."],
  failed: ["Dein Zugang ist noch nicht freigeschaltet", "Die Zahlung wurde nicht bestätigt oder das Abo wurde beendet. Prüfe den Stand unter „Abo verwalten“. Dort kannst du auch die Zahlungsart ändern."],
  action_required: ["Bitte prüfe deine Zahlung", "Deine Zahlung braucht noch eine Bestätigung. Öffne „Abo verwalten“, um den nächsten Schritt zu sehen."],
  // Bezahlt, aber in einem anderen Browser oder einer App (z. B. WhatsApp). Freischaltung nur nach Anmeldung mit der Kauf-E-Mail.
  elsewhere: ["Deine Zahlung ist eingegangen", "Dein Abo ist mit einem anderen Zugang verbunden. Melde dich mit der E-Mail-Adresse vom Kauf an. Dann ist dein Abo auch hier freigeschaltet. Bitte schließe kein zweites Abo ab."],
  unverified: ["Zahlungsstatus noch nicht bestätigt", "Wir konnten deinen Zahlungsstatus nicht prüfen. Nutze denselben Browser und dasselbe Konto wie beim Abschluss und versuche es erneut. Bitte schließe kein zweites Abo ab."],
  paid: ["Deine Zahlung ist bestätigt", "Dein Abo ist aktiv. Eine Vertragsbestätigung kommt per E-Mail."],
  trialing: ["Deine Probezeit ist aktiv", "Deine kostenlose Probezeit hat begonnen. Heute wurde nichts berechnet. Eine Vertragsbestätigung kommt per E-Mail."],
  no_payment_due: ["Dein Abo ist aktiv", "Für deine aktuelle Rechnung ist keine Zahlung fällig. Eine Vertragsbestätigung kommt per E-Mail."]
});

// Englische Rückkehr von Stripe (?lang=en, 28. Nov 2026): dieselben Zustände, natürliches Englisch.
export const paymentStatusTextEn = Object.freeze({
  checking: ["Checking your payment", "We are checking your payment. Please do not start a second subscription."],
  legacy: ["Check your payment status", "We cannot confirm your payment status here yet. Please check it under “Manage subscription”. Please do not start a second subscription."],
  pending: ["Your payment is still being checked", "With a bank debit, confirmation can take a few working days. Your access opens once the payment is confirmed. Please do not start a second subscription."],
  failed: ["Your access is not open yet", "The payment was not confirmed or the subscription has ended. Please check under “Manage subscription”. You can also change the payment method there."],
  action_required: ["Please check your payment", "Your payment still needs a confirmation. Open “Manage subscription” to see the next step."],
  elsewhere: ["Your payment has arrived", "Your subscription is linked to another login. Sign in with the email address you used to pay. Then your subscription is active here too. Please do not start a second subscription."],
  unverified: ["Payment status not confirmed yet", "We could not check your payment status. Use the same browser and account as when you paid, and try again. Please do not start a second subscription."],
  paid: ["Your payment is confirmed", "Your subscription is active. A contract confirmation is on its way by email."],
  trialing: ["Your free trial has started", "Your free trial is active. You were not charged today. A contract confirmation is on its way by email."],
  no_payment_due: ["Your subscription is active", "No payment is due for your current invoice. A contract confirmation is on its way by email."]
});
