// ============================================================
// EMOJI → ASCII substitution for the terminal messenger.
//
//   emojiToAscii(text)        → string with every known emoji
//                               swapped for its ASCII alt
//   asciiSuggest(query)       → entries matching a ":word" token
//   ASCII_EMOJI               → full list (drives the picker)
// ============================================================

/**
 * Each entry: { e: emoji, a: ascii, n: [searchable names] }.
 * `n[0]` doubles as the picker tooltip / shortcode.
 */
export const ASCII_EMOJI = [
  // ── faces ───────────────────────────────────────────────
  { e: '😀', a: ':D', n: ['grin', 'happy'] },
  { e: '😃', a: ':D', n: ['smile'] },
  { e: '😄', a: ':D', n: ['laugh'] },
  { e: '😁', a: ':D', n: ['beam'] },
  { e: '😂', a: "':D", n: ['joy', 'lol'] },
  { e: '🤣', a: 'XD', n: ['rofl', 'lmao'] },
  { e: '🙂', a: ':)', n: ['slight', 'smile2'] },
  { e: '😉', a: ';)', n: ['wink'] },
  { e: '😊', a: '^_^', n: ['blush'] },
  { e: '😍', a: '<3_<3', n: ['hearteyes', 'love2'] },
  { e: '😘', a: ':*', n: ['kiss'] },
  { e: '😜', a: ';P', n: ['zany'] },
  { e: '😛', a: ':P', n: ['tongue'] },
  { e: '😏', a: ':^)', n: ['smirk'] },
  { e: '😐', a: ':|', n: ['neutral'] },
  { e: '😶', a: ':x', n: ['nomouth'] },
  { e: '🙄', a: '[eyeroll]', n: ['roll'] },
  { e: '😬', a: ':-S', n: ['grimace'] },
  { e: '😢', a: ":'(", n: ['cry', 'sad'] },
  { e: '😭', a: ":'((", n: ['sob'] },
  { e: '🥺', a: '[pls]', n: ['pleading'] },
  { e: '😠', a: '>:(', n: ['angry', 'mad'] },
  { e: '😡', a: '>:((', n: ['rage'] },
  { e: '😎', a: 'B-)', n: ['cool', 'sunglasses'] },
  { e: '😴', a: '[zzz]', n: ['sleep'] },
  { e: '😱', a: ':-O', n: ['scream'] },
  { e: '😲', a: ':O', n: ['shock'] },
  { e: '🤔', a: '[hmm...]', n: ['think'] },
  { e: '🤯', a: '*BOOM*', n: ['mindblown'] },
  { e: '🤐', a: ':-#', n: ['zipper'] },
  { e: '😇', a: 'O:)', n: ['angel'] },
  { e: '🙃', a: '(:', n: ['upsidedown'] },
  { e: '🤦', a: '[facepalm]', n: ['facepalm'] },
  { e: '🤷', a: '\\_(?)_/', n: ['shrug'] },
  { e: '🥳', a: '\\o/', n: ['partyface'] },
  // ── hands / gestures ────────────────────────────────────
  { e: '👍', a: '[+1]', n: ['thumbsup', 'yes', 'ok'] },
  { e: '👎', a: '[-1]', n: ['thumbsdown', 'no'] },
  { e: '👏', a: '[clap]', n: ['applause'] },
  { e: '🙏', a: '[pray]', n: ['thanks', 'please'] },
  { e: '👊', a: '[FIST]', n: ['punch'] },
  { e: '✊', a: '[FIST!]', n: ['raisedfist'] },
  { e: '💪', a: '[STRONG]', n: ['muscle'] },
  { e: '🤝', a: '[handshake]', n: ['deal'] },
  { e: '👀', a: '[O_O]', n: ['eyes', 'look'] },
  // ── symbols / energy ────────────────────────────────────
  { e: '❤️', a: '<3', n: ['heart', 'love'] },
  { e: '❤', a: '<3', n: ['heart2'] },
  { e: '💔', a: '</3', n: ['brokenheart'] },
  { e: '💕', a: '<3<3', n: ['twohearts'] },
  { e: '🔥', a: '###FIRE###', n: ['fire', 'lit'] },
  { e: '💯', a: '[100%]', n: ['hundred', 'perfect'] },
  { e: '🎉', a: '\\o/ PARTY!!!', n: ['tada', 'party'] },
  { e: '🎊', a: '*confetti*', n: ['confetti'] },
  { e: '⚡', a: '~*ZAP*~', n: ['zap', 'bolt'] },
  { e: '✨', a: '*sparkle*', n: ['sparkles'] },
  { e: '💀', a: '[DEAD]', n: ['skull', 'dead'] },
  { e: '☠️', a: '[X_X]', n: ['poison'] },
  { e: '👻', a: '[BOO!]', n: ['ghost'] },
  { e: '💩', a: '[POO]', n: ['poop'] },
  { e: '🤖', a: '[BOT]', n: ['robot'] },
  { e: '👽', a: '[ALIEN]', n: ['alien'] },
  { e: '🚀', a: '[LAUNCH]', n: ['rocket'] },
  { e: '💡', a: '[IDEA]', n: ['bulb', 'idea'] },
  { e: '⭐', a: '[*]', n: ['star'] },
  { e: '🌟', a: '[**]', n: ['star2', 'glow'] },
  // ── status / ui ─────────────────────────────────────────
  { e: '✅', a: '[OK]', n: ['check', 'done'] },
  { e: '✔️', a: '[v]', n: ['tick'] },
  { e: '❌', a: '[ERR]', n: ['x', 'error', 'cross'] },
  { e: '❎', a: '[X]', n: ['negx'] },
  { e: '⚠️', a: '[WARN!]', n: ['warning', 'warn'] },
  { e: '❓', a: '???', n: ['question'] },
  { e: '❗', a: '!!!', n: ['exclaim', 'bang'] },
  { e: '🔒', a: '[LOCKED]', n: ['lock'] },
  { e: '🔓', a: '[UNLOCKED]', n: ['unlock'] },
  { e: '🔑', a: '[KEY]', n: ['key'] },
  { e: '🌐', a: '[WEB]', n: ['globe', 'web'] },
  { e: '📡', a: '[SIGNAL]', n: ['satellite', 'signal'] },
  { e: '📎', a: '[ATTACH]', n: ['paperclip', 'attach'] },
  { e: '📸', a: '[PHOTO]', n: ['camera', 'photo'] },
  { e: '📹', a: '[VIDEO]', n: ['video'] },
  { e: '🎤', a: '[MIC]', n: ['mic'] },
  { e: '🔊', a: '[SOUND]', n: ['speaker', 'loud'] },
  { e: '🔇', a: '[MUTE]', n: ['mute'] },
  { e: '🔔', a: '[BELL]', n: ['bell', 'notify'] },
  { e: '📌', a: '[PIN]', n: ['pin'] },
  { e: '📍', a: '[LOC]', n: ['location'] },
  { e: '⏰', a: '[ALARM]', n: ['alarm', 'clock'] },
  { e: '⏳', a: '[WAIT]', n: ['loading', 'wait'] },
  { e: '💬', a: '[MSG]', n: ['speech', 'chat'] },
  { e: '💭', a: '[(...)]', n: ['thought'] },
  { e: '🌙', a: '[MOON]', n: ['moon'] },
  { e: '☀️', a: '[SUN]', n: ['sun'] },
  // ── arrows ──────────────────────────────────────────────
  { e: '➡️', a: '->', n: ['right'] },
  { e: '⬅️', a: '<-', n: ['left'] },
  { e: '⬆️', a: '/\\', n: ['up'] },
  { e: '⬇️', a: '\\/', n: ['down'] },
  { e: '🔁', a: '(<->)', n: ['repeat', 'loop'] },
  { e: '➕', a: '[+]', n: ['plus'] },
  { e: '➖', a: '[-]', n: ['minus'] },
];

// Build the lookup + a single matching regex.
// Longest emoji first so multi-codepoint sequences win over their base.
const BY_EMOJI = new Map();
for (const it of ASCII_EMOJI) {
  if (!BY_EMOJI.has(it.e)) BY_EMOJI.set(it.e, it.a);
  // Also index the variation-selector-stripped form (❤️ ↔ ❤).
  const bare = it.e.replace(/️/g, '');
  if (bare !== it.e && !BY_EMOJI.has(bare)) BY_EMOJI.set(bare, it.a);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EMOJI_RE = new RegExp(
  [...BY_EMOJI.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|'),
  'gu'
);

/**
 * Replace every known emoji in `text` with its ASCII alternative.
 * Unknown emoji are left untouched.
 * @param {string} text
 * @returns {string}
 */
export function emojiToAscii(text) {
  if (!text) return text;
  return String(text).replace(EMOJI_RE, (m) => {
    if (BY_EMOJI.has(m)) return BY_EMOJI.get(m);
    const bare = m.replace(/️/g, '');
    return BY_EMOJI.get(bare) ?? m;
  });
}

/** True if the string contains at least one mappable emoji. */
export function hasEmoji(text) {
  EMOJI_RE.lastIndex = 0;
  return !!text && EMOJI_RE.test(text);
}

/**
 * Suggestions for a typed ":token" — matches by name prefix first,
 * then substring. Empty query returns a popular subset.
 * @param {string} query  text after the ":" (no colon)
 * @param {number} [limit]
 */
export function asciiSuggest(query, limit = 8) {
  const q = String(query || '').toLowerCase();
  if (!q) return ASCII_EMOJI.slice(0, limit);
  const starts = [];
  const includes = [];
  for (const it of ASCII_EMOJI) {
    const hit = it.n.some((name) => name.includes(q));
    if (!hit) continue;
    (it.n.some((name) => name.startsWith(q)) ? starts : includes).push(it);
  }
  return [...starts, ...includes].slice(0, limit);
}
