/**
 * MeaningIt voice configuration.
 *
 * This file contains stable voice preferences used to select the best
 * available browser/system speech-synthesis voice.
 *
 * IMPORTANT:
 * Browser voices are NOT guaranteed to exist on every device.
 *
 * Therefore:
 * - Do not treat these IDs as actual installed browser voice IDs.
 * - Runtime voice discovery belongs in `use-speak.tsx`.
 * - This file only defines preferred voice families and matching metadata.
 * - Always provide a browser-default fallback.
 */

export type VoiceGender = "female" | "male" | "neutral";

export type VoicePreference = {
  /**
   * Stable MeaningIt identifier.
   *
   * This is an application-level ID, not necessarily the ID returned by
   * SpeechSynthesisVoice.voiceURI.
   */
  readonly id: string;

  /**
   * Human-readable display name.
   */
  readonly name: string;

  /**
   * Language/locale codes for which this voice preference is suitable.
   */
  readonly languages: readonly string[];

  /**
   * Preferred voice gender when the browser exposes enough information
   * through its voice name.
   */
  readonly gender: VoiceGender;

  /**
   * Keywords used when matching an installed system voice.
   *
   * Matching should be case-insensitive.
   */
  readonly keywords: readonly string[];

  /**
   * Relative priority.
   *
   * Higher values should be preferred when multiple compatible voices
   * are available.
   */
  readonly priority: number;
};

/**
 * ---------------------------------------------------------------------------
 * Voice preferences
 * ---------------------------------------------------------------------------
 *
 * These are preferences, NOT guaranteed installed voices.
 *
 * Keep IDs stable because UI preferences/localStorage may reference them.
 */

export const voicePacks = {
  english: [
    {
      id: "english-female",
      name: "English Female",
      languages: ["en-US", "en-GB", "en-AU", "en-CA", "en-IN"],
      gender: "female",
      keywords: [
        "female",
        "samantha",
        "zira",
        "aria",
        "jenny",
        "susan",
        "google us english",
        "google uk english female",
      ],
      priority: 100,
    },
    {
      id: "english-male",
      name: "English Male",
      languages: ["en-US", "en-GB", "en-AU", "en-CA", "en-IN"],
      gender: "male",
      keywords: [
        "male",
        "david",
        "mark",
        "guy",
        "daniel",
        "alex",
        "google uk english male",
      ],
      priority: 90,
    },
    {
      id: "english-default",
      name: "English",
      languages: ["en-US", "en-GB", "en-AU", "en-CA", "en-IN"],
      gender: "neutral",
      keywords: [
        "english",
        "google english",
        "microsoft",
        "apple",
      ],
      priority: 50,
    },
  ],

  hindi: [
    {
      id: "hindi-female",
      name: "Hindi Female",
      languages: ["hi-IN"],
      gender: "female",
      keywords: [
        "female",
        "hindi",
        "heera",
        "kalpana",
        "google hindi",
        "microsoft hindi",
      ],
      priority: 100,
    },
    {
      id: "hindi-male",
      name: "Hindi Male",
      languages: ["hi-IN"],
      gender: "male",
      keywords: [
        "male",
        "hindi",
        "google hindi",
        "microsoft hindi",
      ],
      priority: 90,
    },
    {
      id: "hindi-default",
      name: "Hindi",
      languages: ["hi-IN"],
      gender: "neutral",
      keywords: ["hindi", "hi-in", "google hindi", "microsoft hindi"],
      priority: 50,
    },
  ],

  bengali: [
    {
      id: "bengali-default",
      name: "Bengali",
      languages: ["bn-BD", "bn-IN"],
      gender: "neutral",
      keywords: ["bengali", "bangla"],
      priority: 80,
    },
  ],

  gujarati: [
    {
      id: "gujarati-default",
      name: "Gujarati",
      languages: ["gu-IN"],
      gender: "neutral",
      keywords: ["gujarati"],
      priority: 80,
    },
  ],

  kannada: [
    {
      id: "kannada-default",
      name: "Kannada",
      languages: ["kn-IN"],
      gender: "neutral",
      keywords: ["kannada"],
      priority: 80,
    },
  ],

  malayalam: [
    {
      id: "malayalam-default",
      name: "Malayalam",
      languages: ["ml-IN"],
      gender: "neutral",
      keywords: ["malayalam"],
      priority: 80,
    },
  ],

  marathi: [
    {
      id: "marathi-default",
      name: "Marathi",
      languages: ["mr-IN"],
      gender: "neutral",
      keywords: ["marathi"],
      priority: 80,
    },
  ],

  punjabi: [
    {
      id: "punjabi-default",
      name: "Punjabi",
      languages: ["pa-IN"],
      gender: "neutral",
      keywords: ["punjabi"],
      priority: 80,
    },
  ],

  tamil: [
    {
      id: "tamil-default",
      name: "Tamil",
      languages: ["ta-IN"],
      gender: "neutral",
      keywords: ["tamil"],
      priority: 80,
    },
  ],

  telugu: [
    {
      id: "telugu-default",
      name: "Telugu",
      languages: ["te-IN"],
      gender: "neutral",
      keywords: ["telugu"],
      priority: 80,
    },
  ],

  urdu: [
    {
      id: "urdu-default",
      name: "Urdu",
      languages: ["ur-PK", "ur-IN"],
      gender: "neutral",
      keywords: ["urdu"],
      priority: 80,
    },
  ],

  arabic: [
    {
      id: "arabic-female",
      name: "Arabic Female",
      languages: ["ar-SA", "ar-AE", "ar-EG"],
      gender: "female",
      keywords: ["arabic", "female"],
      priority: 90,
    },
    {
      id: "arabic-male",
      name: "Arabic Male",
      languages: ["ar-SA", "ar-AE", "ar-EG"],
      gender: "male",
      keywords: ["arabic", "male"],
      priority: 85,
    },
    {
      id: "arabic-default",
      name: "Arabic",
      languages: ["ar-SA", "ar-AE", "ar-EG"],
      gender: "neutral",
      keywords: ["arabic"],
      priority: 70,
    },
  ],

  chinese: [
    {
      id: "chinese-simplified",
      name: "Chinese (Simplified)",
      languages: ["zh-CN"],
      gender: "neutral",
      keywords: ["chinese", "mandarin", "zh-cn", "simplified"],
      priority: 90,
    },
    {
      id: "chinese-traditional",
      name: "Chinese (Traditional)",
      languages: ["zh-TW"],
      gender: "neutral",
      keywords: ["chinese", "mandarin", "zh-tw", "traditional"],
      priority: 90,
    },
  ],

  french: [
    {
      id: "french-default",
      name: "French",
      languages: ["fr-FR", "fr-CA"],
      gender: "neutral",
      keywords: ["french", "français"],
      priority: 80,
    },
  ],

  german: [
    {
      id: "german-default",
      name: "German",
      languages: ["de-DE", "de-AT", "de-CH"],
      gender: "neutral",
      keywords: ["german", "deutsch"],
      priority: 80,
    },
  ],

  italian: [
    {
      id: "italian-default",
      name: "Italian",
      languages: ["it-IT"],
      gender: "neutral",
      keywords: ["italian", "italiano"],
      priority: 80,
    },
  ],

  japanese: [
    {
      id: "japanese-default",
      name: "Japanese",
      languages: ["ja-JP"],
      gender: "neutral",
      keywords: ["japanese", "japan"],
      priority: 80,
    },
  ],

  korean: [
    {
      id: "korean-default",
      name: "Korean",
      languages: ["ko-KR"],
      gender: "neutral",
      keywords: ["korean", "korea"],
      priority: 80,
    },
  ],

  portuguese: [
    {
      id: "portuguese-default",
      name: "Portuguese",
      languages: ["pt-PT", "pt-BR"],
      gender: "neutral",
      keywords: ["portuguese", "português"],
      priority: 80,
    },
  ],

  russian: [
    {
      id: "russian-default",
      name: "Russian",
      languages: ["ru-RU"],
      gender: "neutral",
      keywords: ["russian", "русский"],
      priority: 80,
    },
  ],

  spanish: [
    {
      id: "spanish-default",
      name: "Spanish",
      languages: ["es-ES", "es-MX", "es-US"],
      gender: "neutral",
      keywords: ["spanish", "español"],
      priority: 80,
    },
  ],

  turkish: [
    {
      id: "turkish-default",
      name: "Turkish",
      languages: ["tr-TR"],
      gender: "neutral",
      keywords: ["turkish", "türkçe"],
      priority: 80,
    },
  ],

  vietnamese: [
    {
      id: "vietnamese-default",
      name: "Vietnamese",
      languages: ["vi-VN"],
      gender: "neutral",
      keywords: ["vietnamese", "tiếng việt"],
      priority: 80,
    },
  ],
} as const satisfies Record<string, readonly VoicePreference[]>;

/**
 * All voice preferences in one flat collection.
 */
export const allVoicePacks: readonly VoicePreference[] = Object.freeze(
  Object.values(voicePacks).flat(),
);

/**
 * Get a voice preference by MeaningIt ID.
 */
export function getVoicePackById(
  id: string | null | undefined,
): VoicePreference | undefined {
  if (!id) {
    return undefined;
  }

  const normalizedId = id.trim().toLowerCase();

  if (!normalizedId) {
    return undefined;
  }

  return allVoicePacks.find(
    (voice) => voice.id.toLowerCase() === normalizedId,
  );
}

/**
 * Convert a locale to its base language.
 *
 * Example:
 *   en-US → en
 *   hi-IN → hi
 */
export function getVoiceBaseLanguage(
  languageCode: string | null | undefined,
): string {
  if (!languageCode) {
    return "";
  }

  return languageCode.trim().toLowerCase().split("-")[0];
}

/**
 * Determine whether a voice preference supports a language.
 *
 * Matching is performed using:
 * 1. Exact locale match
 * 2. Base language match
 */
export function voiceSupportsLanguage(
  voice: VoicePreference,
  languageCode: string | null | undefined,
): boolean {
  if (!languageCode) {
    return false;
  }

  const normalizedLanguage = languageCode.trim().toLowerCase();

  if (!normalizedLanguage) {
    return false;
  }

  const baseLanguage = getVoiceBaseLanguage(normalizedLanguage);

  return voice.languages.some((supportedLanguage) => {
    const normalizedSupported = supportedLanguage.toLowerCase();

    return (
      normalizedSupported === normalizedLanguage ||
      getVoiceBaseLanguage(normalizedSupported) === baseLanguage
    );
  });
}

/**
 * Return voice preferences suitable for a language.
 */
export function getVoicePacksForLanguage(
  languageCode: string | null | undefined,
): readonly VoicePreference[] {
  if (!languageCode) {
    return [];
  }

  return allVoicePacks
    .filter((voice) => voiceSupportsLanguage(voice, languageCode))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Return the best MeaningIt voice preference for a language.
 */
export function getPreferredVoicePack(
  languageCode: string | null | undefined,
): VoicePreference | undefined {
  return getVoicePacksForLanguage(languageCode)[0];
}

/**
 * Find a preferred voice by language and gender.
 *
 * Falls back to the best available language preference when the requested
 * gender is unavailable.
 */
export function getPreferredVoiceByGender(
  languageCode: string | null | undefined,
  gender: VoiceGender,
): VoicePreference | undefined {
  const compatibleVoices = getVoicePacksForLanguage(languageCode);

  return (
    compatibleVoices.find((voice) => voice.gender === gender) ??
    compatibleVoices[0]
  );
}

/**
 * Get all voice preferences matching a keyword.
 */
export function searchVoicePacks(
  query: string,
): readonly VoicePreference[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return allVoicePacks;
  }

  return allVoicePacks.filter((voice) => {
    return (
      voice.id.toLowerCase().includes(normalizedQuery) ||
      voice.name.toLowerCase().includes(normalizedQuery) ||
      voice.languages.some((language) =>
        language.toLowerCase().includes(normalizedQuery),
      ) ||
      voice.keywords.some((keyword) =>
        keyword.toLowerCase().includes(normalizedQuery),
      )
    );
  });
}

/**
 * Match an actual browser SpeechSynthesisVoice against a MeaningIt
 * voice preference.
 *
 * This function intentionally accepts a structural object rather than
 * importing browser-specific types, keeping this file usable in environments
 * where DOM globals are not available.
 */
export function scoreBrowserVoice(
  browserVoice: {
    readonly name?: string;
    readonly lang?: string;
    readonly voiceURI?: string;
  },
  preference: VoicePreference,
): number {
  const name = browserVoice.name?.toLowerCase() ?? "";
  const lang = browserVoice.lang?.toLowerCase() ?? "";
  const voiceURI = browserVoice.voiceURI?.toLowerCase() ?? "";

  let score = preference.priority;

  /**
   * Exact locale match is stronger than base-language matching.
   */
  if (
    preference.languages.some(
      (supportedLanguage) =>
        supportedLanguage.toLowerCase() === lang,
    )
  ) {
    score += 100;
  } else if (
    preference.languages.some(
      (supportedLanguage) =>
        getVoiceBaseLanguage(supportedLanguage) ===
        getVoiceBaseLanguage(lang),
    )
  ) {
    score += 50;
  } else {
    return 0;
  }

  /**
   * Keyword matching helps select a more appropriate system voice.
   */
  for (const keyword of preference.keywords) {
    const normalizedKeyword = keyword.toLowerCase();

    if (name.includes(normalizedKeyword)) {
      score += 25;
    }

    if (voiceURI.includes(normalizedKeyword)) {
      score += 10;
    }
  }

  /**
   * Prefer voices that explicitly advertise the requested language.
   */
  if (lang === "en-us" && preference.languages.includes("en-US")) {
    score += 5;
  }

  return score;
}

/**
 * Find the highest-scoring browser voice for a MeaningIt preference.
 *
 * Returns undefined if no compatible voice exists.
 */
export function findBestBrowserVoice<T extends {
  readonly name?: string;
  readonly lang?: string;
  readonly voiceURI?: string;
}>(
  browserVoices: readonly T[],
  preference: VoicePreference,
): T | undefined {
  let bestVoice: T | undefined;
  let bestScore = 0;

  for (const browserVoice of browserVoices) {
    const score = scoreBrowserVoice(browserVoice, preference);

    if (score > bestScore) {
      bestScore = score;
      bestVoice = browserVoice;
    }
  }

  return bestVoice;
}

/**
 * Find the best available browser voice for a language.
 *
 * Preferences are evaluated from highest priority to lowest priority.
 */
export function findBestVoiceForLanguage<T extends {
  readonly name?: string;
  readonly lang?: string;
  readonly voiceURI?: string;
}>(
  browserVoices: readonly T[],
  languageCode: string | null | undefined,
): T | undefined {
  const preferences = getVoicePacksForLanguage(languageCode);

  if (preferences.length === 0 || browserVoices.length === 0) {
    return undefined;
  }

  let bestVoice: T | undefined;
  let bestScore = 0;

  for (const browserVoice of browserVoices) {
    for (const preference of preferences) {
      const score = scoreBrowserVoice(browserVoice, preference);

      if (score > bestScore) {
        bestScore = score;
        bestVoice = browserVoice;
      }
    }
  }

  return bestVoice;
}