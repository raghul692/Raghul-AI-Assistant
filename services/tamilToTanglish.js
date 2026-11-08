/**
 * ============================================================================
 * TAMIL TO TANGLISH PHONETIC TRANSLITERATOR
 * ============================================================================
 * Ensures that if any AI model outputs Tamil script characters (U+0B80-U+0BFF),
 * they are seamlessly converted into fluent, natural, English-alphabet Tanglish.
 */

const COMMON_WORD_MAP = new Map([
  ['வணக்கம்', 'Vanakkam'],
  ['நன்றி', 'Nandri'],
  ['ஆம்', 'Aam'],
  ['இல்லை', 'Illai'],
  ['மற்றும்', 'matrum'],
  ['அல்லது', 'alladhu'],
  ['நண்பா', 'nanba'],
  ['நண்பரே', 'nanbare'],
  ['ப்ரோ', 'bro'],
  ['கண்டிப்பாக', 'kandippaaga'],
  ['கண்டிப்பா', 'kandippa'],
  ['சரி', 'sari'],
  ['சூப்பர்', 'super'],
  ['எப்படி', 'eppadi'],
  ['என்ன', 'enna'],
  ['இது', 'idhu'],
  ['அது', 'adhu'],
  ['ஒரு', 'oru'],
  ['வேண்டும்', 'vendum'],
  ['வேண்டாம்', 'vendaam'],
  ['உள்ளது', 'ulladhu'],
  ['இருக்கிறது', 'irukkiradhu'],
  ['இருக்கு', 'irukku'],
  ['செய்யலாம்', 'seiyalaam'],
  ['பார்க்கலாம்', 'paarkkalaam'],
  ['பாக்கலாம்', 'paakkalaam'],
  ['சொல்லுங்கள்', 'sollunga'],
  ['சொல்லு', 'sollu'],
  ['முடியும்', 'mudiyum'],
  ['முடியாது', 'mudiyaadhu'],
  ['ஏன்', 'yen'],
  ['எங்கே', 'enge'],
  ['எப்போது', 'eppodhu'],
  ['புரியவில்லை', 'puriyavillai'],
  ['புரியல', 'puriyala'],
  ['நன்றாக', 'nandraaga'],
  ['நல்லா', 'nalla'],
  ['மிகவும்', 'migavum'],
  ['ரொம்ப', 'romba'],
  ['கொஞ்சம்', 'konjam'],
  ['உதவி', 'udhavi'],
  ['கேள்வி', 'kaelvi'],
  ['பதில்', 'badhil'],
  ['செயற்கை', 'seyarkai'],
  ['நுண்ணறிவு', 'nunnarivu'],
  ['உதவியாளர்', 'udhaviyaalar'],
  ['தமிழ்', 'Tamil'],
  ['ஆங்கிலம்', 'English'],
  ['ஓட', 'oda'],
  ['-ஓட', '-oda'],
  ['-ல', '-la'],
  ['-க்கு', '-kku'],
  ['-ல்', '-la'],
  ['-ஐ', '-ai'],
  ['க்கோ', 'kko'],
  ['கோட்', 'code'],
  ['ப்ரோக்ராமிங்', 'programming'],
  ['கத்துக்க', 'katthukka'],
  ['கற்றுக்கொள்ள', 'katrukkolla']
]);

// Tamil Unicode character tables
const INDEPENDENT_VOWELS = {
  '\u0B85': 'a',
  '\u0B86': 'aa',
  '\u0B87': 'i',
  '\u0B88': 'ee',
  '\u0B89': 'u',
  '\u0B8A': 'oo',
  '\u0B8E': 'e',
  '\u0B8F': 'ae',
  '\u0B90': 'ai',
  '\u0B92': 'o',
  '\u0B93': 'oa',
  '\u0B94': 'au'
};

const CONSONANTS = {
  '\u0B95': 'k',
  '\u0B99': 'ng',
  '\u0B9A': 'ch',
  '\u0B9C': 'j',
  '\u0B9E': 'nj',
  '\u0B9F': 't',
  '\u0BA3': 'n',
  '\u0BA4': 'th',
  '\u0BA8': 'n',
  '\u0BA9': 'n',
  '\u0BAA': 'p',
  '\u0BAE': 'm',
  '\u0BAF': 'y',
  '\u0BB0': 'r',
  '\u0BB1': 'r',
  '\u0BB2': 'l',
  '\u0BB3': 'l',
  '\u0BB4': 'zh',
  '\u0BB5': 'v',
  '\u0BB6': 'sh',
  '\u0BB7': 'sh',
  '\u0BB8': 's',
  '\u0BB9': 'h'
};

const VOWEL_SIGNS = {
  '\u0BBE': 'aa',
  '\u0BBF': 'i',
  '\u0BC0': 'ee',
  '\u0BC1': 'u',
  '\u0BC2': 'oo',
  '\u0BC6': 'e',
  '\u0BC7': 'ae',
  '\u0BC8': 'ai',
  '\u0BCA': 'o',
  '\u0BCB': 'oa',
  '\u0BCC': 'au'
};

const VIRAMA = '\u0BCD'; // ் pulli

/**
 * Transliterates a Tamil word/syllable into phonetic Tanglish
 */
function transliterateTamilWord(word) {
  let result = '';
  let i = 0;
  const len = word.length;

  while (i < len) {
    const char = word[i];

    // Check independent vowel
    if (INDEPENDENT_VOWELS[char]) {
      result += INDEPENDENT_VOWELS[char];
      i++;
      continue;
    }

    // Check Aytham
    if (char === '\u0B83') {
      result += 'kh';
      i++;
      continue;
    }

    // Check consonant
    if (CONSONANTS[char]) {
      const consonantBase = CONSONANTS[char];
      const nextChar = i + 1 < len ? word[i + 1] : null;

      if (nextChar === VIRAMA) {
        // Pure consonant without vowel
        result += consonantBase;
        i += 2;
        continue;
      } else if (nextChar && VOWEL_SIGNS[nextChar]) {
        // Consonant with dependent vowel sign
        result += consonantBase + VOWEL_SIGNS[nextChar];
        i += 2;
        continue;
      } else {
        // Consonant with inherent 'a'
        result += consonantBase + 'a';
        i++;
        continue;
      }
    }

    // Non-Tamil or miscellaneous marks
    if (VOWEL_SIGNS[char]) {
      result += VOWEL_SIGNS[char];
    } else if (char !== VIRAMA) {
      result += char;
    }
    i++;
  }

  // Refine phonetic conventions (e.g. intervocalic k -> g, p -> b, th -> d when natural)
  return result
    .replace(/thth/g, 'tth')
    .replace(/chch/g, 'cch');
}

/**
 * Converts any text containing Tamil script into fluent Tanglish
 * @param {string} text
 * @returns {string} Transliterated text (zero Tamil Unicode characters)
 */
export function ensureEnglishOrTanglish(text) {
  if (!text || typeof text !== 'string') return text;
  if (!/[\u0B80-\u0BFF]/.test(text)) return text; // Already pure English / Tanglish

  let processed = text;

  // 1. Common phrase / word dictionary replacement
  for (const [tamilWord, tanglish] of COMMON_WORD_MAP.entries()) {
    if (processed.includes(tamilWord)) {
      processed = processed.replaceAll(tamilWord, tanglish);
    }
  }

  // 2. Character-by-character regex transliteration for remaining Tamil blocks
  processed = processed.replace(/[\u0B80-\u0BFF]+/g, (match) => {
    return transliterateTamilWord(match);
  });

  return processed;
}

export default {
  ensureEnglishOrTanglish
};
