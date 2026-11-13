// A one-time functional hint only; the helper rechecks the actual signed-in user.
try {
  if (sessionStorage.getItem('demenzcoach.signinNotice.v1')) import('/abo/signin-success.js').then(module => module.consumeSignInNotice()).catch(() => {});
} catch { /* Optional notice storage may be blocked. */ }
// Teller experiment: fixed arms only; all durable state and statistics require consent.
const createTellerExperiment = ({ host, statistics, track, entry, now = () => Date.now() }) => {
  const key = 'demenzcoach.teller.v1';
  const cookie = 'dc_teller_v1';
  const lifetime = 30 * 86400000;
  const arms = new Set(['website', 'funnel']);
  const url = new URL(host.location.href);
  let incoming = entry ?? url.searchParams.get('teller');
  if (!arms.has(incoming)) incoming = null;
  if (url.searchParams.has('teller')) {
    url.searchParams.delete('teller');
    host.history.replaceState(host.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  let record = null;
  let redirecting = false;
  let measurable = typeof host.navigator?.locks?.request === 'function';
  const valid = (value) => arms.has(value?.arm) && Number.isFinite(value?.expiresAt)
    && value.expiresAt > now() && value.expiresAt <= now() + lifetime
    && value.events && typeof value.events === 'object';
  const clearSaved = () => {
    try { host.localStorage.removeItem(key); } catch { /* storage blocked */ }
    host.document.cookie = `${cookie}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
  };
  const forget = () => { record = null; incoming = null; clearSaved(); };
  const refresh = () => {
    if (!statistics()) { forget(); return; }
    if (redirecting) return;
    let saved = null;
    try {
      saved = host.localStorage.getItem(key);
      const latest = JSON.parse(saved);
      // Always load the current shared record, even if this tab's old one is valid.
      if (valid(latest)) record = latest;
      else if (saved !== null) { record = null; clearSaved(); }
    } catch { /* keep the current page's record when storage is unavailable */ }
    if (!valid(record)) record = incoming ? { arm: incoming, expiresAt: now() + lifetime, events: {} } : null;
    if (incoming && record && incoming !== record.arm) {
      redirecting = true;
      const target = new URL(record.arm === 'website' ? '/de/' : '/start/', host.location.origin);
      target.searchParams.set('teller', record.arm);
      host.location.replace(target.toString());
    }
  };
  const save = () => {
    if (!statistics() || !valid(record) || redirecting) return;
    try { host.localStorage.setItem(key, JSON.stringify(record)); } catch { return; /* current page only, no durable cookie */ }
    host.document.cookie = `${cookie}=${record.arm}; Max-Age=${Math.max(0, Math.floor((record.expiresAt - now()) / 1000))}; Path=/; SameSite=Lax; Secure`;
  };
  const parameters = () => measurable && statistics() && !redirecting && valid(record)
    ? { experiment: 'teller_v1', experiment_arm: record.arm } : {};
  const emit = (name) => {
    if (!measurable || !statistics() || redirecting || !valid(record) || record.events[name]) return;
    record.events[name] = true;
    save();
    track(`teller_${record.arm}_${name}`, parameters());
  };
  const serialize = (action) => {
    if (!measurable) { action(); return Promise.resolve(); }
    return host.navigator.locks.request(key, action).catch(() => { measurable = false; });
  };
  let ready = Promise.resolve();
  const consentChanged = () => {
    if (!statistics()) { forget(); return Promise.resolve(); }
    ready = serialize(() => { refresh(); save(); emit('assigned'); });
    return ready;
  };
  const stage = (name) => {
    if (!['assigned', 'first_answer', 'complete'].includes(name) || !measurable || !statistics()) return Promise.resolve();
    // A single origin-wide transaction also covers truly concurrent tabs.
    return serialize(() => { refresh(); emit('assigned'); emit(name); });
  };
  // Synchronous routing recovery happens before GA's page_view. All persisted
  // measurement mutations then run under the same lock and re-read shared state.
  if (statistics()) refresh();
  if (statistics()) consentChanged();
  const attribution = () => measurable && statistics() && !redirecting && valid(record)
    ? { source: `teller_${record.arm}`, campaign: 'teller_v1', variant: record.arm === 'website' ? 'a' : 'b' } : {};
  return { consentChanged, parameters, stage, attribution, forget, get ready() { return ready; }, redirecting: () => redirecting };
};
// End Teller experiment factory.

const tellerURL = new URL(location.href);
const tellerEntry = tellerURL.searchParams.get('teller');
if (tellerURL.searchParams.has('teller')) {
  tellerURL.searchParams.delete('teller');
  history.replaceState(history.state, '', `${tellerURL.pathname}${tellerURL.search}${tellerURL.hash}`);
}

const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');
const usesEnglish = document.documentElement.lang.startsWith('en');
const localizedSiteCopy = window.demenzCoachSiteLocale ?? {};
const pageContext = {
  page_type: document.body.dataset.pageType ?? 'product',
  page_language: document.body.dataset.pageLanguage ?? document.documentElement.lang,
  page_slug: document.body.dataset.pageSlug ?? 'home'
};
const menuOpenCopy = localizedSiteCopy.menuOpen ?? (usesEnglish ? 'Open menu' : 'Menü öffnen');
const menuCloseCopy = localizedSiteCopy.menuClose ?? (usesEnglish ? 'Close menu' : 'Menü schließen');

menuButton?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.querySelector('.sr-only').textContent = isOpen ? menuCloseCopy : menuOpenCopy;
});

navigation?.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  navigation.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  const label = menuButton?.querySelector('.sr-only');
  if (label) label.textContent = menuOpenCopy;
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !navigation?.classList.contains('open')) return;
  navigation.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  const label = menuButton?.querySelector('.sr-only');
  if (label) label.textContent = menuOpenCopy;
  menuButton?.focus();
});

const mobileLayout = window.matchMedia('(max-width: 720px)');

// Eine Einwilligung für die ganze Website (auch /start/ und die Web-Kasse):
// - Statistik: Google Analytics 4, erst nach „Erlauben“.
// - Werbung messen: Meta- und TikTok-Pixel. Nur auf Seiten mit <body data-marketing-pixels>
//   und nur, wenn unten Pixel-IDs eingetragen sind; sonst fragt der Banner nur nach Statistik.
// Ohne Einwilligung lädt nichts davon. Eingetippte Texte gehen nie an diese Dienste.
const marketingPixelIDs = { meta: '', tiktok: '' };

const websiteAnalytics = (() => {
  const measurementID = 'G-5NRN1EMJDC';
  const consentKey = 'demenzcoach.analyticsConsent.v1';
  const marketingKey = 'demenzcoach.marketingConsent.v1';
  const marketingOnPage = document.body?.hasAttribute('data-marketing-pixels') === true
    && Boolean(marketingPixelIDs.meta || marketingPixelIDs.tiktok);
  let tagLoaded = false;
  let pixelsLoaded = false;

  const read = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const store = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The choice still applies for the current page when storage is unavailable.
    }
  };
  let sessionChoice = {};
  const readConsent = () => read(consentKey) ?? sessionChoice[consentKey] ?? null;
  const readMarketing = () => read(marketingKey) ?? sessionChoice[marketingKey] ?? null;
  const remember = (key, value) => {
    sessionChoice = { ...sessionChoice, [key]: value };
    store(key, value);
  };

  // Einzige Stelle, die fremde Skripte lädt (die Vorschau schaltet genau diese Zeile ab).
  const addScript = (src) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };

  const gtag = function () {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  };

  const loadTag = () => {
    if (tagLoaded || window.DemenzTeller?.redirecting()) return;
    tagLoaded = true;

    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    gtag('set', 'ads_data_redaction', true);
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', measurementID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      content_group: pageContext.page_type,
      ...pageContext
    });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${measurementID}`);
  };

  const loadPixels = () => {
    if (pixelsLoaded || !marketingOnPage) return;
    pixelsLoaded = true;
    if (marketingPixelIDs.meta && !window.fbq) {
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      Object.assign(fbq, { push: fbq, loaded: true, version: '2.0', queue: [] });
      window.fbq = fbq;
      window._fbq = window._fbq || fbq;
      // Keine automatische Erfassung von Knöpfen und Seiteninhalten.
      fbq('set', 'autoConfig', false, marketingPixelIDs.meta);
      fbq('init', marketingPixelIDs.meta);
      fbq('track', 'PageView');
      addScript('https://connect.facebook.net/en_US/fbevents.js');
    }
    if (marketingPixelIDs.tiktok && !window.ttq) {
      const id = marketingPixelIDs.tiktok;
      const ttq = [];
      window.TiktokAnalyticsObject = 'ttq';
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
      ttq.setAndDefer = (target, method) => {
        target[method] = function () {
          target.push([method, ...arguments]);
        };
      };
      ttq.methods.forEach((method) => ttq.setAndDefer(ttq, method));
      ttq.instance = (instanceID) => {
        const instance = ttq._i[instanceID] || [];
        ttq.methods.forEach((method) => ttq.setAndDefer(instance, method));
        return instance;
      };
      const source = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = { [id]: Object.assign([], { _u: source }) };
      ttq._t = { [id]: Date.now() };
      ttq._o = { [id]: {} };
      window.ttq = ttq;
      ttq.page();
      addScript(`${source}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
    }
  };

  const clearCookies = (prefixes) => {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (!prefixes.some((prefix) => name.startsWith(prefix))) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}; SameSite=Lax`;
    });
  };

  const startStatistics = () => {
    window[`ga-disable-${measurementID}`] = false;
    if (tagLoaded) gtag('consent', 'update', { analytics_storage: 'granted' });
    loadTag();
  };

  const grant = () => { remember(consentKey, 'granted'); startStatistics(); };

  // Also used for another tab's withdrawal/clear without recreating its removed choice.
  const stopStatistics = () => {
    window[`ga-disable-${measurementID}`] = true;
    if (tagLoaded) {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    clearCookies(['_ga']);
  };

  const deny = () => { remember(consentKey, 'denied'); stopStatistics(); };

  const grantMarketing = () => {
    remember(marketingKey, 'granted');
    loadPixels();
  };

  const denyMarketing = () => {
    remember(marketingKey, 'denied');
    if (pixelsLoaded) {
      window.fbq?.('consent', 'revoke');
      window.ttq?.revokeConsent?.();
    }
    clearCookies(['_fbp', '_fbc', '_ttp', 'ttcsid']);
  };

  const track = (name, parameters = {}) => {
    if (readConsent() !== 'granted' || window.DemenzTeller?.redirecting()) return;
    loadTag();
    gtag('event', name, { ...pageContext, ...parameters, ...window.DemenzTeller?.parameters() });
  };

  // Werbe-Ereignisse (z. B. Lead, InitiateCheckout, Purchase): nur feste Namen und Zahlen, nie Texte.
  const metaStandard = new Set(['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Subscribe', 'StartTrial']);
  const trackMarketing = (name, parameters = {}) => {
    if (!marketingOnPage || readMarketing() !== 'granted') return;
    loadPixels();
    window.fbq?.(metaStandard.has(name) ? 'track' : 'trackCustom', name, parameters);
    window.ttq?.track?.(name === 'Purchase' ? 'CompletePayment' : name, parameters);
  };

  const clearSessionChoices = () => { sessionChoice = {}; };
  return { clearSessionChoices, startStatistics, stopStatistics, deny, denyMarketing, grant, grantMarketing, loadPixels, loadTag, marketingOnPage, readConsent, readMarketing, track, trackMarketing };
})();

const fallbackAnalyticsCopy = usesEnglish
  ? {
      title: 'May we count visits?',
      marketingTitle: 'May we count visits and measure ads?',
      text: 'With your permission, Google Analytics counts which pages are used and how. What you type is never sent. Data may be transferred to the USA. You can change your choice at any time under “Privacy settings”.',
      marketingText: 'With your permission, Google Analytics counts which pages are used, and Meta (Facebook, Instagram) and TikTok measure which of our ads work. What you type is never sent. Data may be transferred to the USA. You can change your choice at any time under “Privacy settings”.',
      decline: 'Decline',
      accept: 'Allow',
      acceptAll: 'Allow all',
      choose: 'Choose individually',
      statistics: 'Count visits (Google Analytics)',
      marketing: 'Measure ads (Meta, TikTok)',
      save: 'Save choice',
      privacy: 'Privacy policy',
      settings: 'Privacy settings'
    }
  : {
      title: 'Dürfen wir Besuche zählen?',
      marketingTitle: 'Dürfen wir Besuche zählen und Werbung messen?',
      text: 'Mit deiner Einwilligung zählt Google Analytics, welche Seiten wie genutzt werden. Was du eintippst, wird nie übertragen. Dabei können Daten in die USA gehen. Du kannst das jederzeit unter „Datenschutz-Einstellungen“ ändern.',
      marketingText: 'Mit deiner Einwilligung zählt Google Analytics, welche Seiten genutzt werden, und Meta (Facebook, Instagram) und TikTok messen, welche unserer Anzeigen wirken. Was du eintippst, wird nie übertragen. Dabei können Daten in die USA gehen. Du kannst das jederzeit unter „Datenschutz-Einstellungen“ ändern.',
      decline: 'Ablehnen',
      accept: 'Erlauben',
      acceptAll: 'Alle erlauben',
      choose: 'Einzeln auswählen',
      statistics: 'Besuche zählen (Google Analytics)',
      marketing: 'Werbung messen (Meta, TikTok)',
      save: 'Auswahl speichern',
      privacy: 'Datenschutzerklärung',
      settings: 'Datenschutz-Einstellungen'
    };
const analyticsCopy = {
  ...fallbackAnalyticsCopy,
  ...(localizedSiteCopy.analytics ?? {})
};
// Andere Sprachen haben einen eigenen Text ohne Anbieternamen: den Anbieter dann anhängen.
const baseConsentText = websiteAnalytics.marketingOnPage
  ? analyticsCopy.marketingText
  : /Google/.test(analyticsCopy.text) ? analyticsCopy.text : `${analyticsCopy.text} (Google Analytics)`;
const tellerConsentTexts = {
  de: 'Mit deiner Statistik-Einwilligung merken wir den Einstieg Website/Fragebogen 30 Tage lang und ordnen bezahlte Abos zu. Ohne Erlaubnis wird diese Zuordnung nicht gespeichert oder an die Kasse gesendet.',
  en: 'With your statistics consent we remember the website/questionnaire entry for 30 days and attribute paid subscriptions. Without permission, this assignment is not stored or sent to checkout.',
  fr: 'Avec votre accord pour les statistiques, nous mémorisons votre entrée par le site ou le questionnaire pendant 30 jours et y attribuons les abonnements payés. Sans accord, cette attribution n’est ni conservée ni transmise au paiement.',
  pl: 'Za zgodą na statystyki zapamiętujemy wejście przez stronę lub ankietę przez 30 dni i przypisujemy opłacone subskrypcje. Bez zgody przypisanie nie jest zapisywane ani przekazywane do płatności.',
  ro: 'Cu acordul pentru statistici, reținem intrarea prin site sau chestionar timp de 30 de zile și atribuim abonamentele plătite. Fără acord, atribuirea nu este salvată sau trimisă la plată.',
  bg: 'Със съгласието ви за статистика запомняме входа през сайта или въпросника за 30 дни и свързваме платените абонаменти. Без съгласие това разпределение не се съхранява и не се изпраща към плащането.',
  hr: 'Uz pristanak na statistiku pamtimo ulazak preko stranice ili upitnika 30 dana i pripisujemo plaćene pretplate. Bez pristanka dodjela se ne pohranjuje niti šalje na naplatu.',
  sk: 'So súhlasom so štatistikou si pamätáme vstup cez web alebo dotazník 30 dní a priraďujeme zaplatené predplatné. Bez súhlasu sa priradenie neukladá ani neposiela k platbe.',
  hu: 'Statisztikai hozzájárulással 30 napig megjegyezzük, hogy a weboldalon vagy kérdőíven érkeztél, és hozzárendeljük a kifizetett előfizetéseket. Engedély nélkül ezt nem tároljuk és nem küldjük a pénztárnak.',
  cs: 'Se souhlasem se statistikou si pamatujeme vstup přes web nebo dotazník 30 dní a přiřazujeme zaplacená předplatná. Bez souhlasu se přiřazení neukládá ani neposílá k platbě.',
  uk: 'За вашою згодою на статистику ми запам’ятовуємо вхід через сайт або анкету на 30 днів і пов’язуємо з ним оплачені підписки. Без згоди цей розподіл не зберігається та не передається для оплати.',
  bs: 'Uz pristanak na statistiku pamtimo ulazak putem stranice ili upitnika 30 dana i pripisujemo plaćene pretplate. Bez pristanka dodjela se ne čuva niti šalje na naplatu.',
  sr: 'Уз пристанак на статистику памтимо улазак преко сајта или упитника 30 дана и приписујемо плаћене претплате. Без пристанка додела се не чува нити шаље на наплату.',
  lt: 'Gavę sutikimą statistikai, 30 dienų įsimename įėjimą per svetainę ar klausimyną ir priskiriame apmokėtas prenumeratas. Be sutikimo šis priskyrimas nesaugomas ir nesiunčiamas į mokėjimą.',
  sl: 'S soglasjem za statistiko si 30 dni zapomnimo vstop prek strani ali vprašalnika in mu pripišemo plačane naročnine. Brez soglasja se dodelitev ne shrani ali pošlje v plačilo.',
  lv: 'Ar piekrišanu statistikai 30 dienas atceramies ieeju caur vietni vai anketu un piesaistām apmaksātos abonementus. Bez piekrišanas šī piesaiste netiek glabāta vai nosūtīta maksājumam.',
  et: 'Statistika nõusolekul jätame veebilehe või küsimustiku kaudu sisenemise 30 päevaks meelde ja seostame tasutud tellimused. Ilma loata seda jaotust ei salvestata ega saadeta maksmisele.',
  ru: 'С вашего согласия на статистику мы запоминаем вход через сайт или анкету на 30 дней и связываем с ним оплаченные подписки. Без согласия это распределение не сохраняется и не передаётся для оплаты.',
  tr: 'İstatistik izninizle site veya anket girişini 30 gün hatırlar ve ödenmiş aboneliklerle ilişkilendiririz. İzin olmadan bu atama saklanmaz veya ödeme sayfasına gönderilmez.',
  ar: 'بموافقتك على الإحصاءات، نتذكر الدخول عبر الموقع أو الاستبيان لمدة 30 يومًا ونربطه بالاشتراكات المدفوعة. دون موافقتك، لا يُحفظ هذا التخصيص ولا يُرسل إلى صفحة الدفع.',
  it: 'Con il consenso alle statistiche ricordiamo per 30 giorni l’ingresso dal sito o dal questionario e attribuiamo gli abbonamenti pagati. Senza consenso, l’assegnazione non viene salvata né inviata al pagamento.',
  es: 'Con tu consentimiento para estadísticas recordamos la entrada por la web o el cuestionario durante 30 días y atribuimos las suscripciones pagadas. Sin permiso, esta asignación no se guarda ni se envía al pago.',
  pt: 'Com seu consentimento para estatísticas, lembramos a entrada pelo site ou questionário por 30 dias e atribuímos as assinaturas pagas. Sem permissão, essa atribuição não é salva nem enviada ao pagamento.',
  nl: 'Met je toestemming voor statistieken onthouden we de ingang via website of vragenlijst 30 dagen en koppelen we betaalde abonnementen. Zonder toestemming wordt deze indeling niet opgeslagen of naar de kassa verzonden.',
  el: 'Με τη συγκατάθεσή σας για στατιστικά θυμόμαστε την είσοδο μέσω ιστοσελίδας ή ερωτηματολογίου για 30 ημέρες και αντιστοιχίζουμε πληρωμένες συνδρομές. Χωρίς άδεια, η αντιστοίχιση δεν αποθηκεύεται ούτε αποστέλλεται στην πληρωμή.',
  sq: 'Me pëlqimin për statistika, ruajmë hyrjen nga faqja ose pyetësori për 30 ditë dhe lidhim abonimet e paguara. Pa leje, kjo ndarje nuk ruhet dhe nuk dërgohet te pagesa.',
  fa: 'با رضایت شما برای آمار، ورود از وب‌سایت یا پرسش‌نامه را ۳۰ روز به خاطر می‌سپاریم و اشتراک‌های پرداخت‌شده را به آن نسبت می‌دهیم. بدون اجازه، این تخصیص ذخیره یا به صفحه پرداخت ارسال نمی‌شود.',
  th: 'เมื่อคุณยินยอมให้เก็บสถิติ เราจะจดจำการเข้าผ่านเว็บไซต์หรือแบบสอบถามเป็นเวลา 30 วัน และเชื่อมโยงกับการสมัครสมาชิกที่ชำระแล้ว หากไม่อนุญาต เราจะไม่บันทึกหรือส่งข้อมูลการแบ่งกลุ่มนี้ไปยังหน้าชำระเงิน',
  da: 'Med dit samtykke til statistik husker vi indgangen via hjemmesiden eller spørgeskemaet i 30 dage og tilskriver betalte abonnementer. Uden tilladelse gemmes fordelingen ikke og sendes ikke til betaling.',
  fi: 'Tilastosuostumuksellasi muistamme sivuston tai kyselyn kautta saapumisen 30 päivää ja yhdistämme maksetut tilaukset. Ilman lupaa tätä jakoa ei tallenneta eikä lähetetä maksamiseen.',
  ga: 'Le do thoiliú le staitisticí, cuimhnímid ar an mbealach isteach tríd an suíomh nó an ceistneoir ar feadh 30 lá agus ceanglaímid síntiúis íoctha leis. Gan cead, ní stóráiltear an sannadh seo ná ní sheoltar chuig an íocaíocht é.',
  mt: 'Bil-kunsens tiegħek għall-istatistika, niftakru d-dħul mis-sit jew mill-kwestjonarju għal 30 jum u nattribwixxu abbonamenti mħallsa. Mingħajr permess, din l-assenjazzjoni ma tinħażinx u ma tintbagħatx għall-ħlas.',
  sv: 'Med ditt samtycke till statistik minns vi ingången via webbplatsen eller frågeformuläret i 30 dagar och kopplar betalda prenumerationer. Utan tillstånd sparas inte fördelningen eller skickas till betalningen.'
};
let tellerContext = ['website', 'funnel'].includes(tellerEntry);
if (!tellerContext && websiteAnalytics.readConsent() === 'granted') {
  try {
    const saved = JSON.parse(localStorage.getItem('demenzcoach.teller.v1'));
    tellerContext = ['website', 'funnel'].includes(saved?.arm) && saved.expiresAt > Date.now();
  } catch { /* no experiment context */ }
}
const tellerLanguage = document.documentElement.lang.split('-')[0];
const tellerConsentCopy = localizedSiteCopy.analytics?.tellerText ?? tellerConsentTexts[tellerLanguage];
const consentText = baseConsentText + (tellerContext && tellerConsentCopy ? ` ${tellerConsentCopy}` : '');
// Absolute Adresse, damit der Link auch in Unterordnern wie /start/ oder /ratgeber/ stimmt.
const privacyURL = new URL(localizedSiteCopy.privacyURL ?? (usesEnglish ? 'privacy-en.html' : 'datenschutz.html'), `${location.origin}/`).pathname;

const consentBanner = document.createElement('section');
consentBanner.className = 'consent-banner';
consentBanner.hidden = true;
consentBanner.setAttribute('role', 'region');
consentBanner.setAttribute('aria-labelledby', 'consent-title');
consentBanner.innerHTML = `
  <div class="consent-copy">
    <strong id="consent-title">${websiteAnalytics.marketingOnPage ? analyticsCopy.marketingTitle : analyticsCopy.title}</strong>
    <p>${consentText} <a href="${privacyURL}">${analyticsCopy.privacy}</a></p>
  </div>
  <div class="consent-choices" hidden>
    <label class="consent-choice"><input type="checkbox" name="statistics"> <span>${analyticsCopy.statistics}</span></label>
    <label class="consent-choice"><input type="checkbox" name="marketing"> <span>${analyticsCopy.marketing}</span></label>
    <button class="consent-button consent-save" type="button">${analyticsCopy.save}</button>
  </div>
  <div class="consent-actions">
    <button class="consent-button consent-decline" type="button">${analyticsCopy.decline}</button>
    <button class="consent-button consent-accept" type="button">${websiteAnalytics.marketingOnPage ? analyticsCopy.acceptAll : analyticsCopy.accept}</button>
  </div>
  ${websiteAnalytics.marketingOnPage ? `<button class="consent-choose" type="button" aria-expanded="false">${analyticsCopy.choose}</button>` : ''}`;
document.body.appendChild(consentBanner);

const consentSettingsButton = document.createElement('button');
consentSettingsButton.className = 'consent-settings';
consentSettingsButton.type = 'button';
consentSettingsButton.textContent = analyticsCopy.settings;
document.body.appendChild(consentSettingsButton);

const consentChoices = consentBanner.querySelector('.consent-choices');
const consentChooseButton = consentBanner.querySelector('.consent-choose');

const showConsentBanner = () => {
  consentBanner.hidden = false;
  consentSettingsButton.hidden = true;
  consentBanner.querySelector('.consent-decline').focus();
};

const hideConsentBanner = () => {
  consentBanner.hidden = true;
  consentChoices.hidden = true;
  consentChooseButton?.setAttribute('aria-expanded', 'false');
  if (consentChooseButton) consentChooseButton.hidden = false;
  consentSettingsButton.hidden = false;
  if (mobileLayout.matches && menuButton) menuButton.focus({ preventScroll: true });
  else consentSettingsButton.focus({ preventScroll: true });
};

const applyConsent = (statistics, marketing) => {
  if (statistics) websiteAnalytics.grant();
  else websiteAnalytics.deny();
  if (websiteAnalytics.marketingOnPage) {
    if (marketing) websiteAnalytics.grantMarketing();
    else websiteAnalytics.denyMarketing();
  }
  window.DemenzTeller?.consentChanged();
  window.DemenzWebExperiments?.consentChanged();
  hideConsentBanner();
};

consentBanner.querySelector('.consent-decline').addEventListener('click', () => applyConsent(false, false));
consentBanner.querySelector('.consent-accept').addEventListener('click', () => applyConsent(true, true));
consentChooseButton?.addEventListener('click', () => {
  consentChoices.querySelector('[name="statistics"]').checked = websiteAnalytics.readConsent() === 'granted';
  consentChoices.querySelector('[name="marketing"]').checked = websiteAnalytics.readMarketing() === 'granted';
  consentChoices.hidden = false;
  consentChooseButton.setAttribute('aria-expanded', 'true');
  consentChooseButton.hidden = true;
  consentChoices.querySelector('input').focus();
});
consentBanner.querySelector('.consent-save').addEventListener('click', () => applyConsent(
  consentChoices.querySelector('[name="statistics"]').checked,
  consentChoices.querySelector('[name="marketing"]').checked
));

consentSettingsButton.addEventListener('click', showConsentBanner);

// Für eigene Seiten wie /start/ und die Web-Kasse: dieselbe Einwilligung, nie eigene Banner.
window.DemenzConsent = {
  statistics: () => websiteAnalytics.readConsent() === 'granted',
  marketing: () => websiteAnalytics.marketingOnPage && websiteAnalytics.readMarketing() === 'granted',
  open: showConsentBanner,
  track: websiteAnalytics.track,
  trackMarketing: websiteAnalytics.trackMarketing
};

window.DemenzTeller = createTellerExperiment({
  host: window,
  entry: tellerEntry,
  statistics: () => websiteAnalytics.readConsent() === 'granted',
  track: websiteAnalytics.track
});
if (websiteAnalytics.readConsent() === 'denied') window.DemenzTeller.forget();
window.addEventListener('storage', (event) => {
  if (event.key === 'demenzcoach.analyticsConsent.v1' || event.key === null) {
    websiteAnalytics.clearSessionChoices();
    if (websiteAnalytics.readConsent() !== 'granted') {
      websiteAnalytics.stopStatistics();
      window.DemenzTeller.forget();
    }
    else {
      websiteAnalytics.startStatistics();
      window.DemenzTeller.consentChanged();
    }
  }
});

if (websiteAnalytics.readConsent() === 'granted') websiteAnalytics.loadTag();
if (websiteAnalytics.marketingOnPage && websiteAnalytics.readMarketing() === 'granted') websiteAnalytics.loadPixels();
if (websiteAnalytics.readConsent() === null
  || (websiteAnalytics.marketingOnPage && websiteAnalytics.readMarketing() === null)) {
  showConsentBanner();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;

  if (link.dataset.storeLink) {
    let campaignToken = '';
    try {
      const token = new URL(link.href, window.location.href).searchParams.get('ct') ?? '';
      if (/^[a-zA-Z0-9_-]{1,30}$/.test(token)) campaignToken = token;
    } catch {
      // The stable link source still makes the click measurable if URL parsing is unavailable.
    }
    websiteAnalytics.track('app_store_click', {
      link_source: link.dataset.storeLink,
      campaign_token: campaignToken,
      destination: 'app_store'
    });
  } else if (link.dataset.relatedLink) {
    websiteAnalytics.track('related_guide_click', {
      source_guide: pageContext.page_slug,
      target_guide: link.dataset.relatedLink
    });
  } else if (link.dataset.contentLink) {
    websiteAnalytics.track('select_content', {
      content_type: 'caregiver_guide',
      item_id: link.dataset.contentLink
    });
  } else if (link.getAttribute('href') === '#app-einblicke') {
    websiteAnalytics.track('select_content', { content_type: 'app_preview', item_id: 'website_app_gallery' });
  } else if (link.getAttribute('href') === '#download') {
    websiteAnalytics.track('select_content', { content_type: 'download', item_id: 'website_download_section' });
  } else if (link.matches('a[href^="mailto:"]')) {
    websiteAnalytics.track('support_contact_click');
  }
});

if (pageContext.page_type === 'seo-guide') {
  const reportedDepths = new Set();
  const reportReadDepth = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const depth = Math.round((window.scrollY / scrollable) * 100);
    [50, 90].forEach((milestone) => {
      if (depth < milestone || reportedDepths.has(milestone)) return;
      reportedDepths.add(milestone);
      websiteAnalytics.track('guide_read_depth', { percent_scrolled: milestone });
    });
    if (reportedDepths.size === 2) window.removeEventListener('scroll', reportReadDepth);
  };
  window.addEventListener('scroll', reportReadDepth, { passive: true });
}

// Preserve the existing support form behavior: prepare an email, never send it.
document.querySelectorAll('[data-contact-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const recipient = form.dataset.recipient ?? 'demenzcoachapp@gmail.com';
    const name = String(data.get('name') ?? '').trim();
    const subject = String(data.get('subject') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const nameLine = name ? `Name: ${name}\n\n` : '';
    const body = `${nameLine}${message}`;
    websiteAnalytics.track('support_contact_click', { contact_method: 'prepared_email' });
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
});

const observedSections = [
  'app-einblicke',
  'so-funktionierts',
  'vorteile',
  'sicherheit',
  'fragen',
  'how-it-works',
  'safety',
  'questions'
];
const sectionObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, observer) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        websiteAnalytics.track('section_view', { section_name: entry.target.id });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 })
  : null;

observedSections.forEach((id) => {
  const section = document.getElementById(id);
  if (section) sectionObserver?.observe(section);
});

// Reuse the existing optional German entry cards without rewriting every article.
// If the helper cannot load, their original links still open the normal questionnaire.
(() => {
  if (document.documentElement.lang !== 'de' || window.DemenzSituationContext) return;
  if (location.pathname !== '/de/' && !document.querySelector('.translator-plan-cta a[href], .guide-plan-cta a[href]')) return;
  const script = document.createElement('script');
  script.src = '/start/situation-context.js';
  script.async = true;
  document.head.append(script);
})();

// Shared optional invitation for genuinely read public content; never starts a care request.
import('/abo/content-scroll-signup.js').then(module => module.bootContentScrollSignup()).catch(() => {});
