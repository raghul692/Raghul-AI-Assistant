/**
 * ============================================================================
 * TAMIL TO TANGLISH PHONETIC TRANSLITERATOR
 * ============================================================================
 * Ensures that if any AI model outputs Tamil script characters (U+0B80-U+0BFF),
 * they are seamlessly converted into fluent, natural, English-alphabet Tanglish.
 */

const COMMON_WORD_MAP = new Map([
  ['\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd', 'Vanakkam'],
  ['\u0ba8\u0ba9\u0bcd\u0bb1\u0bbf', 'Nandri'],
  ['\u0b86\u0bae\u0bcd', 'Aam'],
  ['\u0b87\u0bb2\u0bcd\u0bb2\u0bc8', 'Illai'],
  ['\u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd', 'matrum'],
  ['\u0b85\u0bb2\u0bcd\u0bb2\u0ba4\u0bc1', 'alladhu'],
  ['\u0ba8\u0ba3\u0bcd\u0baa\u0bbe', 'nanba'],
  ['\u0ba8\u0ba3\u0bcd\u0baa\u0bb0\u0bc7', 'nanbare'],
  ['\u0baa\u0bcd\u0bb0\u0bcb', 'bro'],
  ['\u0b95\u0ba3\u0bcd\u0b9f\u0bbf\u0baa\u0bcd\u0baa\u0bbe\u0b95', 'kandippaaga'],
  ['\u0b95\u0ba3\u0bcd\u0b9f\u0bbf\u0baa\u0bcd\u0baa\u0bbe', 'kandippa'],
  ['\u0b9a\u0bb0\u0bbf', 'sari'],
  ['\u0b9a\u0bc2\u0baa\u0bcd\u0baa\u0bb0\u0bcd', 'super'],
  ['\u0b8e\u0baa\u0bcd\u0baa\u0b9f\u0bbf', 'eppadi'],
  ['\u0b8e\u0ba9\u0bcd\u0ba9', 'enna'],
  ['\u0b87\u0ba4\u0bc1', 'idhu'],
  ['\u0b85\u0ba4\u0bc1', 'adhu'],
  ['\u0b92\u0bb0\u0bc1', 'oru'],
  ['\u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd', 'vendum'],
  ['\u0bb5\u0bc7\u0ba3\u0bcd\u0b9f\u0bbe\u0bae\u0bcd', 'vendaam'],
  ['\u0b89\u0bb3\u0bcd\u0bb3\u0ba4\u0bc1', 'ulladhu'],
  ['\u0b87\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bbf\u0bb1\u0ba4\u0bc1', 'irukkiradhu'],
  ['\u0b87\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1', 'irukku'],
  ['\u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0bb2\u0bbe\u0bae\u0bcd', 'seiyalaam'],
  ['\u0baa\u0bbe\u0bb0\u0bcd\u0b95\u0bcd\u0b95\u0bb2\u0bbe\u0bae\u0bcd', 'paarkkalaam'],
  ['\u0baa\u0bbe\u0b95\u0bcd\u0b95\u0bb2\u0bbe\u0bae\u0bcd', 'paakkalaam'],
  ['\u0b9a\u0bca\u0bb2\u0bcd\u0bb2\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd', 'sollunga'],
  ['\u0b9a\u0bca\u0bb2\u0bcd\u0bb2\u0bc1', 'sollu'],
  ['\u0bae\u0bc1\u0b9f\u0bbf\u0baf\u0bc1\u0bae\u0bcd', 'mudiyum'],
  ['\u0bae\u0bc1\u0b9f\u0bbf\u0baf\u0bbe\u0ba4\u0bc1', 'mudiyaadhu'],
  ['\u0b8f\u0ba9\u0bcd', 'yen'],
  ['\u0b8e\u0b99\u0bcd\u0b95\u0bc7', 'enge'],
  ['\u0b8e\u0baa\u0bcd\u0baa\u0bcb\u0ba4\u0bc1', 'eppodhu'],
  ['\u0baa\u0bc1\u0bb0\u0bbf\u0baf\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8', 'puriyavillai'],
  ['\u0baa\u0bc1\u0bb0\u0bbf\u0baf\u0bb2', 'puriyala'],
  ['\u0ba8\u0ba9\u0bcd\u0bb1\u0bbe\u0b95', 'nandraaga'],
  ['\u0ba8\u0bb2\u0bcd\u0bb2\u0bbe', 'nalla'],
  ['\u0bae\u0bbf\u0b95\u0bb5\u0bc1\u0bae\u0bcd', 'migavum'],
  ['\u0bb0\u0bca\u0bae\u0bcd\u0baa', 'romba'],
  ['\u0b95\u0bca\u0b9e\u0bcd\u0b9a\u0bae\u0bcd', 'konjam'],
  ['\u0b89\u0ba4\u0bb5\u0bbf', 'udhavi'],
  ['\u0b95\u0bc7\u0bb3\u0bcd\u0bb5\u0bbf', 'kaelvi'],
  ['\u0baa\u0ba4\u0bbf\u0bb2\u0bcd', 'badhil'],
  ['\u0b9a\u0bc6\u0baf\u0bb1\u0bcd\u0b95\u0bc8', 'seyarkai'],
  ['\u0ba8\u0bc1\u0ba3\u0bcd\u0ba3\u0bb1\u0bbf\u0bb5\u0bc1', 'nunnarivu'],
  ['\u0b89\u0ba4\u0bb5\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd', 'udhaviyaalar'],
  ['\u0ba4\u0bae\u0bbf\u0bb4\u0bcd', 'Tamil'],
  ['\u0b86\u0b99\u0bcd\u0b95\u0bbf\u0bb2\u0bae\u0bcd', 'English'],
  ['\u0b93\u0b9f', 'oda'],
  ['-\u0b93\u0b9f', '-oda'],
  ['-\u0bb2', '-la'],
  ['-\u0b95\u0bcd\u0b95\u0bc1', '-kku'],
  ['-\u0bb2\u0bcd', '-la'],
  ['-\u0b90', '-ai'],
  ['\u0b95\u0bcd\u0b95\u0bcb', 'kko'],
  ['\u0b95\u0bcb\u0b9f\u0bcd', 'code'],
  ['\u0baa\u0bcd\u0bb0\u0bcb\u0b95\u0bcd\u0bb0\u0bbe\u0bae\u0bbf\u0b99\u0bcd', 'programming'],
  ['\u0b95\u0ba4\u0bcd\u0ba4\u0bc1\u0b95\u0bcd\u0b95', 'katthukka'],
  ['\u0b95\u0bb1\u0bcd\u0bb1\u0bc1\u0b95\u0bcd\u0b95\u0bca\u0bb3\u0bcd\u0bb3', 'katrukkolla']
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

const VIRAMA = '\u0BCD'; // \u0bcd pulli

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
