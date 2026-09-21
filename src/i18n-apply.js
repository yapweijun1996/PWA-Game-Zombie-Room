import { SUPPORTED_LOCALES, LOCALE_NAMES, LOCALE_HTML_LANG, getLocale, setLocale, t } from './i18n.js';

function applyStaticText() {
  document.title = t('appTitle');
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute('content', t('metaDescription'));
  document.documentElement.lang = LOCALE_HTML_LANG[getLocale()] || 'en';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

function populateLanguageSelect(select) {
  select.innerHTML = '';
  for (const locale of SUPPORTED_LOCALES) {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = LOCALE_NAMES[locale];
    select.appendChild(option);
  }
  select.value = getLocale();
}

export function initI18n(onLocaleChange) {
  applyStaticText();
  const select = document.getElementById('languageSelect');
  if (select) {
    populateLanguageSelect(select);
    select.addEventListener('change', () => {
      if (setLocale(select.value)) {
        applyStaticText();
        if (onLocaleChange) onLocaleChange();
      }
    });
  }
}
