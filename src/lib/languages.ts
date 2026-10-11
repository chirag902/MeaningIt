/**
 * MeaningIt language registry.
 *
 * This file is the single source of truth for language metadata used by:
 * - Text translation
 * - Voice input
 * - Text-to-speech
 * - Image/OCR translation
 * - Language selectors
 * - Language detection
 *
 * Keep this file dependency-free and deterministic.
 */

export const AUTO_DETECT_LANGUAGE_CODE = "auto" as const;

export const DEFAULT_LANGUAGE_CODE = "en-US" as const;



export type Language = {
  readonly name: string;
  readonly code: string;
};

/**
 * Supported languages.
 *
 * Locale-style BCP 47 codes are intentionally used because they work well
 * with browser speech recognition and speech synthesis APIs.
 *
 * `auto` is reserved for source-language detection and should not normally
 * be used as a target language.
 */
export const languages = [
  { name: "Auto-detect", code: "auto" },
  { name: "Afrikaans", code: "af-ZA" },
  { name: "Albanian", code: "sq-AL" },
  { name: "Amharic", code: "am-ET" },
  { name: "Arabic", code: "ar-SA" },
  { name: "Armenian", code: "hy-AM" },
  { name: "Azerbaijani", code: "az-AZ" },
  { name: "Basque", code: "eu-ES" },
  { name: "Belarusian", code: "be-BY" },
  { name: "Bengali", code: "bn-BD" },
  { name: "Bosnian", code: "bs-BA" },
  { name: "Bulgarian", code: "bg-BG" },
  { name: "Catalan", code: "ca-ES" },
  { name: "Cebuano", code: "ceb-PH" },
  { name: "Chinese (Simplified)", code: "zh-CN" },
  { name: "Chinese (Traditional)", code: "zh-TW" },
  { name: "Corsican", code: "co-FR" },
  { name: "Croatian", code: "hr-HR" },
  { name: "Czech", code: "cs-CZ" },
  { name: "Danish", code: "da-DK" },
  { name: "Dutch", code: "nl-NL" },
  { name: "English", code: "en-US" },
  { name: "Esperanto", code: "eo-UY" },
  { name: "Estonian", code: "et-EE" },
  { name: "Finnish", code: "fi-FI" },
  { name: "French", code: "fr-FR" },
  { name: "Frisian", code: "fy-NL" },
  { name: "Galician", code: "gl-ES" },
  { name: "Georgian", code: "ka-GE" },
  { name: "German", code: "de-DE" },
  { name: "Greek", code: "el-GR" },
  { name: "Gujarati", code: "gu-IN" },
  { name: "Haitian Creole", code: "ht-HT" },
  { name: "Hausa", code: "ha-NG" },
  { name: "Hawaiian", code: "haw-US" },
  { name: "Hebrew", code: "he-IL" },
  { name: "Hindi", code: "hi-IN" },
  { name: "Hmong", code: "hmn-CN" },
  { name: "Hungarian", code: "hu-HU" },
  { name: "Icelandic", code: "is-IS" },
  { name: "Igbo", code: "ig-NG" },
  { name: "Indonesian", code: "id-ID" },
  { name: "Irish", code: "ga-IE" },
  { name: "Italian", code: "it-IT" },
  { name: "Japanese", code: "ja-JP" },
  { name: "Javanese", code: "jv-ID" },
  { name: "Kannada", code: "kn-IN" },
  { name: "Kazakh", code: "kk-KZ" },
  { name: "Khmer", code: "km-KH" },
  { name: "Kinyarwanda", code: "rw-RW" },
  { name: "Korean", code: "ko-KR" },
  { name: "Kurdish", code: "ku-TR" },
  { name: "Kyrgyz", code: "ky-KG" },
  { name: "Lao", code: "lo-LA" },
  { name: "Latin", code: "la-VA" },
  { name: "Latvian", code: "lv-LV" },
  { name: "Lithuanian", code: "lt-LT" },
  { name: "Luxembourgish", code: "lb-LU" },
  { name: "Macedonian", code: "mk-MK" },
  { name: "Malagasy", code: "mg-MG" },
  { name: "Malay", code: "ms-MY" },
  { name: "Malayalam", code: "ml-IN" },
  { name: "Maltese", code: "mt-MT" },
  { name: "Maori", code: "mi-NZ" },
  { name: "Marathi", code: "mr-IN" },
  { name: "Mongolian", code: "mn-MN" },
  { name: "Myanmar (Burmese)", code: "my-MM" },
  { name: "Nepali", code: "ne-NP" },
  { name: "Norwegian", code: "no-NO" },
  { name: "Nyanja (Chichewa)", code: "ny-MW" },
  { name: "Odia (Oriya)", code: "or-IN" },
  { name: "Pashto", code: "ps-AF" },
  { name: "Persian", code: "fa-IR" },
  { name: "Polish", code: "pl-PL" },
  { name: "Portuguese", code: "pt-PT" },
  { name: "Punjabi", code: "pa-IN" },
  { name: "Romanian", code: "ro-RO" },
  { name: "Russian", code: "ru-RU" },
  { name: "Samoan", code: "sm-WS" },
  { name: "Scots Gaelic", code: "gd-GB" },
  { name: "Serbian", code: "sr-RS" },
  { name: "Sesotho", code: "st-LS" },
  { name: "Shona", code: "sn-ZW" },
  { name: "Sindhi", code: "sd-PK" },
  { name: "Sinhala (Sinhalese)", code: "si-LK" },
  { name: "Slovak", code: "sk-SK" },
  { name: "Slovenian", code: "sl-SI" },
  { name: "Somali", code: "so-SO" },
  { name: "Spanish", code: "es-ES" },
  { name: "Sundanese", code: "su-ID" },
  { name: "Swahili", code: "sw-KE" },
  { name: "Swedish", code: "sv-SE" },
  { name: "Tagalog (Filipino)", code: "tl-PH" },
  { name: "Tajik", code: "tg-TJ" },
  { name: "Tamil", code: "ta-IN" },
  { name: "Tatar", code: "tt-RU" },
  { name: "Telugu", code: "te-IN" },
  { name: "Thai", code: "th-TH" },
  { name: "Turkish", code: "tr-TR" },
  { name: "Turkmen", code: "tk-TM" },
  { name: "Ukrainian", code: "uk-UA" },
  { name: "Urdu", code: "ur-PK" },
  { name: "Uyghur", code: "ug-CN" },
  { name: "Uzbek", code: "uz-UZ" },
  { name: "Vietnamese", code: "vi-VN" },
  { name: "Welsh", code: "cy-GB" },
  { name: "Xhosa", code: "xh-ZA" },
  { name: "Yiddish", code: "yi-DE" },
  { name: "Yoruba", code: "yo-NG" },
  { name: "Zulu", code: "zu-ZA" },
] as const satisfies readonly Language[];
export type LanguageCode = (typeof languages)[number]["code"];

/**
 * Languages that can be selected as translation targets.
 *
 * Auto-detect is intentionally excluded because detecting a target language
 * does not make semantic sense.
 */
export const targetLanguages = languages.filter(
  (language) => language.code !== AUTO_DETECT_LANGUAGE_CODE,
);

/**
 * Find a language by its locale code.
 *
 * Returns undefined when the code is unknown.
 */
export function getLanguageByCode(
  code: string | null | undefined,
): Language | undefined {
  if (!code) {
    return undefined;
  }

  const normalizedCode = code.trim().toLowerCase();

  if (!normalizedCode) {
    return undefined;
  }

  return languages.find(
    (language) => language.code.toLowerCase() === normalizedCode,
  );
}

/**
 * Get a language's display name.
 *
 * Falls back to the supplied code instead of throwing.
 */
export function getLanguageName(
  code: string | null | undefined,
): string {
  if (!code) {
    return "Unknown language";
  }

  return getLanguageByCode(code)?.name ?? code;
}

/**
 * Check whether a language code is supported by MeaningIt.
 */
export function isSupportedLanguage(
  code: string | null | undefined,
): code is LanguageCode {
  if (!code) {
    return false;
  }

  const normalizedCode = code.trim().toLowerCase();

  return languages.some(
    (language) => language.code.toLowerCase() === normalizedCode,
  );
}

/**
 * Check whether a language can be used as a translation target.
 */
export function isSupportedTargetLanguage(
  code: string | null | undefined,
): boolean {
  if (!code) {
    return false;
  }

  const normalizedCode = code.trim().toLowerCase();

  return targetLanguages.some(
    (language) => language.code.toLowerCase() === normalizedCode,
  );
}

/**
 * Convert a locale such as `en-US` into its base language such as `en`.
 *
 * Useful for browser SpeechRecognition / SpeechSynthesis voice matching.
 */
export function getBaseLanguageCode(
  code: string | null | undefined,
): string {
  if (!code) {
    return "";
  }

  return code.trim().toLowerCase().split("-")[0];
}

/**
 * Find a language using either an exact locale or its base language.
 *
 * Example:
 *   `en-US` → English
 *   `en`    → English
 *   `hi-IN` → Hindi
 *   `hi`    → Hindi
 */
export function findLanguageByLocale(
  code: string | null | undefined,
): Language | undefined {
  if (!code) {
    return undefined;
  }

  const normalizedCode = code.trim().toLowerCase();

  if (!normalizedCode) {
    return undefined;
  }

  const exactMatch = languages.find(
    (language) => language.code.toLowerCase() === normalizedCode,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const baseCode = getBaseLanguageCode(normalizedCode);

  if (!baseCode) {
    return undefined;
  }

  return languages.find(
    (language) => getBaseLanguageCode(language.code) === baseCode,
  );
}

/**
 * Return the default source language.
 *
 * Kept as a function so callers do not need to know the internal fallback.
 */
export function getDefaultLanguage(): Language {
  return (
    getLanguageByCode(DEFAULT_LANGUAGE_CODE) ??
    languages.find(
      (language) => language.code !== AUTO_DETECT_LANGUAGE_CODE,
    )!
  );
}

/**
 * Return the default target language.
 */
export function getDefaultTargetLanguage(): Language {
  return getDefaultLanguage();
}

/**
 * Return all languages matching a search query.
 *
 * Searches both the human-readable name and locale code.
 */
export function searchLanguages(query: string): readonly Language[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return languages;
  }

  return languages.filter(
    (language) =>
      language.name.toLowerCase().includes(normalizedQuery) ||
      language.code.toLowerCase().includes(normalizedQuery),
  );
}

/**
 * Convert a language code to a safe value for APIs that accept either
 * locale-style codes or base language codes.
 *
 * Example:
 *   `en-US` → `en`
 *   `hi-IN` → `hi`
 *   `zh-CN` → `zh`
 */
export function toBaseLanguageCode(
  code: string | null | undefined,
): string {
  return getBaseLanguageCode(code);
}