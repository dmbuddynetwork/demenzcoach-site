const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.querySelector('.sr-only').textContent = isOpen ? 'Menü schließen' : 'Menü öffnen';
});

navigation?.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  navigation.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
});

const websiteAnalytics = (() => {
  const measurementID = 'G-5NRN1EMJDC';
  const consentKey = 'demenzcoach.analyticsConsent.v1';
  let tagLoaded = false;

  const readConsent = () => {
    try {
      return window.localStorage.getItem(consentKey);
    } catch {
      return null;
    }
  };

  const storeConsent = (value) => {
    try {
      window.localStorage.setItem(consentKey, value);
    } catch {
      // The choice still applies for the current page when storage is unavailable.
    }
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
      allow_ad_personalization_signals: false
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementID}`;
    document.head.appendChild(script);
  };

  const clearAnalyticsCookies = () => {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (!name.startsWith('_ga')) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}; SameSite=Lax`;
    });
  };

  const grant = () => {
    storeConsent('granted');
    loadTag();
  };

  const deny = () => {
    storeConsent('denied');
    if (tagLoaded) {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    clearAnalyticsCookies();
  };

  const track = (name, parameters = {}) => {
    if (readConsent() !== 'granted') return;
    loadTag();
    gtag('event', name, parameters);
  };

  return { deny, grant, loadTag, readConsent, track };
})();

const analyticsCopy = document.documentElement.lang === 'en'
  ? {
      title: 'Your privacy choice',
      text: 'With your permission, Google Analytics helps us understand which pages and app information are useful. No advertising, health information or form content is collected.',
      decline: 'Necessary only',
      accept: 'Allow analytics',
      privacy: 'Privacy policy',
      settings: 'Privacy settings'
    }
  : {
      title: 'Deine Datenschutzwahl',
      text: 'Mit deiner Einwilligung hilft uns Google Analytics zu verstehen, welche Seiten und App-Informationen hilfreich sind. Wir erfassen keine Werbung, Gesundheitsdaten oder Formulareingaben.',
      decline: 'Nur notwendige',
      accept: 'Analyse erlauben',
      privacy: 'Datenschutzerklärung',
      settings: 'Datenschutz-Einstellungen'
    };

const consentBanner = document.createElement('section');
consentBanner.className = 'consent-banner';
consentBanner.hidden = true;
consentBanner.setAttribute('role', 'dialog');
consentBanner.setAttribute('aria-modal', 'true');
consentBanner.setAttribute('aria-labelledby', 'consent-title');
consentBanner.innerHTML = `
  <div class="consent-copy">
    <strong id="consent-title">${analyticsCopy.title}</strong>
    <p>${analyticsCopy.text} <a href="${document.documentElement.lang === 'en' ? 'privacy-en.html' : 'datenschutz.html'}">${analyticsCopy.privacy}</a></p>
  </div>
  <div class="consent-actions">
    <button class="consent-button consent-decline" type="button">${analyticsCopy.decline}</button>
    <button class="consent-button consent-accept" type="button">${analyticsCopy.accept}</button>
  </div>`;
document.body.appendChild(consentBanner);

const consentSettingsButton = document.createElement('button');
consentSettingsButton.className = 'consent-settings';
consentSettingsButton.type = 'button';
consentSettingsButton.textContent = analyticsCopy.settings;
document.body.appendChild(consentSettingsButton);

const showConsentBanner = () => {
  consentBanner.hidden = false;
  consentSettingsButton.hidden = true;
  consentBanner.querySelector('.consent-decline').focus();
};

const hideConsentBanner = () => {
  consentBanner.hidden = true;
  consentSettingsButton.hidden = false;
  consentSettingsButton.focus();
};

consentBanner.querySelector('.consent-decline').addEventListener('click', () => {
  websiteAnalytics.deny();
  hideConsentBanner();
});

consentBanner.querySelector('.consent-accept').addEventListener('click', () => {
  websiteAnalytics.grant();
  hideConsentBanner();
});

consentSettingsButton.addEventListener('click', showConsentBanner);

if (websiteAnalytics.readConsent() === 'granted') {
  websiteAnalytics.loadTag();
} else if (websiteAnalytics.readConsent() === null) {
  showConsentBanner();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;

  if (link.getAttribute('href') === '#app-einblicke') {
    websiteAnalytics.track('select_content', { content_type: 'app_preview', item_id: 'website_app_gallery' });
  } else if (link.getAttribute('href') === '#download') {
    websiteAnalytics.track('select_content', { content_type: 'download', item_id: 'website_download_section' });
  } else if (link.matches('a[href^="mailto:"]')) {
    websiteAnalytics.track('support_contact_click');
  }
});

const observedSections = ['app-einblicke', 'so-funktionierts', 'sicherheit', 'fragen'];
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
