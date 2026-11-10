import { mountInlineSignup } from './inline-signup.js';
import { webAuth } from './web-auth.js';
import { createEmailAccess, safeEmailReturn } from './email-auth.js';
const $ = (id) => document.getElementById(id);
const input = window.DemenzEmailLinkContext.take();
let target = safeEmailReturn(input.returnTo, location.origin);
const en = target.startsWith('/en/');
let callbackURL = input.url;
let intent = input.intent;
const access = createEmailAccess({ webAuth, config: window.DEMENZ_ABO_CONFIG });
const copy = en ? {
  title: 'Your account · DemenzCoach', heading: 'Continue with email', description: 'Receive a secure sign-in link by email. No password or phone number needed.', privacy: 'No history is uploaded and no newsletter is ordered. Existing helpful answers stay in this browser.',
  email: 'Email address', send: 'Send sign-in link', verify: 'Confirm email sign-in', checking: 'Checking your account …', ready: 'No payment details required.',
  sent: 'Your sign-in link is on its way. Check your inbox and spam folder. The link works without a password.',
  cross: 'Enter the email address that received this link. Nothing is linked or transferred automatically.',
  success: 'You are signed in. You can continue here or return to your original browser tab.', next: 'Continue', back: 'Back without signing in', privacyLink: 'Privacy', help: 'Account help', safety: 'Safety information and public guides remain free.',
  errors: { invalid_email: 'Please enter a valid email address.', email_required: 'Please enter the email address that received the link.', email_mismatch: 'Use the email address you entered when requesting this link.', wait_before_resend: 'Please wait a minute before requesting another link.', not_enabled: 'Email sign-in is not yet available. Please contact us.', original_browser_required: 'Open this link in the browser where you started. To protect an existing purchase, we cannot transfer a guest account automatically.', account_collision: 'This email belongs to another account. Please contact us to keep existing purchases safe.', storage_unavailable: 'Allow functional browser storage to start sign-in.', invalid_link: 'This link is invalid or has expired. Request a new one.', auth_unavailable: 'Sign-in is temporarily unavailable. Please try again.', generic: 'Sign-in did not finish. Please try again or contact us.' }
} : {
  title: 'Dein Konto · DemenzCoach', heading: 'Mit E-Mail weiter ausprobieren', description: 'Du erhältst einen sicheren Anmeldelink per E-Mail. Ohne Passwort und ohne Telefonnummer.', privacy: 'Es wird kein Verlauf hochgeladen und kein Newsletter bestellt. Hilfreiche Antworten bleiben in diesem Browser.',
  email: 'Deine E-Mail-Adresse', send: 'Anmeldelink senden', verify: 'E-Mail-Anmeldung bestätigen', checking: 'Dein Konto wird geprüft …', ready: 'Keine Zahlungsdaten nötig.',
  sent: 'Dein Anmeldelink ist unterwegs. Prüfe dein Postfach und den Spamordner. Der Link funktioniert ohne Passwort.',
  cross: 'Gib die E-Mail-Adresse ein, an die dieser Link geschickt wurde. Es wird nichts automatisch verknüpft oder übertragen.',
  success: 'Du bist angemeldet. Du kannst hier weitergehen oder deinen ursprünglichen Browser-Tab weiterverwenden.', next: 'Weiter', back: 'Ohne Anmeldung zurück', privacyLink: 'Datenschutz', help: 'Hilfe zum Konto', safety: 'Sicherheitshinweise und öffentliche Ratgeber bleiben kostenlos.',
  errors: { invalid_email: 'Bitte gib eine gültige E-Mail-Adresse ein.', email_required: 'Bitte gib die E-Mail-Adresse ein, die den Link erhalten hat.', email_mismatch: 'Verwende die E-Mail-Adresse, mit der du diesen Link angefordert hast.', wait_before_resend: 'Bitte warte eine Minute, bevor du einen neuen Link anforderst.', not_enabled: 'Der E-Mail-Zugang ist noch nicht freigeschaltet. Bitte kontaktiere uns.', original_browser_required: 'Öffne den Link in dem Browser, in dem du begonnen hast. Zum Schutz eines vorhandenen Kaufs übertragen wir Gastkonten nicht automatisch.', account_collision: 'Diese E-Mail gehört zu einem anderen Konto. Bitte kontaktiere uns, damit vorhandene Käufe erhalten bleiben.', storage_unavailable: 'Erlaube den funktionalen Browserspeicher, um die Anmeldung zu starten.', invalid_link: 'Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.', auth_unavailable: 'Die Anmeldung ist gerade nicht verfügbar. Bitte versuche es erneut.', generic: 'Die Anmeldung hat nicht geklappt. Bitte versuche es erneut oder kontaktiere uns.' }
};
document.documentElement.lang = en ? 'en' : 'de'; document.title = copy.title;
$('account-existing').textContent = en ? 'Sign in to an existing email account' : 'Mit bestehendem E-Mail-Konto anmelden';
$('account-new-link').textContent = en ? 'Request a new sign-in link' : 'Neuen Anmeldelink anfordern';
for (const [id, value] of Object.entries({ 'account-title': copy.heading, 'account-description': copy.description, 'account-privacy': copy.privacy, 'account-email-label': copy.email, 'account-send': copy.send, 'account-status': copy.checking, 'account-continue': copy.next, 'account-back': copy.back, 'account-privacy-link': copy.privacyLink, 'account-help-link': copy.help, 'account-safety': copy.safety })) $(id).textContent = value;
$('account-back').href = en ? '/en/dementia-translator/' : '/de/';
$('account-privacy-link').href = en ? '/privacy-en.html' : '/datenschutz.html';
$('account-help-link').href = en ? '/contact-en.html' : '/kontakt.html';
const status = (text) => { $('account-status').textContent = text; };
function complete(result) {
  target = result?.target || target;
  $('web-account-form').hidden = true; $('account-existing').hidden = true; $('account-new-link').hidden = true; $('account-continue').href = target; $('account-continue').hidden = false;
  status(copy.success); $('account-continue').focus(); callbackURL = '';
}
function failure(error) {
  $('account-status').hidden = false;
  let code = error?.code;
  if (['auth/operation-not-allowed', 'auth/unauthorized-domain'].includes(code)) code = 'not_enabled';
  if (['auth/expired-action-code', 'auth/invalid-action-code', 'invalid_link'].includes(code)) {
    code = 'invalid_link'; callbackURL = ''; access.forget(); $('account-send').textContent = copy.send;
  }
  status(copy.errors[code] || copy.errors.generic);
  $('web-account-form').hidden = code === 'not_enabled';
  $('account-new-link').hidden = !callbackURL;
}

try {
  if (window.DEMENZ_ABO_CONFIG.signIn?.emailLink !== true) throw { code: 'not_enabled' };
  const inspected = await access.inspect(callbackURL, input.state);
  if (inspected.callback) {
    $('account-send').textContent = copy.verify;
    if (inspected.pending) {
      $('account-email').value = inspected.pending.email;
      complete(await access.finish({ url: callbackURL, state: input.state, returnTo: target }));
    } else { status(copy.cross); $('web-account-form').hidden = false; $('account-email').focus(); }
  } else {
    callbackURL = '';
    if (inspected.user?.emailVerified && input.intent !== 'signin') complete({ target });
    else {
      const placeholder = document.createElement('div'); $('web-account-form').before(placeholder);
      $('account-title').classList.add('account-sr-only');
      for (const id of ['account-description','account-privacy','account-status','web-account-form','account-existing']) $(id).hidden = true;
      await mountInlineSignup(placeholder, { bonus: 3, en, purpose: 'account', onBegin() {}, returnTo: target });
    }
  }
} catch (error) { failure(error); }
$('web-account-form').addEventListener('submit', async (event) => {
  event.preventDefault(); $('account-send').disabled = true;
  try {
    if (callbackURL) complete(await access.finish({ email: $('account-email').value, url: callbackURL, state: input.state, returnTo: target }));
    else {
      await access.begin({ email: $('account-email').value, returnTo: target, intent });
      status(copy.sent);
    }
  } catch (error) { failure(error); }
  finally { $('account-send').disabled = false; }
});

$('account-existing').addEventListener('click', () => {
  intent = 'signin'; $('account-existing').hidden = true; status(copy.ready); $('account-email').focus();
});
$('account-new-link').addEventListener('click', () => {
  callbackURL = ''; access.forget(); $('account-send').textContent = copy.send;
  $('account-new-link').hidden = true; $('web-account-form').hidden = false;
  status(copy.ready); $('account-email').focus();
});
