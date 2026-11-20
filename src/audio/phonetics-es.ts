/** Spanish (Castilian) grapheme-to-phoneme rules, phoneme classes and phoneme->viseme mapping.
 * Spanish orthography is close to phonemic, so a rule set covers the language well (no dictionary needed). */
export type PhClass = 'vowel' | 'semivowel' | 'nasal' | 'liquid' | 'voicedStop' | 'stop' | 'fricative' | 'affricate' | 'sil';
export const PHONEME_CLASS: Record<string, PhClass> = {
  a: 'vowel', e: 'vowel', i: 'vowel', o: 'vowel', u: 'vowel', j: 'semivowel', w: 'semivowel',
  m: 'nasal', n: 'nasal', J: 'nasal', l: 'liquid', L: 'liquid', r: 'liquid', rr: 'liquid',
  b: 'voicedStop', d: 'voicedStop', g: 'voicedStop', jj: 'voicedStop', p: 'stop', t: 'stop', k: 'stop',
  f: 'fricative', s: 'fricative', T: 'fricative', x: 'fricative', tS: 'affricate', sil: 'sil'
};
export const PHONEME_VISEME: Record<string, string> = {
  a: 'A', e: 'E', i: 'I', j: 'I', o: 'O', u: 'U', w: 'U',
  p: 'MBP', b: 'MBP', m: 'MBP', f: 'FV',
  t: 'TD', d: 'TD', n: 'TD', T: 'TD', J: 'TD', l: 'L', L: 'CH',
  s: 'S', tS: 'CH', jj: 'CH', k: 'KG', g: 'KG', x: 'KG', r: 'R', rr: 'R', sil: 'sil'
};
/** Typical durations (s) used as priors by the aligner and for estimates without audio. */
export const PH_DURATION: Record<PhClass, number> = { vowel: 0.085, semivowel: 0.05, nasal: 0.06, liquid: 0.055, voicedStop: 0.05, stop: 0.06, fricative: 0.09, affricate: 0.1, sil: 0.12 };

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999999) return String(n);
  if (n < 30) return UNITS[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' y ' + UNITS[n % 10] : '');
  if (n === 100) return 'cien';
  if (n < 1000) return HUNDREDS[Math.floor(n / 100)] + (n % 100 ? ' ' + numberToWords(n % 100) : '');
  const th = Math.floor(n / 1000), rest = n % 1000;
  return (th === 1 ? 'mil' : numberToWords(th) + ' mil') + (rest ? ' ' + numberToWords(rest) : '');
}
/** Text as shown/spoken: removes authoring marks such as "[pausa 0.8]". */
export function displayText(text: string): string {
  return text.replace(/\s*\[pausa\s+[0-9.]+\]\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
}
/** Normalised words as spoken (numbers expanded, punctuation removed, lowercase). */
export function speechWords(text: string): string[] {
  return displayText(text).replace(/\d+/g, m => ' ' + numberToWords(Number(m)) + ' ').toLowerCase()
    .replace(/[«»"“”¿?¡!.,;:()\[\]…—–\-]/g, ' ').split(/\s+/).filter(Boolean);
}
const strip = (s: string) => s.replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óò]/g, 'o').replace(/[úù]/g, 'u');
const isVowel = (c: string | undefined) => !!c && 'aeiouáéíóúü'.includes(c);
export function wordToPhonemes(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1], p = w[i - 1];
    const front = (x: string | undefined) => !!x && 'eiéí'.includes(x);
    switch (c) {
      case 'a': case 'á': out.push('a'); break;
      case 'e': case 'é': out.push('e'); break;
      case 'o': case 'ó': out.push('o'); break;
      case 'i': case 'í': out.push(c === 'i' && (isVowel(n) || isVowel(p)) ? 'j' : 'i'); break;
      case 'u': case 'ú': case 'ü': out.push(c === 'u' && isVowel(n) ? 'w' : 'u'); break;
      case 'y': out.push(n === undefined || !isVowel(n) ? 'i' : 'jj'); break;
      case 'b': case 'v': out.push('b'); break;
      case 'c': if (n === 'h') { out.push('tS'); i++; } else out.push(front(n) ? 'T' : 'k'); break;
      case 'z': out.push('T'); break;
      case 'q': out.push('k'); if (n === 'u') i++; break;
      case 'g': if (n === 'u' && front(w[i + 2])) { out.push('g'); i++; } else out.push(front(n) ? 'x' : 'g'); break;
      case 'j': out.push('x'); break;
      case 'h': break;
      case 'l': if (n === 'l') { out.push('jj'); i++; } else out.push('l'); break;
      case 'r': if (n === 'r') { out.push('rr'); i++; } else out.push(i === 0 || 'nls'.includes(p ?? '') ? 'rr' : 'r'); break;
      case 'ñ': out.push('J'); break;
      case 'x': out.push('k', 's'); break;
      case 'w': out.push('w'); break;
      case 'k': out.push('k'); break;
      default: if ('dfmnpst'.includes(c)) out.push(c); break;
    }
  }
  void strip;
  return out;
}
export function textToPhonemeWords(text: string): { word: string; phonemes: string[] }[] {
  return speechWords(text).map(word => ({ word, phonemes: wordToPhonemes(word) })).filter(x => x.phonemes.length);
}
/** Estimate duration and visemes without audio (used only before synthesis). */
export function estimateSpeech(text: string, rate = 1): { duration: number; visemes: [number, string][] } {
  const words = textToPhonemeWords(text);
  const vis: [number, string][] = [];
  let t = 0.05;
  for (const w of words) { for (const ph of w.phonemes) { vis.push([t, PHONEME_VISEME[ph] ?? 'sil']); t += PH_DURATION[PHONEME_CLASS[ph] ?? 'vowel'] / rate; } t += 0.04; }
  vis.push([t, 'sil']);
  return { duration: t + 0.15, visemes: vis };
}
