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
    /* Vorschau: kein Analytics */
  };

  const gtag = function () {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  };

  const loadTag = () => {
    if (tagLoaded) return;
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

  const grant = () => {
    remember(consentKey, 'granted');
    loadTag();
  };

  const deny = () => {
    remember(consentKey, 'denied');
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
    if (readConsent() !== 'granted') return;
    loadTag();
    gtag('event', name, { ...pageContext, ...parameters });
  };

  // Werbe-Ereignisse (z. B. Lead, InitiateCheckout, Purchase): nur feste Namen und Zahlen, nie Texte.
  const metaStandard = new Set(['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Subscribe', 'StartTrial']);
  const trackMarketing = (name, parameters = {}) => {
    if (!marketingOnPage || readMarketing() !== 'granted') return;
    loadPixels();
    window.fbq?.(metaStandard.has(name) ? 'track' : 'trackCustom', name, parameters);
    window.ttq?.track?.(name === 'Purchase' ? 'CompletePayment' : name, parameters);
  };

  return { deny, denyMarketing, grant, grantMarketing, loadPixels, loadTag, marketingOnPage, readConsent, readMarketing, track, trackMarketing };
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
const consentText = websiteAnalytics.marketingOnPage
  ? analyticsCopy.marketingText
  : /Google/.test(analyticsCopy.text) ? analyticsCopy.text : `${analyticsCopy.text} (Google Analytics)`;
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
