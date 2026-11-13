// Pure signup view. Existing reviewed auth adapters own all identity/provider operations.
let nextID = 0;
// Presentation only: never replace a return/account/paid path with an optional setup offer.
export function mayOfferSignupSetup({ purpose, creditActive, entry, user, access } = {}) {
  return purpose === 'intro' && creditActive === true && entry?.anonymous === true && Boolean(entry.uid)
    && user?.uid === entry.uid && user.emailVerified === true
    && access?.enabled === true && access.verified === true && access.paid === false;
}
const markup = "<section class=\"offer personal\"><div class=\"offer-body\"><h3>Passende Worte für<br>den nächsten Moment.</h3><p class=\"lead\">Erhalte <strong>3 weitere KI-Antworten kostenlos.</strong><br>Mit einem bestätigten Konto.</p><button class=\"google\" type=\"button\" data-demo=\"google\"><svg viewBox=\"0 0 48 48\" aria-hidden=\"true\"><path fill=\"#EA4335\" d=\"M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z\"/><path fill=\"#4285F4\" d=\"M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z\"/><path fill=\"#FBBC05\" d=\"M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.86 23.86 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z\"/><path fill=\"#34A853\" d=\"M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z\"/></svg>Mit Google fortfahren</button><div class=\"separator\">oder mit E-Mail</div><form class=\"inline-form\"><label for=\"email-inline\">Deine E-Mail-Adresse</label><input id=\"email-inline\" name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"name@beispiel.de\" required maxlength=\"254\"><button class=\"primary\" type=\"submit\">3 Antworten kostenlos freischalten →</button></form><p class=\"micro\">Ohne Passwort. Anmeldelink im Postfach öffnen.</p><p class=\"demo-status\" role=\"status\"></p></div><div class=\"details\"><p>Keine automatische Newsletter-Anmeldung. Danach kannst du eine kostenpflichtige Mitgliedschaft wählen. Die Antworten erstellt eine KI.</p><div class=\"links\"><button type=\"button\" data-demo=\"login\">Schon ein Konto? Anmelden</button><span>·</span><button type=\"button\" data-demo=\"later\">Später</button></div></div></section>";
export function createSignupOffer({ document: doc = document, additionalAnswers = 3, locale = 'de', googleAvailable = false, purpose = 'intro', creditActive = false, signupCopy = 'variant_1', onEmail, onGoogle, onBegin = () => {}, onLater = () => {}, onContinue = onLater, returnToSituation = false, getRetryAt = () => 0, now = Date.now, presentation = 'inline' } = {}) {
  if (!Number.isInteger(additionalAnswers) || additionalAnswers < 1 || additionalAnswers > 5 || typeof onEmail !== 'function') throw new TypeError('signup_not_ready');
  const en = locale === 'en';
  const template=doc.createElement('template'); template.innerHTML=markup;
  const card=template.content.firstElementChild; card.classList.add('dc-signup'); card.lang=en?'en':'de';
  const input=card.querySelector('input'),label=card.querySelector('label'),form=card.querySelector('form'),send=card.querySelector('.primary'),google=card.querySelector('.google'),status=card.querySelector('[role=status]');
  input.id='dc-signup-email-'+(++nextID);label.htmlFor=input.id;card.querySelector('h3').id=input.id+'-title';
  const creditOffer = purpose === 'intro' && creditActive === true;
  const copy = signupCopy === 'variant_3' ? 'variant_3' : 'variant_1';
  const headlines = en
    ? { 'variant_1': 'What can I say right now?', 'variant_3': 'Words to say. A step to try.' }
    : { 'variant_1': 'Was sage ich jetzt am besten?', 'variant_3': 'Ein Satz zum Sagen. Ein Schritt zum Ausprobieren.' };
  card.querySelector('h3').textContent=creditOffer ? headlines[copy] : (en?'Your Dementia Coach account.':'Dein Konto für Demenz Coach.');
  card.querySelector('.lead').textContent=creditOffer
    ? (en ? `Get words you can try and a practical next step for everyday dementia care. With a verified account, you get ${additionalAnswers} more AI answers for free.` : `Erhalte passende Worte und einen konkreten nächsten Schritt für deinen Alltag mit Demenz. Mit deinem bestätigten Konto bekommst du ${additionalAnswers} weitere KI-Antworten kostenlos.`)
    : (en?'Sign in for free with Google or email. If you subscribe, your access will be linked to this account.':'Kostenlos mit Google oder E-Mail anmelden. Wenn du eine Mitgliedschaft abschließt, ist dein Zugang mit diesem Konto verknüpft.');
  if (creditOffer) card.dataset.signupCopy = copy;
  const normal=en?'Create a free account':'Kostenloses Konto erstellen';
  send.textContent=creditOffer ? (en ? `Unlock ${additionalAnswers} free answers` : `${additionalAnswers} Antworten kostenlos freischalten`) : normal;
  google.hidden=!(googleAvailable && typeof onGoogle==='function');card.querySelector('.separator').hidden=google.hidden;
  const actions=card.querySelectorAll('.links button');
  if(en){label.textContent='Your email address';input.placeholder='name@example.com';google.lastChild.textContent='Continue with Google';card.querySelector('.separator').textContent='or with email';card.querySelector('.micro').textContent='No password. No payment details. Sign-in link by email.';card.querySelector('.details p').textContent='No automatic newsletter signup. Afterwards, you can choose a paid membership. Answers are generated by AI.';actions[0].textContent='Already have an account? Sign in';actions[1].textContent='Later';}
  if(!en){card.querySelector('.micro').textContent='Ohne Passwort. Ohne Zahlungsdaten. Anmeldelink per E-Mail.';}
  if (purpose === 'account') {
    card.querySelector('h3').textContent=en?'Keep access to your account.':'Deinen Zugang jederzeit wieder öffnen.';
    card.querySelector('.lead').textContent=en?'Sign in or secure your existing guest account.':'Melde dich an oder sichere dein bisheriges Gastkonto.';
    send.textContent=en?'Continue with email':'Mit E-Mail fortfahren';
    card.querySelector('.details p').textContent=en?'No automatic newsletter signup. Signing in does not start a paid membership. Answers are generated by AI.':'Keine automatische Newsletter-Anmeldung. Die Anmeldung schließt keine kostenpflichtige Mitgliedschaft ab. Die Antworten erstellt eine KI.';
  }
  if (purpose !== 'account' && !creditOffer) card.querySelector('.details p').textContent=en?'No automatic newsletter signup. Answers are generated by AI.':'Keine automatische Newsletter-Anmeldung. Die Antworten erstellt eine KI.';
  const compact = presentation === 'sheet' && purpose !== 'account';
  if (compact) {
    card.querySelector('h3').textContent = en ? 'Sign up for FREE to continue' : 'Jetzt GRATIS anmelden, um fortzufahren';
    card.querySelector('.lead').textContent = en
      ? 'Words and tips for people caring for someone with dementia.'
      : 'Passende Worte und Tipps für pflegende Angehörige bei Demenz.';
    card.querySelector('.separator').textContent = en ? 'or' : 'oder';
    send.textContent = creditOffer ? (en ? 'Unlock for free' : 'Kostenlos freischalten') : (en ? 'Continue with email' : 'Mit E-Mail fortfahren');
    card.querySelector('.micro').textContent = en ? 'No password · No payment details' : 'Ohne Passwort · Ohne Zahlungsdaten';
    card.querySelector('.details').hidden = true;
  }
  const entry = card.querySelector('.offer-body'), details = card.querySelector('.details');
  const state = doc.createElement('section'); state.className = 'signup-state'; state.hidden = true;
  const stateTitle = doc.createElement('h3'); stateTitle.id = input.id + '-state'; stateTitle.tabIndex = -1;
  const addressLine = doc.createElement('p'); addressLine.className = 'signup-address';
  const address = doc.createElement('strong'); addressLine.append(address);
  const guidance = doc.createElement('p'); guidance.className = 'signup-guidance';
  const stateStatus = doc.createElement('p'); stateStatus.className = 'demo-status'; stateStatus.setAttribute('role', 'status');
  const resend = doc.createElement('button'); resend.type = 'button'; resend.className = 'signup-resend';
  const resendWait = doc.createElement('p'); resendWait.className = 'signup-resend-wait';
  const change = doc.createElement('button'); change.type = 'button'; change.className = 'signup-change'; change.textContent = en ? 'Change email address' : 'Adresse ändern';
  const proceed = doc.createElement('button'); proceed.type = 'button'; proceed.className = 'primary';
  proceed.textContent = returnToSituation ? (en ? 'Back to your situation' : 'Zurück zu deiner Situation') : (en ? 'Continue' : 'Weiter');
  proceed.addEventListener('click', () => onContinue());
  const setup = doc.createElement('a'); setup.className = 'primary signup-setup'; setup.href = '/start/'; setup.hidden = true;
  setup.textContent = en ? 'Set up personal everyday support' : 'Persönliche Alltagshilfe einrichten';
  state.append(stateTitle, addressLine, guidance, stateStatus, resendWait, resend, change, setup, proceed); card.append(state);
  const legal = doc.createElement('nav'); legal.className = 'signup-legal'; legal.setAttribute('aria-label', en ? 'Legal information' : 'Rechtliche Informationen');
  for (const [href, text] of [[en ? '/terms-en.html' : '/nutzungsbedingungen.html', en ? 'Terms of use' : 'Nutzungsbedingungen'], [en ? '/privacy-en.html' : '/datenschutz.html#ki-uebersetzer', en ? 'Privacy & AI' : 'Datenschutz & KI']]) {
    const link = doc.createElement('a'); link.href = href; link.textContent = text; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', text + (en ? ' (new tab)' : ' (neuer Tab)')); legal.append(link);
  }
  const legalContext = [];
  if (compact) {
    const [terms, privacy] = legal.children;
    const text = value => { const span = doc.createElement('span'); span.textContent = value; legalContext.push(span); return span; };
    terms.before(text(en ? 'By creating an account, you accept the ' : 'Mit der Kontoerstellung akzeptierst du die '));
    terms.after(text(en ? '. Information about ' : '. Informationen zu '));
    privacy.after(text('.'));
  }
  card.append(legal);
  let busy = false, lastEmail = '', retryAt = 0, disposed = false;
  const entryLabel = send.textContent;
  const publishState = name => {
    card.dataset.signupState = name;
    if (compact) {
      const atEntry = name === 'entry';
      legal.classList.toggle('signup-entry-legal', atEntry);
      legalContext.forEach(node => { node.hidden = !atEntry; });
      if (atEntry) send.after(legal); else card.append(legal);
    }
    card.dispatchEvent(new CustomEvent('dc-signup-state', { bubbles: true }));
  };
  const focusState = () => { stateTitle.focus({ preventScroll: true }); state.scrollIntoView({ block: 'nearest', behavior: 'instant' }); };
  const updateRetry = () => {
    const seconds = Math.max(0, Math.ceil((Math.max(retryAt, getRetryAt()) - now()) / 1000));
    resend.disabled = busy || seconds > 0; send.disabled = busy || seconds > 0;
    resend.textContent = en ? 'Send email again' : 'E-Mail erneut senden';
    resend.hidden = card.dataset.signupState !== 'sent' || seconds > 0;
    resendWait.hidden = card.dataset.signupState !== 'sent' || seconds === 0;
    resendWait.textContent = en ? `You can request another link in ${seconds} seconds.` : `Du kannst den Link in ${seconds} Sekunden erneut anfordern.`;
    if (!busy) send.textContent = seconds ? (en ? `Send link in ${seconds}s` : `Link senden in ${seconds} s`) : entryLabel;
  };
  const showSent = email => {
    lastEmail = email; entry.hidden = true; details.hidden = true; state.hidden = false;
    stateTitle.textContent = en ? 'Confirm your email' : 'Bestätige kurz deine E-Mail';
    address.textContent = email;
    guidance.textContent = en ? 'Open our email and follow the sign-in link.' : 'Öffne unsere E-Mail und tippe auf den Anmeldelink.';
    stateStatus.textContent = ''; addressLine.hidden = false; resend.hidden = false; change.hidden = false; proceed.hidden = true;
    setup.hidden = true; proceed.classList.remove('signup-direct');
    publishState('sent'); updateRetry(); focusState();
  };
  const showSuccess = (email, { offerSetup = false } = {}) => {
    entry.hidden = true; details.hidden = true; state.hidden = false;
    stateTitle.textContent = en ? 'You are signed in' : 'Du bist angemeldet';
    address.textContent = email || ''; addressLine.hidden = !email; resendWait.hidden = true;
    guidance.textContent = returnToSituation ? (en ? 'Continue with your existing situation.' : 'Du kannst bei deiner bisherigen Situation weitermachen.') : (en ? 'Your sign-in is complete. Continue when you are ready.' : 'Deine Anmeldung ist abgeschlossen. Du kannst jetzt weitergehen.');
    stateStatus.textContent = ''; resend.hidden = true; change.hidden = true; proceed.hidden = false;
    setup.hidden = !offerSetup; proceed.classList.toggle('signup-direct', offerSetup);
    proceed.textContent = offerSetup ? (en ? 'Continue asking directly' : 'Direkt weiterfragen') : (returnToSituation ? (en ? 'Back to your situation' : 'Zurück zu deiner Situation') : (en ? 'Continue' : 'Weiter'));
    publishState('success'); focusState();
  };
  const edit = () => {
    state.hidden = true; entry.hidden = false; details.hidden = compact; status.textContent = '';
    publishState('entry'); updateRetry(); input.focus(); input.select();
  };
  change.addEventListener('click', edit);
  async function run(kind) {
    if (busy || disposed) return;
    busy = true; input.disabled = true; send.disabled = true; google.disabled = true; resend.disabled = true;
    card.setAttribute('aria-busy', 'true');
    const email = input.value.trim();
    const message = en ? (kind === 'email' ? 'Requesting your sign-in link …' : 'Opening Google sign-in …') : (kind === 'email' ? 'Dein Anmeldelink wird angefordert …' : 'Die Google-Anmeldung wird geöffnet …');
    status.textContent = message; stateStatus.textContent = message;
    if (kind === 'email') send.textContent = en ? 'Requesting link …' : 'Link wird angefordert …';
    try {
      onBegin(); const result = await (kind === 'email' ? onEmail(email) : onGoogle());
      if (disposed) return;
      if (kind === 'email' && result?.sent === true) { retryAt = getRetryAt() || now() + 60000; showSent(email); }
      else if (kind === 'google' && result?.signedIn === true) showSuccess(result.email, { offerSetup: result.offerSetup === true });
      else throw new Error('not_confirmed');
    } catch (error) {
      if (disposed) return;
      const text = ['account_collision', 'original_browser_required'].includes(error?.code)
        ? (en ? 'This account may own a purchase. Use the original browser or contact support to keep access.' : 'Dieses Konto könnte einen Kauf enthalten. Verwende den ursprünglichen Browser oder kontaktiere den Support, damit dein Zugang erhalten bleibt.')
        : error?.code === 'auth/popup-closed-by-user' ? (en ? 'Sign-in was cancelled. Try again or use email.' : 'Die Anmeldung wurde abgebrochen. Versuche es erneut oder nutze E-Mail.')
        : error?.code === 'wait_before_resend' ? (en ? 'Please wait before requesting another link.' : 'Bitte warte kurz, bevor du einen neuen Link anforderst.')
        : error?.code === 'auth/too-many-requests' ? (en ? 'Too many requests. Please try later or use Google.' : 'Zu viele Anfragen. Versuche es später erneut oder nutze Google.')
        : kind === 'email' ? (en ? 'The email request could not be confirmed. Check your inbox or try again. You can also use Google.' : 'Die E-Mail-Anforderung konnte nicht bestätigt werden. Prüfe dein Postfach oder versuche es erneut. Du kannst auch Google nutzen.')
        : (en ? 'Sign-in did not finish. Please try again or contact support.' : 'Die Anmeldung hat nicht geklappt. Bitte versuche es erneut oder kontaktiere den Support.');
      const notice = state.hidden ? status : stateStatus; notice.textContent = text; notice.tabIndex = -1; notice.focus();
    } finally {
      busy = false; input.disabled = false; google.disabled = false; card.setAttribute('aria-busy', 'false'); updateRetry();
    }
  }
  resend.addEventListener('click', () => { if (!resend.disabled) { input.value = lastEmail; void run('email'); } });
  const timer = setInterval(() => { if (!card.isConnected) { clearInterval(timer); return; } updateRetry(); }, 1000);
  card.showSignupSent = showSent;
  card.showSignupSuccess = showSuccess;
  card.requestedEmail = () => lastEmail;
  card.disposeSignup = () => { disposed = true; clearInterval(timer); };
  publishState('entry'); updateRetry();
  form.addEventListener('submit',event=>{event.preventDefault();if(form.checkValidity())void run('email');});google.addEventListener('click',()=>void run('google'));
  // The auth adapter handles both new and existing accounts through the same path.
  actions[0].remove();card.querySelector('.links span').remove();
  actions[1].textContent=en?'Browse free resources':'Kostenlose Inhalte ansehen';
  actions[1].addEventListener('click',()=>onLater());
  return card;
}
