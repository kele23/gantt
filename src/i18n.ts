// Import all locale files directly
import de_DE from './locales/de-DE.json';
import en_US from './locales/en-US.json';
import es_ES from './locales/es-ES.json';
import fr_FR from './locales/fr-FR.json';
import it_IT from './locales/it-IT.json';
import { it, enUS as en, fr, es, de } from 'date-fns/locale';
import { Locale } from './types';

// Static map of all available locales
const locales: Record<string, Locale> = {
    en: en_US,
    it: it_IT,
    fr: fr_FR,
    es: es_ES,
    de: de_DE,
};

/**
 * Add custom locales to the available locales
 * @param {Object} customLocales - Object containing custom locale translations
 */
export function addLocales(customLocales: Record<string, Locale>) {
    if (!customLocales) return;

    // Merge custom locales with existing ones
    Object.keys(customLocales).forEach((langCode) => {
        locales[langCode] = customLocales[langCode];
    });
}

export function getDateFnsLocale(locale: string) {
    switch (normalizeLangCode(locale)) {
        case 'en':
            return en;
        case 'it':
            return it;
        case 'fr':
            return fr;
        case 'es':
            return es;
        case 'de':
            return de;
    }

    throw new Error('Invalid locale code');
}

/**
 * Get a translation for a key in the specified language
 * @param {string} key - The translation key
 * @param {string} lang - The language code (defaults to 'en')
 * @param {Record<string, any>} params - Parameters to replace in the translation
 * @returns {string} The translated text or the key if not found
 */
export function translate(
    key: string,
    lang = 'en',
    params: Record<string, any> = {},
) {
    // Get the appropriate locale or fall back to English
    const langCode = normalizeLangCode(lang);
    const locale = locales[langCode] || locales['en'];

    if (!locale) {
        return key;
    }

    let text = locale[key] || key;

    // Replace any parameters in the text
    if (params && Object.keys(params).length > 0) {
        Object.keys(params).forEach((param) => {
            text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });
    }

    return text;
}

/**
 * Alias for translate function for backward compatibility
 */
export function gettext(key: string, lang: string, params = {}) {
    return translate(key, lang, params);
}

/**
 * Normalize language code to find the most appropriate match
 * @param {string} langCode - The language code to normalize
 * @returns {string} The normalized language code
 */
function normalizeLangCode(langCode: string) {
    if (!langCode) return 'en';

    // First check exact match
    if (locales[langCode]) return langCode;

    // Check language part only (e.g., 'en' from 'en-US')
    const mainLang = langCode.split('-')[0];
    if (locales[mainLang]) return mainLang;

    // Check for any variant of the language
    const allKeys = Object.keys(locales);
    for (let i = 0; i < allKeys.length; i++) {
        if (allKeys[i].startsWith(mainLang + '-')) {
            return allKeys[i];
        }
    }

    return 'en';
}

/**
 * Get all available languages
 * @returns {Object} An object with language codes as keys
 */
export function getAvailableLanguages() {
    return Object.keys(locales);
}

export default {
    translate,
    gettext,
    getAvailableLanguages,
    addLocales,
};
