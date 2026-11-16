// Hand-written marked-compatible Markdown renderer (CommonMark 0.31.2 + GFM
// extensions), written from scratch for make.fun's markdown-render-speed-02.
// No dependencies, Node 22 stdlib only. parse(src) returns the HTML string
// marked 18.1.3 renders for the same input with its default options.

const ENT = {
  quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ', iexcl: '¡', cent: '¢',
  pound: '£', curren: '¤', yen: '¥', brvbar: '¦', sect: '§', uml: '¨', copy: '©',
  ordf: 'ª', laquo: '«', not: '¬', shy: '­', reg: '®', macr: '¯', deg: '°',
  plusmn: '±', sup2: '²', sup3: '³', acute: '´', micro: 'µ', para: '¶', middot: '·',
  cedil: '¸', sup1: '¹', ordm: 'º', raquo: '»', frac14: '¼', frac12: '½', frac34: '¾',
  iquest: '¿', Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å',
  AElig: 'Æ', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Igrave: 'Ì',
  Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', ETH: 'Ð', Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó',
  Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', times: '×', Oslash: 'Ø', Ugrave: 'Ù', Uacute: 'Ú',
  Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý', THORN: 'Þ', szlig: 'ß', agrave: 'à', aacute: 'á',
  acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç', egrave: 'è',
  eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  eth: 'ð', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  divide: '÷', oslash: 'ø', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý',
  thorn: 'þ', yuml: 'ÿ', OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ',
  Dcaron: 'Ď', dcaron: 'ď', fnof: 'ƒ', circ: 'ˆ', tilde: '˜',
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ', Eta: 'Η',
  Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν', Xi: 'Ξ',
  Omicron: 'Ο', Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ', Upsilon: 'Υ', Phi: 'Φ',
  Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
  epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ',
  mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigmaf: 'ς', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', thetasym: 'ϑ',
  upsih: 'ϒ', piv: 'ϖ',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '‌', zwj: '‍', lrm: '‎', rlm: '‏',
  zwsp: '​', hairsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', dagger: '†', Dagger: '‡',
  permil: '‰', lsaquo: '‹', rsaquo: '›', euro: '€', hellip: '…', prime: '′',
  Prime: '″', oline: '‾', frasl: '⁄', weierp: '℘', image: 'ℑ', real: 'ℜ',
  trade: '™', alefsym: 'ℵ', larr: '←', uarr: '↑', rarr: '→', darr: '↓', harr: '↔',
  crarr: '↵', lArr: '⇐', uArr: '⇑', rArr: '⇒', dArr: '⇓', hArr: '⇔', forall: '∀',
  part: '∂', exist: '∃', empty: '∅', nabla: '∇', isin: '∈', notin: '∉', ni: '∋',
  prod: '∏', sum: '∑', minus: '−', lowast: '∗', radic: '√', prop: '∝', infin: '∞',
  ang: '∠', and: '∧', or: '∨', cap: '∩', cup: '∪', int: '∫', there4: '∴', sim: '∼',
  cong: '≅', asymp: '≈', ne: '≠', equiv: '≡', le: '≤', ge: '≥', sub: '⊂', sup: '⊃',
  nsub: '⊄', sube: '⊆', supe: '⊇', oplus: '⊕', otimes: '⊗', perp: '⊥', sdot: '⋅',
  lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', lang: '⟨', rang: '⟩', loz: '◊',
  spades: '♠', clubs: '♣', hearts: '♥', diams: '♦', HilbertSpace: 'ℋ',
  DifferentialD: 'ⅆ', ClockwiseContourIntegral: '∲', ngE: '≧̸', Tab: '\t',
  NewLine: '\n', colon: ':', semi: ';', sol: '/', bsol: '\\', equals: '=', comma: ',',
  period: '.', lpar: '(', rpar: ')', lsqb: '[', rsqb: ']', lcub: '{', rcub: '}',
  verbar: '|', quest: '?', excl: '!', dollar: '$', percnt: '%', num: '#', commat: '@',
  ast: '*', plus: '+', hyphen: '-', grave: '`', fjlig: 'fj',
};

// Plain escaper: every & < > " ' is escaped. Used for text nodes (entities were
// already decoded by the tokenizer) and for code content.
const ESC_RE = /[&<>"']/g;
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) {
  return ESC_RE.test(s) ? s.replace(ESC_RE, (c) => ESC_MAP[c]) : s;
}

// Attribute escaper: & is escaped unless it starts a valid named entity
// reference (&name; with name in the table). Used for hrefs, titles, info
// strings, image alt text and bare-autolink display text.
function escAttr(s) {
  if (!/[&<>"']/.test(s)) return s;
  let out = '', last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '&') {
      const semi = s.indexOf(';', i + 1);
      if (semi > 0 && semi - i - 1 >= 1 && semi - i - 1 <= 32) {
        const name = s.slice(i + 1, semi);
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(name) && ENT[name] !== undefined) continue;
      }
      out += s.slice(last, i) + '&amp;';
      last = i + 1;
    } else if (c === '<') { out += s.slice(last, i) + '&lt;'; last = i + 1; }
    else if (c === '>') { out += s.slice(last, i) + '&gt;'; last = i + 1; }
    else if (c === '"') { out += s.slice(last, i) + '&quot;'; last = i + 1; }
    else if (c === "'") { out += s.slice(last, i) + '&#39;'; last = i + 1; }
  }
  return out + s.slice(last);
}

// Character classes.
const PUNCT_RE = /^[\p{P}\p{S}]$/u;
const ASCII_PUNCT = '!\"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
const ASCII_PUNCT_CC = new Uint8Array(128);
for (let k = 0; k < ASCII_PUNCT.length; k++) ASCII_PUNCT_CC[ASCII_PUNCT.charCodeAt(k)] = 1;
function isAsciiPunct(ch) { return ch.length === 1 && ch.charCodeAt(0) < 128 && ASCII_PUNCT_CC[ch.charCodeAt(0)] === 1; }
function isPunct(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 128) return isAsciiPunct(ch);
  return PUNCT_RE.test(ch);
}
function isSpace(ch) {
  if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') return true;
  const c = ch.charCodeAt(0);
  return c === 0x00a0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000;
}
function isAlnum(ch) {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}
function isDigit(ch) { return ch >= '0' && ch <= '9'; }

// Decode a numeric character reference &#...; or &#x...; at s[i] === '&'.
// Returns {text, end} for a valid reference, null when the shape is invalid
// (no digits, no ';', or a code point above 0x10FFFF). 0 and surrogates
// decode to U+FFFD. Named entities are NOT decoded in text (marked emits
// them verbatim); only numeric references decode.
function decodeNumericAt(s, i) {
  const n = s.length;
  let j = i + 2, hex = false;
  if (j < n && (s[j] === 'x' || s[j] === 'X')) { hex = true; j++; }
  const start = j;
  while (j < n && ((s[j] >= '0' && s[j] <= '9') || (hex && ((s[j] >= 'a' && s[j] <= 'f') || (s[j] >= 'A' && s[j] <= 'F'))))) j++;
  if (j === start || j >= n || s[j] !== ';') return null;
  const cp = parseInt(s.slice(start, j), hex ? 16 : 10);
  if (cp > 0x10FFFF) return null;
  if (!cp || (cp >= 0xD800 && cp <= 0xDFFF)) return { text: '\uFFFD', end: j + 1 };
  return { text: String.fromCodePoint(cp), end: j + 1 };
}

// Process backslash escapes in a link destination or title: \ + ASCII
// punctuation becomes the punctuation itself; other backslashes stay.
function unescapeStr(s) {
  if (s.indexOf('\\') < 0) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length && isAsciiPunct(s[i + 1])) { out += s[i + 1]; i++; }
    else out += ch;
  }
  return out;
}

// marked's href encoding: encodeURI, then restore %25 back to % (so an
// already-encoded %20 stays %20 and a literal % stays %).
function encodeHref(dest) {
  let h;
  try { h = encodeURI(dest).replace(/%25/g, '%'); } catch (e) { h = dest; }
  return escAttr(h);
}
function hrefOf(rawDest) { return encodeHref(unescapeStr(rawDest)); }
function titleOf(rawTitle) { return escAttr(unescapeStr(rawTitle)); }

// ---------------- inline parsing ----------------

function normalizeLabel(text) {
  return text.replace(/[ \t\r\n]+/g, ' ').trim().toLowerCase().replace(/ß/g, 'ss').replace(/[ﬀﬁﬂﬃﬄﬅﬆ]/g, (m) => ({ 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' })[m]);
}

// Does text contain a '[' or ']' that is not escaped and not inside a
// code span or an autolink / raw HTML tag? Such a bracket is structural.
function hasUnescapedBracket(text) {
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < n) { i += 2; continue; }
    if (ch === '`') {
      let m = 0;
      while (i + m < n && text[i + m] === '`') m++;
      let k = i + m, found = -1;
      while (k < n) {
        const b = text.indexOf('`', k);
        if (b < 0) break;
        let mm = 0;
        while (b + mm < n && text[b + mm] === '`') mm++;
        if (mm === m) { found = b; break; }
        k = b + mm;
      }
      if (found >= 0) { i = found + m; continue; }
      i += m;
      continue;
    }
    if (ch === '<') {
      const al = tryAngleAutolink(text, i);
      if (al) { i = al.end; continue; }
      const tag = tryTag(text, i);
      if (tag) { i = tag.end; continue; }
      i++;
      continue;
    }
    if (ch === '[' || ch === ']') return true;
    i++;
  }
  return false;
}

// Parse a link label starting at s[j] === '['. Returns {end, text} where end
// is the index just past the matching ']', or null.
function parseLabel(s, j) {
  const n = s.length;
  let depth = 1, i = j + 1;
  while (i < n) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < n) { i += 2; continue; }
    if (ch === '`') {
      // a code span inside the label: skip to its closing run so a ']'
      // inside the span does not end the label
      let m = 0;
      while (i + m < n && s[i + m] === '`') m++;
      let k = i + m, found = -1;
      while (k < n) {
        const b = s.indexOf('`', k);
        if (b < 0) break;
        let mm = 0;
        while (b + mm < n && s[b + mm] === '`') mm++;
        if (mm === m) { found = b; break; }
        k = b + mm;
      }
      if (found >= 0) { i = found + m; continue; }
      i += m;
      continue;
    }
    if (ch === '<') {
      // a ']' inside an autolink or raw HTML tag does not end the label
      const al = tryAngleAutolink(s, i);
      if (al) { i = al.end; continue; }
      const tag = tryTag(s, i);
      if (tag) { i = tag.end; continue; }
      i++;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return { end: i + 1, text: s.slice(j + 1, i) }; }
    else if (ch === '\n' && s[i + 1] === '\n') return null;
    i++;
  }
  return null;
}

// Validate an email domain: labels of [A-Za-z0-9_-]+ separated by '.', at
// least one '.', no empty labels, last character alphanumeric.
function validEmailDomain(d) {
  if (!d || d.indexOf('.') < 0) return false;
  const last = d[d.length - 1];
  if (!isAlnum(last)) return false;
  let labelStart = 0;
  for (let i = 0; i <= d.length; i++) {
    if (i === d.length || d[i] === '.') {
      if (i === labelStart) return false;
      for (let k = labelStart; k < i; k++) {
        const c = d[k];
        if (!(isAlnum(c) || c === '-' || c === '_')) return false;
      }
      labelStart = i + 1;
    }
  }
  return true;
}

const EMAIL_LOCAL = "!#$%&'*+-./0123456789=?ABCDEFGHIJKLMNOPQRSTUVWXYZ^_`abcdefghijklmnopqrstuvwxyz{|}~";
const EMAIL_LOCAL_CC = new Uint8Array(128);
for (let k = 0; k < EMAIL_LOCAL.length; k++) EMAIL_LOCAL_CC[EMAIL_LOCAL.charCodeAt(k)] = 1;
// Scan an email starting at s[i] (i is the first local-part char). Returns
// {end, text} or null. The candidate is the maximal local@domain run; the
// trailing punctuation is trimmed before validation.
function scanEmail(s, i, trimUnd) {
  const n = s.length;
  let j = i;
  while (j < n) { const cc = s.charCodeAt(j); if (cc >= 128 || !EMAIL_LOCAL_CC[cc]) break; j++; }
  if (j === i || j >= n || s[j] !== '@') return null;
  const at = j;
  j++;
  const domStart = j;
  while (j < n && (isAlnum(s[j]) || s[j] === '.' || s[j] === '_' || s[j] === '-')) j++;
  if (j === domStart) return null;
  let cand = s.slice(i, j);
  // trim trailing punctuation (not '_' or '-': those invalidate the address)
  let end = cand.length;
  while (end > 0) {
    const c = cand[end - 1];
    if (c === '?' || c === '!' || c === '.' || c === ',' || c === ':' || c === ';' || c === '*' || c === '~' || c === "'") end--;
    else break;
  }
  cand = cand.slice(0, end);
  if (cand.length === 0) return null;
  // A trailing '_' is the emphasis closer (not part of the address) when an
  // unmatched '_' opener exists earlier in this inline run; trim it then.
  if (trimUnd) {
    while (cand.length > 0 && cand[cand.length - 1] === '_') cand = cand.slice(0, -1);
    if (cand.length === 0) return null;
  }
  const dom = cand.slice(cand.indexOf('@') + 1);
  if (!validEmailDomain(dom)) return null;
  return { end: i + cand.length, text: cand };
}

// Scan a bare-URL candidate starting at s[i]: runs of URL characters (not
// space, not '<', not control). A '(' is only included when a ')' follows
// later in the run; at '&', an entity-like &name; that ends the run stops it.
function scanBareUrl(s, i) {
  const n = s.length;
  let j = i;
  while (j < n) {
    const c = s[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '<' || c.charCodeAt(0) < 32) break;
    if (c === '(') {
      let k = j + 1, found = false;
      while (k < n) {
        const d = s[k];
        if (d === ' ' || d === '\t' || d === '\n' || d === '\r' || d === '<' || d.charCodeAt(0) < 32) break;
        if (d === ')') { found = true; break; }
        k++;
      }
      if (!found) break;
      j++;
      continue;
    }
    if (c === '&') {
      let k = j + 1;
      if (k < n && ((s[k] >= 'a' && s[k] <= 'z') || (s[k] >= 'A' && s[k] <= 'Z'))) {
        k++;
        while (k < n && isAlnum(s[k])) k++;
        if (k < n && s[k] === ';') {
          const after = k + 1 < n ? s[k + 1] : '';
          if (!isAlnum(after)) break;
        }
      }
      j++;
      continue;
    }
    j++;
  }
  return j;
}

// Trim trailing punctuation from a bare-URL candidate, including unbalanced
// trailing ')' characters.
function trimBareUrl(s) {
  let end = s.length;
  while (end > 0) {
    const c = s[end - 1];
    if (c === ')') {
      let open = 0, close = 0;
      for (let k = 0; k < end; k++) { if (s[k] === '(') open++; else if (s[k] === ')') close++; }
      if (close > open) { end--; continue; }
      break;
    }
    if (c === '?' || c === '!' || c === '.' || c === ',' || c === ':' || c === ';' || c === '*' || c === '_' || c === '~' || c === "'") { end--; continue; }
    break;
  }
  return s.slice(0, end);
}

// Validate a // URL authority: [userinfo@]host[:port], host non-empty and
// made of [A-Za-z0-9._-]+.
function validSlashAuthority(auth) {
  if (!auth) return false;
  const at = auth.lastIndexOf('@');
  const hostport = at >= 0 ? auth.slice(at + 1) : auth;
  if (!hostport) return false;
  const colon = hostport.lastIndexOf(':');
  const host = colon >= 0 ? hostport.slice(0, colon) : hostport;
  if (!host) return false;
  for (let i = 0; i < host.length; i++) {
    const c = host[i];
    if (!(isAlnum(c) || c === '.' || c === '_' || c === '-')) return false;
  }
  return true;
}

// Try a bare autolink at s[i] (i is a letter or the 'w' of 'www.'). The
// caller has checked !inLink && !inA. Returns {end, href, text} or null.
function tryBareAutolink(s, i, trimUnd) {
  const n = s.length;
  // www. form
  if (s[i] === 'w' && s.startsWith('www.', i)) {
    const prev = i === 0 ? '' : s[i - 1];
    if (!(prev === '' || prev === ' ' || prev === '\t' || prev === '\n' || prev === '\r' || prev === '(' || prev === '*' || prev === '_' || prev === '~')) return null;
    const end0 = scanBareUrl(s, i + 4);
    let cand = trimBareUrl(s.slice(i, end0));
    if (cand.length <= 4) return null;
    const rest = cand.slice(4);
    let domEnd = rest.length;
    for (let k = 0; k < rest.length; k++) { if (rest[k] === '/' || rest[k] === '?' || rest[k] === '#') { domEnd = k; break; } }
    const dom = rest.slice(0, domEnd);
    if (!dom || dom[0] === '.') return null;
    let hasAlnum = false;
    for (let k = 0; k < dom.length; k++) if (isAlnum(dom[k])) { hasAlnum = true; break; }
    if (!hasAlnum) return null;
    return { end: i + cand.length, href: 'http://' + cand, text: cand };
  }
  if (!((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= 'A' && s[i] <= 'Z'))) return null;
  // scheme form: find ':' within 33 chars
  const colon = s.indexOf(':', i, i + 33);
  if (colon > 0) {
    const scheme = s.slice(i, colon);
    if (scheme.length >= 2 && scheme.length <= 32 && /^[A-Za-z][A-Za-z0-9+.-]*$/.test(scheme)) {
      const low = scheme.toLowerCase();
      if (low === 'mailto') {
        const em = scanEmail(s, colon + 1, trimUnd);
        if (em) return { end: em.end, href: 'mailto:' + em.text, text: s.slice(i, em.end) };
        return null;
      }
      if (low === 'xmpp') {
        const em = scanEmail(s, colon + 1, trimUnd);
        if (!em) return null;
        let end = em.end, text = s.slice(i, em.end);
        if (s[end] === '/') {
          let k = end + 1;
          while (k < n && (isAlnum(s[k]) || s[k] === '.' || s[k] === '@')) k++;
          if (k > end + 1) { text = s.slice(i, k); end = k; }
        }
        const trimmed = trimBareUrl(text);
        return { end: i + trimmed.length, href: trimmed, text: trimmed };
      }
      if (s[colon + 1] === '/' && s[colon + 2] === '/') {
        const end0 = scanBareUrl(s, colon + 3);
        let cand = trimBareUrl(s.slice(i, end0));
        const afterSlashes = cand.slice(colon + 3 - i);
        let authEnd = afterSlashes.length;
        for (let k = 0; k < afterSlashes.length; k++) { if (afterSlashes[k] === '/' || afterSlashes[k] === '?' || afterSlashes[k] === '#') { authEnd = k; break; } }
        if (!validSlashAuthority(afterSlashes.slice(0, authEnd))) return null;
        return { end: i + cand.length, href: cand, text: cand };
      }
      return null;
    }
  }
  // bare email
  if (s.charCodeAt(i) < 128 && EMAIL_LOCAL_CC[s.charCodeAt(i)]) {
    const em = scanEmail(s, i, trimUnd);
    if (em) return { end: em.end, href: 'mailto:' + em.text, text: em.text };
  }
  return null;
}

// Try to parse a raw HTML tag or comment starting at s[i] === '<'.
// Returns {end, name, closing, selfClose, open} or null.
function tryTag(s, i) {
  const n = s.length;
  if (s.startsWith('<!--', i)) {
    if (s.startsWith('<!-->', i)) return { end: i + 5, name: '', closing: false, selfClose: false, open: false, comment: true };
    if (s.startsWith('<!--->', i)) return { end: i + 6, name: '', closing: false, selfClose: false, open: false, comment: true };
    const e = s.indexOf('-->', i + 4);
    if (e < 0) return null;
    return { end: e + 3, name: '', closing: false, selfClose: false, open: false, comment: true };
  }
  if (s.startsWith('<?', i)) {
    const e = s.indexOf('?>', i + 2);
    if (e < 0) return null;
    return { end: e + 2, name: '', closing: false, selfClose: false, open: false, comment: true };
  }
  if (s.startsWith('<![CDATA[', i)) {
    const e = s.indexOf(']]>', i + 9);
    if (e < 0) return null;
    return { end: e + 3, name: '', closing: false, selfClose: false, open: false, comment: true };
  }
  if (s.startsWith('<!', i) && i + 2 < n && ((s[i + 2] >= 'A' && s[i + 2] <= 'Z') || (s[i + 2] >= 'a' && s[i + 2] <= 'z'))) {
    const e = s.indexOf('>', i + 2);
    if (e < 0) return null;
    return { end: e + 1, name: '', closing: false, selfClose: false, open: false, comment: true };
  }
  let j = i + 1, closing = false;
  if (s[j] === '/') { closing = true; j++; }
  if (j >= n || !((s[j] >= 'A' && s[j] <= 'Z') || (s[j] >= 'a' && s[j] <= 'z'))) return null;
  const nameStart = j;
  while (j < n && ((s[j] >= 'A' && s[j] <= 'Z') || (s[j] >= 'a' && s[j] <= 'z') || (s[j] >= '0' && s[j] <= '9') || s[j] === '-')) j++;
  const name = s.slice(nameStart, j);
  const afterName = j < n ? s[j] : '';
  // After a tag name only whitespace, '/' or '>' may follow; anything else
  // (e.g. ':' in '<m:abc>') is not a tag.
  if (afterName !== '' && afterName !== ' ' && afterName !== '\t' && afterName !== '\n' && afterName !== '\r' && afterName !== '/' && afterName !== '>') return null;
  if (closing) {
    while (j < n && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
    if (j >= n || s[j] !== '>') return null;
    return { end: j + 1, name, closing: true, selfClose: false, open: false, comment: false };
  }
  // open tag: attributes (each attribute must be preceded by whitespace)
  let selfClose = false;
  for (;;) {
    let ws = 0;
    while (j < n && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) { j++; ws++; }
    if (j >= n) return null;
    if (s[j] === '>') { j++; break; }
    if (s[j] === '/' && s[j + 1] === '>') { selfClose = true; j += 2; break; }
    if (ws === 0) return null;
    // attribute name
    if (!((s[j] >= 'A' && s[j] <= 'Z') || (s[j] >= 'a' && s[j] <= 'z') || s[j] === '_' || s[j] === ':')) return null;
    while (j < n && ((s[j] >= 'A' && s[j] <= 'Z') || (s[j] >= 'a' && s[j] <= 'z') || (s[j] >= '0' && s[j] <= '9') || s[j] === '_' || s[j] === ':' || s[j] === '.' || s[j] === '-')) j++;
    const afterNameJ = j;
    while (j < n && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
    if (j < n && s[j] === '=') {
      j++;
      while (j < n && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
      if (j >= n) return null;
      if (s[j] === '"' || s[j] === "'") {
        const q = s[j];
        j++;
        const e = s.indexOf(q, j);
        if (e < 0) return null;
        j = e + 1;
      } else {
        if (s[j] === '"' || s[j] === "'" || s[j] === '=' || s[j] === '<' || s[j] === '>' || s[j] === '`') return null;
        while (j < n && s[j] !== ' ' && s[j] !== '\t' && s[j] !== '\n' && s[j] !== '\r' && s[j] !== '"' && s[j] !== "'" && s[j] !== '=' && s[j] !== '<' && s[j] !== '>' && s[j] !== '`') j++;
        if (j >= n) return null;
      }
    } else {
      // valueless attribute: the whitespace skipped looking for '=' is the
      // separator for the next attribute, so leave it for the loop top
      j = afterNameJ;
    }
  }
  return { end: j, name, closing: false, selfClose, open: true, comment: false, afterName };
}

// Try an <...> autolink at s[i] === '<'. Returns {end, href, text} or null.
function tryAngleAutolink(s, i) {
  const n = s.length;
  const gt = s.indexOf('>', i + 1);
  if (gt < 0) return null;
  const inner = s.slice(i + 1, gt);
  if (!inner || inner.indexOf('<') >= 0 || inner.indexOf('\n') >= 0 || inner.indexOf(' ') >= 0) return null;
  const colon = inner.indexOf(':');
  if (colon > 0) {
    const scheme = inner.slice(0, colon);
    if (/^[A-Za-z][A-Za-z0-9+.-]{1,31}$/.test(scheme) && inner.length > colon + 1) {
      return { end: gt + 1, href: inner, text: inner };
    }
  }
  const em = scanEmail(s, i + 1);
  if (em && em.end === gt) return { end: gt + 1, href: 'mailto:' + em.text, text: em.text };
  return null;
}

// Skip whitespace (space, tab, newline) from s[p]; returns the new index.
function skipWs(s, p) {
  while (p < s.length && (s[p] === ' ' || s[p] === '\t' || s[p] === '\n' || s[p] === '\r')) p++;
  return p;
}

// Parse a link destination starting at s[p]. Returns {dest, end} or null.
// '<...>' destinations and bare destinations with balanced parens.
function parseDest(s, p) {
  const n = s.length;
  if (p >= n) return { dest: '', end: p };
  if (s[p] === '<') {
    let j = p + 1;
    while (j < n) {
      const ch = s[j];
      if (ch === '\\' && j + 1 < n && isAsciiPunct(s[j + 1])) { j += 2; continue; }
      if (ch === '>' || ch === '\n' || ch === '<') break;
      j++;
    }
    if (j >= n || s[j] !== '>') return null;
    return { dest: s.slice(p + 1, j), end: j + 1 };
  }
  let j = p, depth = 0;
  while (j < n) {
    const ch = s[j];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch.charCodeAt(0) < 32) break;
    if (ch === '\\' && j + 1 < n && isAsciiPunct(s[j + 1])) { j += 2; continue; }
    if (ch === '(') { depth++; j++; continue; }
    if (ch === ')') { if (depth === 0) break; depth--; j++; continue; }
    j++;
  }
  return { dest: s.slice(p, j), end: j };
}

// Parse a link title starting at s[p] ('"', "'" or '('). Returns {title, end} or null.
function parseTitle(s, p) {
  const n = s.length;
  const q = s[p];
  if (q === '"' || q === "'") {
    let j = p + 1;
    while (j < n) {
      const ch = s[j];
      if (ch === '\\' && j + 1 < n) { j += 2; continue; }
      if (ch === q) return { title: s.slice(p + 1, j), end: j + 1 };
      if (ch === '\n' && s[j + 1] === '\n') return null;
      j++;
    }
    return null;
  }
  if (q === '(') {
    let j = p + 1;
    while (j < n) {
      const ch = s[j];
      if (ch === '\\' && j + 1 < n) { j += 2; continue; }
      if (ch === '(') return null; // nested parens are not allowed in () titles
      if (ch === ')') return { title: s.slice(p + 1, j), end: j + 1 };
      if (ch === '\n' && s[j + 1] === '\n') return null;
      j++;
    }
    return null;
  }
  return null;
}

// Try to parse a link or image starting at s[i] ('[' or '![').
// Returns {end, href, title, text, image} or null.
function tryLink(s, i, refs, depth) {
  const n = s.length;
  let image = false, j = i;
  if (s[j] === '!') { image = true; j++; }
  if (s[j] !== '[') return null;
  const label = parseLabel(s, j);
  if (!label || label.text.length > 999) return null;
  // A link cannot contain another link: if the label text itself holds a
  // complete link, this opener is literal and the inner link wins.
  // Images (including their [ref] / (dest) part) are skipped entirely.
  if (!image && (depth || 0) < 5) {
    const lt = label.text;
    for (let k = 0; k < lt.length; k++) {
      if (lt[k] === '!' && lt[k + 1] === '[') {
        const lb = parseLabel(lt, k + 1);
        if (!lb) { k++; continue; }
        let e = lb.end;
        if (e < lt.length && lt[e] === '[') {
          const lb2 = parseLabel(lt, e);
          if (lb2) e = lb2.end;
        } else if (e < lt.length && lt[e] === '(') {
          let d = 1, q = e + 1;
          while (q < lt.length && d > 0) { if (lt[q] === '(') d++; else if (lt[q] === ')') d--; q++; }
          e = q;
        }
        k = e - 1;
        continue;
      }
      if (lt[k] === '[') {
        if (tryLink(lt, k, refs, (depth || 0) + 1)) return null;
      }
    }
  }
  let end = label.end, dest = null, title = null;
  let parsedInline = false;
  if (end < n && s[end] === '(') {
    const p0 = skipWs(s, end + 1);
    const d = parseDest(s, p0);
    if (d) {
      let p2 = skipWs(s, d.end);
      let t2 = null, p3 = p2, ok = true;
      if (p2 < n && (s[p2] === '"' || s[p2] === "'" || s[p2] === '(')) {
        const t = parseTitle(s, p2);
        if (!t) ok = false;
        else { t2 = t.title; p3 = skipWs(s, t.end); }
      }
      if (ok && p3 < n && s[p3] === ')') {
        dest = d.dest; title = t2; end = p3 + 1; parsedInline = true;
      }
    }
  }
  if (!parsedInline) {
    // A failed inline link falls back to a reference link.
    if (end < n && s[end] === '[') {
      const label2 = parseLabel(s, end);
      if (!label2) return null;
      if (label2.text.length > 0 && hasUnescapedBracket(label2.text)) return null;
      const key = normalizeLabel(label2.text.length ? label2.text : label.text);
      const ref = refs.get(key);
      if (!ref) return null;
      dest = ref.dest; title = ref.title;
      end = label2.end;
    } else {
      const ref = refs.get(normalizeLabel(label.text));
      if (!ref) return null;
      dest = ref.dest; title = ref.title;
    }
  }
  return { end, href: dest, title, text: label.text, image };
}

// ---------------- inline tokenizer / renderer ----------------

// Node types: txt (decoded text), raw (verbatim, unescaped), atxt (autolink
// display text, attribute-escaped), code, br, html (raw html), delim
// (emphasis delimiter), em, strong, del, link, img.
function inlineNodes(src, refs, opts) {
  const inLink = !!(opts && opts.inLink);
  const plain = !!(opts && opts.plain);
  const noDecode = !!(opts && opts.noDecode);
  const n = src.length;
  const root = { t: 'root', next: null, prev: null, f: null, l: null };
  let tail = root;
  const delims = [];
  let hasUndOpener = false;
  // Bare-autolink suppression from an inline <a> tag persists across
  // paragraphs until a </a> (shared via opts.state when provided).
  const st = (opts && opts.state) || { inA: false };
  let buf = '';
  function push(node) {
    node.prev = tail; node.next = null; node.inMain = true;
    tail.next = node; tail = node;
    return node;
  }
  function flush() { if (buf) { push({ t: 'txt', s: buf }); buf = ''; } }
  function pushDelim(c, len, open, close) {
    const d = { t: 'delim', c, n: len, o: open, cl: close };
    push(d);
    delims.push(d);
    if (c === '_' && open) hasUndOpener = true;
    return d;
  }

  let i = 0;
  while (i < n) {
    const ch = src[i];
    if (ch === '\\') {
      if (i + 1 < n && isAsciiPunct(src[i + 1])) { buf += src[i + 1]; i += 2; continue; }
      if (i + 1 < n && src[i + 1] === '\n') {
        flush();
        push({ t: 'br', hard: true });
        i += 2;
        while (i < n && (src[i] === ' ' || src[i] === '\t')) i++;
        continue;
      }
      buf += '\\'; i++; continue;
    }
    if (ch === '`') {
      let k = 0;
      while (i + k < n && src[i + k] === '`') k++;
      let j = i + k, found = -1;
      while (j < n) {
        const b = src.indexOf('`', j);
        if (b < 0) break;
        let m = 0;
        while (b + m < n && src[b + m] === '`') m++;
        if (m === k) { found = b; break; }
        j = b + m;
      }
      if (found < 0) { buf += src.slice(i, i + k); i += k; continue; }
      let content = src.slice(i + k, found);
      if (content.indexOf('\n') >= 0) content = content.replace(/\n/g, ' ');
      if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' && content.trim() !== '') {
        content = content.slice(1, -1);
      }
      flush();
      push({ t: 'code', s: content });
      i = found + k;
      continue;
    }
    if (ch === '&' && !noDecode) {
      if (src[i + 1] === '#') {
        const dec = decodeNumericAt(src, i);
        if (dec) { buf += dec.text; i = dec.end; continue; }
        // invalid numeric shape: the '&' is escaped by the text escaper
        buf += '&'; i++; continue;
      }
      // a named entity shape &name; is emitted verbatim
      let j = i + 1;
      while (j < n && isAlnum(src[j])) j++;
      if (j > i + 1 && j < n && src[j] === ';') {
        flush();
        push({ t: 'raw', s: src.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      buf += '&'; i++; continue;
    }
    if (ch === '<') {
      const al = tryAngleAutolink(src, i);
      if (al) {
        flush();
        const href = al.href.startsWith('mailto:') ? 'mailto:' + encodeHref(al.href.slice(7)) : encodeHref(al.href);
        const node = { t: 'link', href, title: null, f: null, l: null };
        const txt = { t: 'atxt', s: al.text };
        node.f = txt; node.l = txt; txt.prev = null; txt.next = null;
        push(node);
        i = al.end;
        continue;
      }
      const tag = tryTag(src, i);
      if (tag) {
        flush();
        const raw = src.slice(i, tag.end);
        push({ t: 'html', s: raw });
        if (tag.open && tag.name.toLowerCase() === 'a') {
          const after = tag.afterName;
          if (after === ' ' || after === '\t' || after === '\n' || after === '\r') st.inA = true;
        } else if (tag.closing && tag.name.toLowerCase() === 'a') {
          st.inA = false;
        }
        i = tag.end;
        continue;
      }
      buf += '<'; i++; continue;
    }
    if (ch === '[' || (ch === '!' && src[i + 1] === '[')) {
      if (ch === '[' && inLink) { buf += '['; i++; continue; }
      const lk = tryLink(src, i, refs);
      if (lk) {
        flush();
        if (lk.image) {
          const alt = inlineParse(lk.text, refs, { plain: true, noDecode: true });
          const node = { t: 'img', src: hrefOf(lk.href), alt: escAttr(alt), title: lk.title == null ? null : titleOf(lk.title) };
          push(node);
        } else {
          const node = { t: 'link', href: hrefOf(lk.href), title: lk.title == null ? null : titleOf(lk.title), f: null, l: null };
          const sub = inlineNodes(lk.text, refs, { inLink: true });
          node.f = sub.first; node.l = sub.last;
          push(node);
        }
        i = lk.end;
        continue;
      }
      if (ch === '!') { buf += '!'; i++; continue; }
      buf += '['; i++; continue;
    }
    if (ch === '*' || ch === '_') {
      let k = 0;
      while (i + k < n && src[i + k] === ch) k++;
      const prev = i === 0 ? '\n' : src[i - 1];
      const next = i + k >= n ? '\n' : src[i + k];
      const prevWs = isSpace(prev), nextWs = isSpace(next);
      const prevP = isPunct(prev), nextP = isPunct(next);
      const leftFlank = !nextWs && (!nextP || prevWs || prevP);
      const rightFlank = !prevWs && (!prevP || nextWs || nextP);
      let open, close;
      if (ch === '*') { open = leftFlank; close = rightFlank; }
      else { open = leftFlank && (!rightFlank || prevP); close = rightFlank && (!leftFlank || nextP); }
      flush();
      pushDelim(ch, k, open, close);
      i += k;
      continue;
    }
    if (ch === '~') {
      let k = 0;
      while (i + k < n && src[i + k] === '~') k++;
      if (k >= 3) { buf += src.slice(i, i + k); i += k; continue; }
      const prev = i === 0 ? '\n' : src[i - 1];
      const next = i + k >= n ? '\n' : src[i + k];
      const prevWs = isSpace(prev), nextWs = isSpace(next);
      const prevP = isPunct(prev), nextP = isPunct(next);
      const leftFlank = !nextWs && (!nextP || prevWs || prevP);
      const rightFlank = !prevWs && (!prevP || nextWs || nextP);
      flush();
      pushDelim('~', k, leftFlank, rightFlank);
      i += k;
      continue;
    }
    if (ch === '\n') {
      // trailing spaces in the current text run decide hard vs soft break
      let sp = 0;
      while (sp < buf.length && buf[buf.length - 1 - sp] === ' ') sp++;
      if (sp >= 2) {
        buf = buf.slice(0, buf.length - sp);
        flush();
        push({ t: 'br', hard: true });
        i++;
        while (i < n && (src[i] === ' ' || src[i] === '\t')) i++;
      } else {
        flush();
        push({ t: 'br', hard: false });
        i++;
      }
      continue;
    }
    if (!plain && !inLink && !st.inA && (ch === 'w' || ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch.charCodeAt(0) < 128 && EMAIL_LOCAL_CC[ch.charCodeAt(0)])))) {
      const al = tryBareAutolink(src, i, hasUndOpener);
      if (al) {
        flush();
        const href = al.href.startsWith('mailto:') ? 'mailto:' + encodeHref(al.href.slice(7)) : encodeHref(al.href);
        const node = { t: 'link', href, title: null, f: null, l: null };
        const txt = { t: 'atxt', s: al.text };
        node.f = txt; node.l = txt; txt.prev = null; txt.next = null;
        push(node);
        i = al.end;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  processEmphasis(root, delims);
  const first = root.next;
  if (first) first.prev = null;
  return { first, last: tail === root ? null : tail };
}

function inlineParse(src, refs, opts) {
  const sub = inlineNodes(src, refs, opts);
  const out = [];
  if (opts && opts.plain) renderPlainList(sub.first, out);
  else renderList(sub.first, out);
  return out.join('');
}

// Emphasis / strikethrough: the standard delimiter-stack algorithm.
function processEmphasis(root, delims) {
  const bottom = {};
  for (let di = 0; di < delims.length; di++) {
    const closer = delims[di];
    if (!closer.cl || closer.n === 0 || !closer.inMain) continue;
    for (;;) {
      let oddMatch = false, opener = null;
      for (let oi = di - 1; oi >= 0; oi--) {
        const cand = delims[oi];
        if (cand === bottom[closer.c]) break;
        if (!cand.inMain || cand.n === 0 || cand.c !== closer.c || !cand.o) continue;
        if ((cand.o && cand.cl) || (closer.o && closer.cl)) {
          if ((cand.n + closer.n) % 3 === 0 && !(cand.n % 3 === 0 && closer.n % 3 === 0)) { oddMatch = true; continue; }
        }
        opener = cand;
        break;
      }
      if (!opener) {
        if (!oddMatch && !closer.o) bottom[closer.c] = closer;
        break;
      }
      const use = (opener.n >= 2 && closer.n >= 2) ? 2 : 1;
      const tag = closer.c === '~' ? 'del' : (use === 2 ? 'strong' : 'em');
      const wrap = { t: tag, f: null, l: null, next: null, prev: null, inMain: true };
      // move the nodes between opener and closer into the wrapper
      let first = opener.next, last = closer.prev;
      if (first !== closer) {
        wrap.f = first; wrap.l = last;
        first.prev = null; last.next = null;
        let cur = first;
        while (cur) { if (cur.t === 'delim') cur.inMain = false; cur = cur.next; }
      }
      opener.n -= use;
      closer.n -= use;
      const before = opener.prev, after = closer.next;
      if (opener.n > 0) { wrap.prev = opener; opener.next = wrap; }
      else { if (before) before.next = wrap; wrap.prev = before; }
      if (closer.n > 0) { wrap.next = closer; closer.prev = wrap; }
      else { if (after) after.prev = wrap; wrap.next = after; }
      if (closer.n === 0 || !closer.cl) break;
    }
  }
}

function renderList(first, out) {
  let cur = first;
  while (cur) {
    const t = cur.t;
    if (t === 'txt') out.push(esc(cur.s));
    else if (t === 'atxt') out.push(escAttr(cur.s));
    else if (t === 'raw' || t === 'html') out.push(cur.s);
    else if (t === 'code') out.push('<code>' + esc(cur.s) + '</code>');
    else if (t === 'br') out.push(cur.hard ? '<br>' : '\n');
    else if (t === 'delim') out.push(cur.c.repeat(cur.n));
    else if (t === 'em' || t === 'strong' || t === 'del') {
      out.push(t === 'em' ? '<em>' : t === 'strong' ? '<strong>' : '<del>');
      renderList(cur.f, out);
      out.push(t === 'em' ? '</em>' : t === 'strong' ? '</strong>' : '</del>');
    } else if (t === 'link') {
      out.push('<a href="' + cur.href + '"');
      if (cur.title != null) out.push(' title="' + cur.title + '"');
      out.push('>');
      renderList(cur.f, out);
      out.push('</a>');
    } else if (t === 'img') {
      out.push('<img src="' + cur.src + '" alt="' + cur.alt + '"');
      if (cur.title != null) out.push(' title="' + cur.title + '"');
      out.push('>');
    }
    cur = cur.next;
  }
}
function renderPlainList(first, out) {
  let cur = first;
  while (cur) {
    const t = cur.t;
    if (t === 'txt' || t === 'raw' || t === 'html' || t === 'code' || t === 'atxt') out.push(cur.s);
    else if (t === 'br') out.push(cur.hard ? '' : '\n');
    else if (t === 'delim') out.push(cur.c.repeat(cur.n));
    else if (t === 'em' || t === 'strong' || t === 'del' || t === 'link') renderPlainList(cur.f, out);
    else if (t === 'img') out.push(cur.alt);
    cur = cur.next;
  }
}

// ---------------- block parsing ----------------

// Cursor over one source line. p is the string index, ac the absolute
// column (for tab stops), rc the column relative to the current container's
// content start, part the remaining width of a partially consumed tab.
function curInit(s) { return { s, p: 0, ac: 0, rc: 0, part: 0 }; }
function curPeek(k) { return k.part > 0 ? ' ' : (k.p < k.s.length ? k.s[k.p] : ''); }
function curAtEol(k) { return k.part === 0 && k.p >= k.s.length; }
function curAdvance(k, n) {
  const s = k.s;
  while (n > 0) {
    if (k.part > 0) {
      const t = k.part < n ? k.part : n;
      k.part -= t; k.ac += t; k.rc += t; n -= t;
      if (k.part === 0) k.p++;
    } else if (k.p >= s.length) break;
    else {
      const ch = s[k.p];
      if (ch === ' ') { k.p++; k.ac++; k.rc++; n--; }
      else if (ch === '\t') {
        const w = 4 - (k.ac % 4);
        if (w <= n) { k.p++; k.ac += w; k.rc += w; n -= w; }
        else { k.part = w - n; k.ac += n; k.rc += n; n = 0; }
      } else break;
    }
  }
}
function curIndent(k) {
  const s = k.s;
  let c = k.ac, p = k.p, n = 0;
  if (k.part > 0) { n += k.part; c += k.part; p++; }
  while (p < s.length) {
    const ch = s[p];
    if (ch === ' ') { n++; c++; p++; }
    else if (ch === '\t') { const w = 4 - (c % 4); n += w; c += w; p++; }
    else break;
  }
  return n;
}
function curSkipCols(k, n) {
  // advance n columns over arbitrary characters (tabs are tab-aware, so a
  // tab may be only partially consumed)
  const s = k.s;
  while (n > 0) {
    if (k.part > 0) {
      const t = k.part < n ? k.part : n;
      k.part -= t; k.ac += t; k.rc += t; n -= t;
      if (k.part === 0) k.p++;
    } else if (k.p >= s.length) break;
    else {
      const ch = s[k.p];
      if (ch === '\t') {
        const w = 4 - (k.ac % 4);
        if (w <= n) { k.p++; k.ac += w; k.rc += w; n -= w; }
        else { k.part = w - n; k.ac += n; k.rc += n; n = 0; }
      } else {
        k.p++; k.ac++; k.rc++; n--;
      }
    }
  }
}
function curRest(k) {
  if (k.part > 0) return ' '.repeat(k.part) + k.s.slice(k.p + 1);
  // A tab that is the first character of the remainder, after a container
  // prefix has been consumed, expands to spaces up to the next tab stop
  // (a tab at column 0 with nothing consumed stays a literal tab).
  if (k.ac > 0 && k.p < k.s.length && k.s[k.p] === '\t') {
    return ' '.repeat(4 - (k.ac % 4)) + k.s.slice(k.p + 1);
  }
  return k.s.slice(k.p);
}
// Raw remainder: only a partially-consumed tab expands; a leading tab is
// kept as-is (used for indented code content, where tabs are content).
function curRestRaw(k) {
  if (k.part > 0) return ' '.repeat(k.part) + k.s.slice(k.p + 1);
  return k.s.slice(k.p);
}
function saveK(k) { return { p: k.p, ac: k.ac, rc: k.rc, part: k.part }; }
function restoreK(k, s) { k.p = s.p; k.ac = s.ac; k.rc = s.rc; k.part = s.part; }
function isBlankLine(s) {
  for (let i = 0; i < s.length; i++) if (s[i] !== ' ' && s[i] !== '\t') return false;
  return true;
}
function indentOf(k) { return k.rc + curIndent(k); }

// Remove up to n columns of leading whitespace from a string (tab-aware).
function stripColumns(s, n) {
  let col = 0, i = 0;
  while (i < s.length && col < n) {
    const ch = s[i];
    if (ch === ' ') { i++; col++; }
    else if (ch === '\t') {
      const w = 4 - (col % 4);
      if (col + w <= n) { i++; col += w; }
      else return ' '.repeat(col + w - n) + s.slice(i + 1);
    } else break;
  }
  return s.slice(i);
}

// Skip spaces/tabs/newlines without crossing a blank line; -1 on a blank line.
function skipWsNoBlank(s, p) {
  while (p < s.length) {
    const ch = s[p];
    if (ch === ' ' || ch === '\t') { p++; continue; }
    if (ch === '\n') {
      let q = p + 1;
      while (q < s.length && (s[q] === ' ' || s[q] === '\t')) q++;
      if (q >= s.length || s[q] === '\n') return -1;
      p = q; continue;
    }
    break;
  }
  return p;
}

// Parse link reference definitions from the start of `text` (paragraph lines
// joined with '\n'). When record is true the definitions are stored in refs
// (first definition wins). Returns the remaining lines after the defs.
function parseRefDefs(text, refs, record) {
  const n = text.length;
  let pos = 0;
  while (pos < n) {
    // indent of at most 3 columns before '['
    let col = 0, p = pos;
    while (p < n && (text[p] === ' ' || text[p] === '\t')) {
      if (text[p] === ' ') col++;
      else col += 4 - (col % 4);
      p++;
      if (col > 3) break;
    }
    if (col > 3 || p >= n || text[p] !== '[') break;
    const label = parseLabel(text, p);
    if (!label || label.text.length > 999) break;
    if (label.text.length === 0 || normalizeLabel(label.text) === '') break;
    if (hasUnescapedBracket(label.text)) break;
    let q = skipWsNoBlank(text, label.end);
    if (q < 0 || q >= n || text[q] !== ':') break;
    q++;
    q = skipWsNoBlank(text, q);
    if (q < 0) break;
    let dest;
    if (text[q] === '<') {
      let j = q + 1;
      while (j < n && text[j] !== '>' && text[j] !== '\n' && text[j] !== '<') j++;
      if (j >= n || text[j] !== '>') break;
      dest = text.slice(q + 1, j);
      q = j + 1;
    } else {
      const d = parseDest(text, q);
      if (!d || d.dest === '') break;
      dest = d.dest;
      q = d.end;
    }
    // optional title, on this line or the next. A same-line title needs
    // whitespace before it (else the def is invalid); a malformed title
    // on the next line is ignored and the def stands dest-only.
    let title = null, qAfter = q;
    let r = q;
    while (r < n && (text[r] === ' ' || text[r] === '\t')) r++;
    if (r < n && (text[r] === '"' || text[r] === "'" || text[r] === '(')) {
      if (r === q) break;
      const t = parseTitle(text, r);
      if (!t) break;
      title = t.title; qAfter = t.end;
    } else if (r < n && text[r] === '\n') {
      let r2 = r + 1;
      while (r2 < n && (text[r2] === ' ' || text[r2] === '\t')) r2++;
      if (r2 < n && text[r2] !== '\n' && (text[r2] === '"' || text[r2] === "'" || text[r2] === '(')) {
        const t = parseTitle(text, r2);
        if (t) {
          let r3 = t.end;
          while (r3 < n && (text[r3] === ' ' || text[r3] === '\t')) r3++;
          if (r3 >= n || text[r3] === '\n') { title = t.title; qAfter = t.end; }
        }
      }
    }
    let e = qAfter;
    while (e < n && (text[e] === ' ' || text[e] === '\t')) e++;
    if (e < n && text[e] !== '\n') break;
    if (record) {
      const key = normalizeLabel(label.text);
      if (!refs.has(key)) refs.set(key, { dest, title });
    }
    pos = e < n ? e + 1 : e;
  }
  const rest = pos >= n ? '' : text.slice(pos);
  return { restLines: rest === '' ? [] : rest.split('\n') };
}

// Split a table row line into cells on unescaped '|' outside code spans.
function splitTableRow(line) {
  const n = line.length;
  const spans = [];
  let i = 0;
  while (i < n) {
    if (line[i] === '`') {
      let m = 0;
      while (i + m < n && line[i + m] === '`') m++;
      let j = i + m, found = -1;
      while (j < n) {
        const b = line.indexOf('`', j);
        if (b < 0) break;
        let mm = 0;
        while (b + mm < n && line[b + mm] === '`') mm++;
        if (mm === m) { found = b; break; }
        j = b + mm;
      }
      if (found >= 0) { spans.push([i, found + m]); i = found + m; continue; }
      // No matching closer: the backticks examined while searching for it
      // are consumed as literal text and cannot open a new span.
      i = j;
      continue;
    }
    i++;
  }
  const cells = [];
  let cur = '';
  i = 0;
  while (i < n) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < n) {
      // an escaped pipe is a literal pipe in the cell (not a delimiter);
      // an escaped backslash stays escaped so a following '|' still splits
      if (line[i + 1] === '|') { cur += '|'; i += 2; continue; }
      if (line[i + 1] === '\\') { cur += '\\\\'; i += 2; continue; }
    }
    if (ch === '|') {
      let inside = false;
      for (let s = 0; s < spans.length; s++) if (i >= spans[s][0] && i < spans[s][1]) { inside = true; break; }
      if (!inside) { cells.push(cur); cur = ''; i++; continue; }
    }
    cur += ch; i++;
  }
  cells.push(cur);
  return cells;
}

// Parse a table delimiter row; returns the alignment list or null.
function parseTableDelim(rest) {
  if (rest.indexOf('|') < 0 && rest.indexOf(':') < 0) return null;
  let cells = splitTableRow(rest);
  const t = rest.trim();
  if (t.startsWith('|')) cells = cells.slice(1);
  if (t.endsWith('|')) cells = cells.slice(0, -1);
  if (cells.length === 0) return null;
  const aligns = [];
  for (const c of cells) {
    const m = c.trim().match(/^(:?)-+(:?)$/);
    if (!m) return null;
    aligns.push(m[1] && m[2] ? 'center' : m[1] ? 'left' : m[2] ? 'right' : null);
  }
  return aligns;
}

const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul').split(' '));

// ---------------- main parser ----------------

export function parse(src) {
  src = src.replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  // a trailing '\n' leaves an empty artifact element after the split; it
  // is not a real line (a real trailing blank line survives as its own
  // element)
  if (src.endsWith('\n')) lines.pop();
  const refs = new Map();
  const iState = { inA: false }; // shared bare-autolink suppression state
  const root = { t: 'doc', children: [] };
  const stack = [root];
  let cur = null; // current open leaf block (or null)
  let lineIdx = 0; // index of the source line currently being processed
  const totalLines = lines.length;
  const endsWithNewline = src.endsWith('\n');

  function parent() { return stack[stack.length - 1]; }
  // Add a block-level node to the current container. A non-list block can
  // never be a direct child of a list, so an innermost list is closed first.
  // A new block in an item that saw a blank line makes the item's list loose.
  function pushBlock(node) {
    while (parent().t === 'list') {
      const popped = stack.pop();
      const p = parent();
      if (popped.sawBlank && p && p.t === 'item') p.sawBlank = true;
    }
    const p = parent();
    if (p.t === 'item' && p.sawBlank) {
      const list = stack[stack.length - 2];
      if (list && list.t === 'list') { list.loose = true; list.tight = false; list.sawBlank = false; }
      p.sawBlank = false;
    }
    p.children.push(node);
    return node;
  }
  function finalizePara(node) {
    const d = parseRefDefs(node.lines.join('\n'), refs, true);
    node.lines = d.restLines;
    return node.lines.length > 0;
  }
  function closeLeaf() {
    if (!cur) return;
    if (cur.t === 'para') {
      if (!finalizePara(cur)) {
        const ch = parent().children;
        const ix = ch.indexOf(cur);
        if (ix >= 0) ch.splice(ix, 1);
      }
    } else if (cur.t === 'code' && !cur.fenced) {
      while (cur.lines.length && cur.lines[cur.lines.length - 1] === '') cur.lines.pop();
    } else if (cur.t === 'code' && cur.fenced) {
      // a fenced block drops exactly one trailing empty line
      if (cur.lines.length && cur.lines[cur.lines.length - 1] === '') cur.lines.pop();
    }
    cur = null;
  }
  function onBlankLine() {
    for (let si = stack.length - 1; si >= 1; si--) {
      const c = stack[si];
      if (c.t === 'quote') {
        if (c.closed) continue;
        return;
      }
      if (c.t === 'item') {
        if (c.children.length > 0) { c.sawBlank = true; }
        else { c.closed = true; }
        const list = stack[si - 1];
        if (list && list.t === 'list') list.sawBlank = true;
        break;
      }
    }
  }
  function popTo(depth) {
    while (stack.length - 1 > depth) {
      const node = stack.pop();
      const p = stack[stack.length - 1];
      if (!p) break;
      // A blank line pending in a popped list/item moves up to its parent:
      // the blank line sat after that container's last block, so it also
      // separates the parent's next block. Quotes never propagate.
      if (node.t === 'list' && node.sawBlank && p.t === 'item') p.sawBlank = true;
      else if (node.t === 'item' && node.sawBlank && p.t === 'list') p.sawBlank = true;
    }
  }
  function closeTo(depth) {
    if (stack.length - 1 > depth) closeLeaf();
    popTo(depth);
  }

  // --- block start detectors (cursor at content start, indent <= 3) ---
  function isAtxStart(k) {
    if (curPeek(k) !== '#') return false;
    let level = 0;
    const s = k.s;
    let p = k.p;
    while (p < s.length && s[p] === '#') { level++; p++; }
    if (level > 6) return false;
    if (p >= s.length) return true;
    const c = s[p];
    return c === ' ' || c === '\t';
  }
  function isFenceStart(k) {
    const ch = curPeek(k);
    if (ch !== '`' && ch !== '~') return false;
    const s = k.s;
    let p = k.p, len = 0;
    while (p < s.length && s[p] === ch) { len++; p++; }
    if (len < 3) return false;
    if (ch === '`' && s.indexOf('`', p) >= 0) return false;
    return true;
  }
  function isHtml16(k) {
    const rest = curRest(k);
    const lower = rest.toLowerCase();
    if (/^<(script|pre|style|textarea)([ \t>]|$)/.test(lower)) return true;
    if (rest.startsWith('<!--') || rest.startsWith('<?') || /^<![A-Za-z]/.test(rest) || rest.startsWith('<![CDATA[')) return true;
    const m6 = rest.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)(?=[ \t>\/]|$)/);
    return !!(m6 && BLOCK_TAGS.has(m6[1].toLowerCase()));
  }
  function isThematicBreak(k) {
    const rest = curRest(k);
    let i = 0;
    while (i < rest.length && (rest[i] === ' ' || rest[i] === '\t')) i++;
    if (i >= rest.length) return false;
    const ch = rest[i];
    if (ch !== '-' && ch !== '_' && ch !== '*') return false;
    let count = 0;
    while (i < rest.length) {
      const c = rest[i];
      if (c === ch) { count++; i++; }
      else if (c === ' ' || c === '\t') i++;
      else return false;
    }
    return count >= 3;
  }
  // Parse a list marker at the cursor. Returns marker info or null.
  // forInterrupt: only markers that may interrupt a paragraph count.
  function parseMarker(k, forInterrupt) {
    const ch = curPeek(k);
    let bullet = false, delim = null, start = 0, markerLen = 0;
    if (ch === '-' || ch === '+' || ch === '*') {
      bullet = true; markerLen = 1;
    } else if (ch >= '0' && ch <= '9') {
      const s = k.s;
      let p = k.p, digits = 0, num = 0;
      while (p < s.length && s[p] >= '0' && s[p] <= '9') {
        if (digits < 9) num = num * 10 + (s.charCodeAt(p) - 48);
        digits++; p++;
      }
      if (digits === 0 || digits > 9) return null;
      if (p >= s.length || (s[p] !== '.' && s[p] !== ')')) return null;
      delim = s[p]; start = num; markerLen = digits + 1;
    } else return null;
    // the char after the marker must be a space, a tab, or EOL
    const after = k.p + markerLen;
    if (after < k.s.length) {
      const c = k.s[after];
      if (c !== ' ' && c !== '\t') return null;
    }
    if (forInterrupt && !bullet && start !== 1) return null;
    return { bullet, ch, delim, start, markerLen };
  }
  function isListStart(k, forInterrupt) {
    const save = saveK(k);
    const m = parseMarker(k, forInterrupt);
    if (!m) return false;
    // measure the spaces after the marker; an empty item cannot interrupt
    curSkipCols(k, m.markerLen);
    curAdvance(k, 5);
    const empty = /^[ \t]*$/.test(curRest(k));
    restoreK(k, save);
    if (forInterrupt && empty) return false;
    return true;
  }
  function startsInterrupting(k) {
    const ind = indentOf(k);
    if (ind > 3) return false;
    const save = saveK(k);
    curAdvance(k, curIndent(k));
    const ch = curPeek(k);
    let r = false;
    if (ch === '#') r = isAtxStart(k);
    else if (ch === '`' || ch === '~') r = isFenceStart(k);
    else if (ch === '<') r = isHtml16(k);
    else if (ch === '-' || ch === '_' || ch === '*' || (ch >= '0' && ch <= '9')) {
      r = isThematicBreak(k) || isListStart(k, true);
    } else if (ch === '>') r = true;
    restoreK(k, save);
    return r;
  }

  // Content of a lazy continuation line for a paragraph. The first lazy
  // line in a run drops 4 columns when its indent is >= 4; later lazy
  // lines are kept as-is, except a setext '=' underline in a blockquote
  // paragraph is raised to an indent of 4 (so it cannot read as an
  // underline) when the previous line was lazy too.
  function lazyLineContent(k, para) {
    let content = curRest(k);
    const ind = curIndent(k);
    if (para.lastLazy) {
      if (para.inQuote && ind < 4 && /^[ \t]*=+[ \t]*$/.test(content)) {
        content = '    ' + content.replace(/^[ \t]+/, '');
      }
    } else if (ind >= 4) {
      curAdvance(k, 4);
      content = curRest(k);
    }
    return content;
  }
  function matchQuote(k) {
    const save = saveK(k);
    const ind = curIndent(k);
    if (ind > 3) return false;
    curAdvance(k, ind);
    if (curPeek(k) !== '>') { restoreK(k, save); return false; }
    k.p++; k.ac++; k.rc++;
    if (!curAtEol(k)) curAdvance(k, 1);
    return true;
  }
  function matchItem(k, item) {
    if (item.closed) return false;
    const ind = curIndent(k);
    if (ind < item.contentIndent) return false;
    curAdvance(k, item.contentIndent);
    return true;
  }

  // --- block creation ---
  function setextLevel(rest) {
    const t = rest.trim();
    if (/^=+$/.test(t)) return 1;
    if (/^-+$/.test(t)) return 2;
    return 0;
  }
  function startPara(text) {
    const node = { t: 'para', lines: [text], inQuote: parent().t === 'quote', lastLazy: false };
    pushBlock(node);
    cur = node;
  }
  function startHead(level, content) {
    const node = { t: 'head', level, lines: [content] };
    pushBlock(node);
  }
  function startCode(fenced, fenceChar, fenceLen, fenceIndent, info) {
    const node = { t: 'code', fenced, fenceChar, fenceLen, fenceIndent, info, lines: [] };
    pushBlock(node);
    cur = node;
  }
  function htmlEndMarker(kind, tag) {
    if (kind === 'script') return '</' + tag + '>';
    if (kind === 'comment') return '-->';
    if (kind === 'pi') return '?>';
    if (kind === 'decl') return '>';
    if (kind === 'cdata') return ']]>';
    return null;
  }
  function startHtml(rawLine) {
    // Skip up to 3 columns of leading whitespace for detection; the stored
    // content keeps the raw line (leading spaces included).
    let i = 0, col = 0;
    while (i < rawLine.length && col < 3) {
      const ch = rawLine[i];
      if (ch === ' ') { i++; col++; }
      else if (ch === '\t') { const w = 4 - (col % 4); if (col + w > 3) break; i++; col += w; }
      else break;
    }
    const rest = rawLine.slice(i);
    const lower = rest.toLowerCase();
    let kind = null, tag = null;
    const m1 = lower.match(/^<(script|pre|style|textarea)([ \t>]|$)/);
    if (m1) { kind = 'script'; tag = m1[1]; }
    else if (rest.startsWith('<!--')) kind = 'comment';
    else if (rest.startsWith('<?')) kind = 'pi';
    else if (/^<![A-Za-z]/.test(rest)) kind = 'decl';
    else if (rest.startsWith('<![CDATA[')) kind = 'cdata';
    else {
      // type 6: a block-level tag at the start of the line (it need not be
      // the only tag, and it may span lines)
      const m6 = rest.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)(?=[ \t>\/]|$)/);
      if (m6 && BLOCK_TAGS.has(m6[1].toLowerCase())) kind = 'blank';
      else {
        // type 7: any single tag alone on the line
        const tagInfo = tryTag(rest, 0);
        if (tagInfo && /^[ \t]*$/.test(rest.slice(tagInfo.end))) kind = 'blank7';
      }
    }
    if (!kind) return false;
    const node = { t: 'html', endKind: kind, endTag: tag, lines: [rawLine], lastLine: lineIdx };
    pushBlock(node);
    if (kind !== 'blank' && kind !== 'blank7') {
      const marker = htmlEndMarker(kind, tag);
      if (marker && rest.toLowerCase().indexOf(marker) >= 0) {
        // ends on its own first line
        cur = null;
        return true;
      }
    }
    cur = node;
    return true;
  }

  function listMatches(list, m) {
    if (list.bullet !== m.bullet) return false;
    if (m.bullet) return list.ch === m.ch;
    return list.delim === m.delim;
  }
  function createListAndItem(m, k) {
    const list = { t: 'list', bullet: m.bullet, ch: m.ch, delim: m.delim, start: m.start, indent: m.markerRc, tight: true, loose: false, sawBlank: false, children: [] };
    pushBlock(list);
    stack.push(list);
    addItem(list, m, k);
  }
  function addItem(list, m, k) {
    if (list.sawBlank) { list.loose = true; list.tight = false; list.sawBlank = false; }
    const item = { t: 'item', contentIndent: m.contentIndent, children: [], sawBlank: false, closed: false };
    list.children.push(item);
    stack.push(item);
    k.rc = 0;
    if (!m.empty) parseAtCursor(k);
  }
  function openListItem(k, m) {
    // Walk the stack from the top; for each list, decide if the marker is
    // a sibling item of it (add) or if that list should be closed (pop).
    // A marker left of a list's indent is still a sibling of that list
    // unless a shallower list of the same type sits below it (the marker
    // then belongs to the shallower list).
    while (stack.length > 1) {
      const top = stack[stack.length - 1];
      if (top.t === 'item') {
        // the line matched the item, so this marker opens a nested list
        createListAndItem(m, k);
        return;
      }
      if (top.t === 'list') {
        let shallowerList = false;
        for (let i = stack.length - 2; i >= 1; i--) {
          if (stack[i].t === 'quote') break;
          if (stack[i].t === 'list' && listMatches(stack[i], m)) { shallowerList = true; break; }
        }
        const isSibling = listMatches(top, m) && m.markerRc <= top.indent + 3 && (m.markerRc >= top.indent || !shallowerList);
        if (isSibling) { addItem(top, m, k); return; }
        stack.pop();
        continue;
      }
      break;
    }
    createListAndItem(m, k);
  }
  function tryList(k) {
    const save = saveK(k);
    const m = parseMarker(k, false);
    if (!m) { restoreK(k, save); return false; }
    m.markerRc = k.rc;
    curSkipCols(k, m.markerLen);
    const startRc = k.rc;
    curAdvance(k, 5);
    const spaces = k.rc - startRc;
    const restAfter = curRest(k);
    if (/^[ \t]*$/.test(restAfter)) {
      m.empty = true;
      m.contentIndent = m.markerRc + m.markerLen + 1;
    } else if (spaces >= 1 && spaces <= 4) {
      m.empty = false;
      m.contentIndent = m.markerRc + m.markerLen + spaces;
    } else {
      // 5 or more spaces: the content starts one column past the marker
      m.empty = false;
      m.contentIndent = m.markerRc + m.markerLen + 1;
      restoreK(k, save);
      curSkipCols(k, m.markerLen + 1);
      m.markerRc = save.rc;
    }
    openListItem(k, m);
    return true;
  }
  function tryAtx(k) {
    const save = saveK(k);
    if (curPeek(k) !== '#') return false;
    let level = 0;
    while (curPeek(k) === '#') { k.p++; k.ac++; k.rc++; level++; }
    if (level > 6) { restoreK(k, save); return false; }
    if (!curAtEol(k)) {
      const c = curPeek(k);
      if (c !== ' ' && c !== '\t') { restoreK(k, save); return false; }
    }
    let content = curRest(k).replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    const cm = content.match(/^(.*?)[ \t]+#+$/);
    if (cm) content = cm[1];
    else if (/^#+$/.test(content)) content = '';
    startHead(level, content);
    return true;
  }
  function tryFence(k, ind) {
    const save = saveK(k);
    const ch = curPeek(k);
    if (ch !== '`' && ch !== '~') return false;
    let len = 0;
    while (curPeek(k) === ch) { k.p++; k.ac++; k.rc++; len++; }
    if (len < 3) { restoreK(k, save); return false; }
    const info = curRest(k);
    if (ch === '`' && info.indexOf('`') >= 0) { restoreK(k, save); return false; }
    let lang = info.replace(/^[ \t]+/, '');
    const sp = lang.search(/[ \t]/);
    if (sp >= 0) lang = lang.slice(0, sp);
    lang = unescapeStr(lang);
    startCode(true, ch, len, ind, lang);
    return true;
  }
  function tryHr(k) {
    if (isThematicBreak(k)) {
      pushBlock({ t: 'hr' });
      return true;
    }
    return false;
  }
  function tryQuote(k) {
    if (curPeek(k) !== '>') return false;
    k.p++; k.ac++; k.rc++;
    if (!curAtEol(k)) curAdvance(k, 1);
    const quote = { t: 'quote', children: [], closed: false };
    pushBlock(quote);
    stack.push(quote);
    k.rc = 0;
    parseAtCursor(k);
    return true;
  }

  function parseNewBlock(k) {
    const lineRest = curRest(k);
    const ind = indentOf(k);
    const save = saveK(k);
    curAdvance(k, curIndent(k));
    if (ind <= 3) {
      if (tryAtx(k)) return;
      if (tryFence(k, ind)) return;
      if (startHtml(lineRest)) return;
      if (tryHr(k)) return;
      if (tryList(k)) return;
      if (tryQuote(k)) return;
    }
    if (ind >= 4) {
      // indented code block: remove exactly 4 columns from the line start
      restoreK(k, save);
      curAdvance(k, 4);
      const node = { t: 'code', fenced: false, fenceChar: '', fenceLen: 0, fenceIndent: 0, info: '', lines: [curRestRaw(k)] };
      pushBlock(node);
      cur = node;
      return;
    }
    startPara(lineRest);
  }

  function parseAtCursor(k) {
    if (cur) {
      if (cur.t === 'code' && cur.fenced) {
        const ind = indentOf(k);
        if (ind <= 3) {
          const save = saveK(k);
          curAdvance(k, curIndent(k));
          if (curPeek(k) === cur.fenceChar) {
            let len = 0;
            while (curPeek(k) === cur.fenceChar) { k.p++; k.ac++; k.rc++; len++; }
            if (len >= cur.fenceLen && /^[ \t]*$/.test(curRest(k))) {
              closeLeaf();
              return;
            }
          }
          restoreK(k, save);
        }
        let content = curRest(k);
        if (cur.fenceChar === '`') content = stripColumns(content, cur.fenceIndent);
        cur.lines.push(content);
        return;
      }
      if (cur.t === 'code' && !cur.fenced) {
        const rest = curRest(k);
        if (/^[ \t]*$/.test(rest)) { cur.lines.push(''); return; }
        if (indentOf(k) >= 4) {
          curAdvance(k, 4);
          cur.lines.push(curRest(k));
          return;
        }
        closeLeaf();
        parseNewBlock(k);
        return;
      }
      if (cur.t === 'html') {
        const rest = curRest(k);
        if (cur.endKind === 'blank' || cur.endKind === 'blank7') {
          if (/^[ \t]*$/.test(rest)) { closeLeaf(); onBlankLine(); return; }
          cur.lines.push(rest);
          cur.lastLine = lineIdx;
          return;
        }
        cur.lines.push(rest);
        cur.lastLine = lineIdx;
        const marker = htmlEndMarker(cur.endKind, cur.endTag);
        if (marker && rest.toLowerCase().indexOf(marker) >= 0) closeLeaf();
        return;
      }
      if (cur.t === 'table') {
        const rest = curRest(k);
        // A whitespace-only line ends the table, EXCEPT a line that is
        // exactly one tab, which is a row of empty cells.
        if (rest === '' || /^ *$/.test(rest) || (/^[ \t]+$/.test(rest) && rest !== '\t')) { closeLeaf(); onBlankLine(); return; }
        if (startsInterrupting(k)) { closeLeaf(); parseNewBlock(k); return; }
        cur.rows.push(rest);
        return;
      }
      // paragraph
      const rest = curRest(k);
      // Only a truly empty remainder is a blank line; a whitespace-only
      // remainder (e.g. '>  ' -> ' ') is a paragraph line.
      if (rest === '') { closeLeaf(); onBlankLine(); return; }
      const ind = indentOf(k);
      if (ind <= 3) {
        const st = setextLevel(rest);
        if (st) {
          const d = parseRefDefs(cur.lines.join('\n'), refs, false);
          if (d.restLines.length > 0) {
            const node = cur;
            closeLeaf();
            const headLines = d.restLines.slice();
            headLines[0] = headLines[0].replace(/^[ \t]+/, '');
            headLines[headLines.length - 1] = headLines[headLines.length - 1].replace(/[ \t]+$/, '');
            const head = { t: 'head', level: st, lines: headLines };
            const ch = parent().children;
            const ix = ch.indexOf(node);
            if (ix >= 0) ch[ix] = head;
            else ch.push(head);
            return;
          }
        }
        const aligns = parseTableDelim(rest);
        if (aligns) {
          const d = parseRefDefs(cur.lines.join('\n'), refs, false);
          if (d.restLines.length > 0) {
            // the delimiter row must have exactly as many cells as the header
            const headLine = d.restLines[d.restLines.length - 1];
            const headCells = splitTableRow(headLine);
            const ht = headLine.trim();
            let hc = headCells.length;
            if (ht.startsWith('|')) hc--;
            if (ht.endsWith('|')) hc--;
            if (hc === aligns.length) {
            const node = cur;
            closeLeaf();
            const table = { t: 'table', headLine: d.restLines[d.restLines.length - 1], aligns, rows: [] };
            const ch = parent().children;
            const ix = ch.indexOf(node);
            if (ix >= 0) {
              if (d.restLines.length > 1) {
                const para = { t: 'para', lines: d.restLines.slice(0, -1) };
                ch[ix] = para;
                ch.splice(ix + 1, 0, table);
              } else {
                ch[ix] = table;
              }
            } else ch.push(table);
            cur = table;
            return;
            }
          }
        }
      }
      if (startsInterrupting(k)) {
        closeLeaf();
        parseNewBlock(k);
        return;
      }
      // Inside a list item, any list marker starts a nested list, even an
      // ordered marker that does not start with 1 (which cannot interrupt
      // a paragraph at the top level).
      if (parent().t === 'item' && indentOf(k) <= 3 && isListStart(k, false)) {
        closeLeaf();
        parseNewBlock(k);
        return;
      }
      // If the paragraph's last line was a whitespace-only remainder line,
      // it acted as a blank line once real content follows: drop it, close
      // the paragraph, and start this line as a fresh paragraph.
      if (cur.lines.length > 0 && /^[ \t]*$/.test(cur.lines[cur.lines.length - 1])) {
        cur.lines.pop();
        closeLeaf();
        parseNewBlock(k);
        return;
      }
      cur.lines.push(rest);
      cur.lastLazy = false;
      return;
    }
    const rest = curRest(k);
    if (/^[ \t]*$/.test(rest)) { onBlankLine(); return; }
    parseNewBlock(k);
  }

  for (let li = 0; li < lines.length; li++) {
    lineIdx = li;
    const line = lines[li];
    const k = curInit(line);
    if (isBlankLine(line)) {
      // A blank line is leaf content only when it really reaches the leaf's
      // containers (a blank line with no blockquote marker is outside a
      // fenced block that lives in a quote). Run the container matching to
      // find how deep the blank line reaches.
      let depth = 0;
      for (let si = 1; si < stack.length; si++) {
        const c = stack[si];
        if (c.t === 'quote') {
          if (c.closed || !matchQuote(k)) break;
          k.rc = 0; depth = si;
        } else if (c.t === 'list') {
          depth = si;
        } else if (c.t === 'item') {
          if (!matchItem(k, c)) break;
          k.rc = 0; depth = si;
        }
      }
      const leafDepth = stack.length - 1;
      // A blank line inside a code block is code content as long as no
      // ancestor is a blockquote (a blank line closes a quote, so the
      // line is outside it).
      if (cur && cur.t === 'code') {
        let inQuote = false;
        for (let si = 1; si < stack.length; si++) if (stack[si].t === 'quote') { inQuote = true; break; }
        if (!inQuote) {
          if (cur.fenced) {
            let content = curRest(k);
            if (cur.fenceChar === '`') content = stripColumns(content, cur.fenceIndent);
            cur.lines.push(content);
          } else {
            cur.lines.push(stripColumns(curRestRaw(k), 4));
          }
          continue;
        }
      }
      // A line that is exactly one tab is a table row of empty cells
      // (not a blank line), as long as no ancestor is a blockquote.
      if (cur && cur.t === 'table' && line === '\t') {
        let inQuote = false;
        for (let si = 1; si < stack.length; si++) if (stack[si].t === 'quote') { inQuote = true; break; }
        if (!inQuote) { cur.rows.push(curRest(k)); continue; }
      }
      if (cur && (cur.t === 'code' || (cur.t === 'html' && cur.endKind !== 'blank' && cur.endKind !== 'blank7')) && depth >= leafDepth) {
        if (cur.t === 'code' && cur.fenced) {
          let content = curRest(k);
          if (cur.fenceChar === '`') content = stripColumns(content, cur.fenceIndent);
          cur.lines.push(content);
        } else if (cur.t === 'code') {
          cur.lines.push(stripColumns(curRestRaw(k), 4));
        } else {
          cur.lines.push(curRest(k));
          cur.lastLine = lineIdx;
        }
        continue;
      }
      if (cur) closeLeaf();
      // A truly blank line ends every open blockquote: the next '>' line
      // starts a fresh blockquote instead of continuing this one. Mark
      // them before onBlankLine so it can tell a closed quote apart from
      // a blank line that is still inside an open quote.
      for (let si = 1; si < stack.length; si++) if (stack[si].t === 'quote') stack[si].closed = true;
      onBlankLine();
      continue;
    }
    let depth = 0;
    let lazy = false;
    for (let si = 1; si < stack.length; si++) {
      const c = stack[si];
      if (c.t === 'quote') {
        if (c.closed || !matchQuote(k)) {
          if (cur && cur.t === 'para' && !startsInterrupting(k) && !(indentOf(k) <= 3 && isListStart(k, false))) lazy = true;
          break;
        }
        k.rc = 0; depth = si;
      } else if (c.t === 'list') {
        depth = si;
      } else if (c.t === 'item') {
        if (!matchItem(k, c)) {
          if (cur && cur.t === 'para' && !startsInterrupting(k) && !(indentOf(k) <= 3 && isListStart(k, false))) lazy = true;
          // a fenced code block keeps content lines even when they do not
          // meet the item's content indent (the block only ends at its fence)
          if (cur && cur.t === 'code' && cur.fenced) depth = stack.length - 1;
          break;
        }
        k.rc = 0; depth = si;
      }
    }
    if (lazy) {
      if (cur) {
        const content = lazyLineContent(k, cur);
        if (content === '') {
          // an empty lazy line is a blank line, not a paragraph line
          closeLeaf();
          onBlankLine();
        } else if (cur.lines.length > 0 && /^[ \t]*$/.test(cur.lines[cur.lines.length - 1])) {
          cur.lines.pop();
          closeLeaf();
          closeTo(depth);
          startPara(content);
          cur.lastLazy = true;
        } else {
          cur.lines.push(content);
          cur.lastLazy = true;
        }
      }
      continue;
    }
    closeTo(depth);
    parseAtCursor(k);
  }
  if (cur) closeLeaf();

  // ---------------- rendering ----------------
  const out = [];
  function renderInlineLines(lines, refs, ctx) {
    return inlineParse(lines.join('\n'), refs, ctx);
  }
  function renderChildren(node, tightParent, topLevel) {
    for (const ch of node.children) renderBlock(ch, tightParent, topLevel);
  }
  function renderBlock(node, tightParent, isTopLevel) {
    if (node.t === 'doc') { renderChildren(node, false, true); return; }
    if (node.t === 'quote') { out.push('<blockquote>\n'); renderChildren(node, false, false); out.push('</blockquote>\n'); return; }
    if (node.t === 'list') {
      if (node.bullet) out.push('<ul>\n');
      else out.push(node.start === 1 ? '<ol>\n' : '<ol start="' + node.start + '">\n');
      for (const item of node.children) renderBlock(item, node.tight, false);
      out.push(node.bullet ? '</ul>\n' : '</ol>\n');
      return;
    }
    if (node.t === 'item') {
      out.push('<li>');
      const kids = node.children;
      let task = null;
      if (kids.length > 0 && kids[0].t === 'para') {
        const fl = kids[0].lines[0];
        const m = fl && fl.match(/^\[([ xX])\]([ \t]|$)/);
        if (m) {
          task = m[1] === ' ' ? '<input disabled="" type="checkbox">' : '<input checked="" disabled="" type="checkbox">';
          kids[0].lines = kids[0].lines.slice();
          kids[0].lines[0] = fl.slice(m[2] ? 4 : 3);
        }
      }
      for (let i = 0; i < kids.length; i++) {
        const ch = kids[i];
        if (ch.t === 'para') {
          const html = renderInlineLines(ch.lines, refs, { state: iState });
          if (tightParent) out.push((i === 0 && task ? task + ' ' : '') + html);
          else out.push('<p>' + (i === 0 && task ? task + ' ' : '') + html + '</p>\n');
        } else {
          if (i === 0 && task) out.push(task + ' ');
          renderBlock(ch, false, false);
        }
      }
      out.push('</li>\n');
      return;
    }
    if (node.t === 'para') {
      const html = renderInlineLines(node.lines, refs, { state: iState });
      if (tightParent) out.push(html);
      else out.push('<p>' + html + '</p>\n');
      return;
    }
    if (node.t === 'head') {
      out.push('<h' + node.level + '>' + renderInlineLines(node.lines, refs, { state: iState }) + '</h' + node.level + '>\n');
      return;
    }
    if (node.t === 'code') {
      const content = node.lines.length ? node.lines.join('\n') + '\n' : '';
      out.push('<pre><code' + (node.info ? ' class="language-' + escAttr(node.info) + '"' : '') + '>' + esc(content) + '</code></pre>\n');
      return;
    }
    if (node.t === 'html') {
      // a trailing newline when this is a top-level block and its last line
      // is terminated by '\n' in the input. Types 1-5 (end at a marker)
      // keep it unless the next line is truly empty; types 6-7 (end at a
      // blank line) keep it only when the next line is not blank at all.
      const terminated = node.lastLine < totalLines - 1 || endsWithNewline;
      const isBlankEnd = node.endKind === 'blank' || node.endKind === 'blank7';
      const nextNotBlank = node.lastLine + 1 >= totalLines ||
        (isBlankEnd ? !isBlankLine(lines[node.lastLine + 1]) : lines[node.lastLine + 1] !== '');
      const trail = (isTopLevel && terminated && nextNotBlank) ? '\n' : '';
      out.push(node.lines.join('\n') + trail);
      return;
    }
    if (node.t === 'hr') { out.push('<hr>\n'); return; }
    if (node.t === 'table') {
      const headCells = splitTableRow(node.headLine);
      const t = node.headLine.trim();
      let hc = headCells;
      if (t.startsWith('|')) hc = hc.slice(1);
      if (t.endsWith('|')) hc = hc.slice(0, -1);
      out.push('<table>\n<thead>\n<tr>\n');
      for (let i = 0; i < node.aligns.length; i++) {
        const cell = (hc[i] || '').trim();
        const a = node.aligns[i];
        out.push('<th' + (a ? ' align="' + a + '"' : '') + '>' + inlineParse(cell, refs, { state: iState }) + '</th>\n');
      }
      out.push('</tr>\n</thead>\n');
      if (node.rows.length) {
        out.push('<tbody>');
        for (const row of node.rows) {
          const cells = splitTableRow(row);
          const rt = row.trim();
          let rc2 = cells;
          if (rt.startsWith('|')) rc2 = rc2.slice(1);
          if (rt.endsWith('|')) rc2 = rc2.slice(0, -1);
          out.push('<tr>\n');
          for (let i = 0; i < node.aligns.length; i++) {
            const cell = (rc2[i] || '').trim();
            const a = node.aligns[i];
            out.push('<td' + (a ? ' align="' + a + '"' : '') + '>' + inlineParse(cell, refs, { state: iState }) + '</td>\n');
          }
          out.push('</tr>\n');
        }
        out.push('</tbody></table>\n');
      } else {
        out.push('</table>\n');
      }
      return;
    }
  }
  renderBlock(root, false, false);
  return out.join('');
}
