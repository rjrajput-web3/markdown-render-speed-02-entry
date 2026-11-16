// parse.js — a fast CommonMark 0.31.2 + GFM 0.29 renderer whose HTML matches
// marked 18.1.3 with its default options (gfm on, breaks off, pedantic off,
// async off). It is a hand-written single-pass parser: no dependency, no
// regular-expression hot loops, no lookup of any case's text or output.
// Built from the two specs and from black-box probing of marked's output.
//
// Layout of a parsed inline unit: tokenize() scans the text once into small
// token objects, processEmphasis() resolves * _ ~ delimiters with the
// CommonMark delimiter-stack algorithm, and renderTokens() writes the HTML.
// Block parsing is line based and recursive over containers (quotes, lists).

// ---- character classes ----------------------------------------------------

const ASCII_PUNCT = new Uint8Array(128);
for (const ch of '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~') ASCII_PUNCT[ch.charCodeAt(0)] = 1;

function isAsciiPunctCode(c) {
  return c < 128 && ASCII_PUNCT[c] === 1;
}
function isSpaceCode(c) {
  if (c < 128) return c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13;
  return c === 0xA0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200A) || c === 0x2028 ||
    c === 0x2029 || c === 0x202F || c === 0x205F || c === 0x3000 || c === 0xFEFF;
}
const UNICODE_PUNCT_RE = /[\p{P}\p{S}]/u;
function isPunctCode(c) {
  if (c < 128) return ASCII_PUNCT[c] === 1;
  return UNICODE_PUNCT_RE.test(String.fromCodePoint(c));
}
function isHexCode(c) {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}
function isAlnumCode(c) {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

// ---- entities -------------------------------------------------------------
// A named reference &name; (name = letters, digits, underscore) is passed
// through verbatim, whatever the name is. A numeric reference &#N; (1-7
// decimal digits) or &#[xX]N; (1-6 hex digits) decodes to the code point,
// with 0, surrogates and values above U+10FFFF becoming U+FFFD. Anything
// else is literal text. This matches marked's output on every probe.

// entityAt(s, i): s[i] is '&'. Returns {text, end, decoded} or null.
// text is what the reference renders as in normal text (named: the raw
// reference; numeric: the decoded character, HTML-escaped when needed).
// decoded is the decoded character for numeric references, else null.
function entityAt(s, i) {
  const n = s.length;
  let j = i + 1;
  if (j >= n) return null;
  if (s.charCodeAt(j) === 35) { // '#'
    let k = j + 1;
    let hex = false;
    if (k < n && (s.charCodeAt(k) === 120 || s.charCodeAt(k) === 88)) { hex = true; k++; }
    const start = k;
    if (hex) {
      while (k < n && isHexCode(s.charCodeAt(k))) k++;
      if (k === start || k - start > 6 || k >= n || s.charCodeAt(k) !== 59) return null;
    } else {
      while (k < n && s.charCodeAt(k) >= 48 && s.charCodeAt(k) <= 57) k++;
      if (k === start || k - start > 7 || k >= n || s.charCodeAt(k) !== 59) return null;
    }
    const code = parseInt(s.slice(start, k), hex ? 16 : 10);
    const ch = (code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF))
      ? '\uFFFD' : String.fromCodePoint(code);
    const cc = ch.charCodeAt(0);
    const text = cc === 38 ? '&amp;' : cc === 60 ? '&lt;' : cc === 62 ? '&gt;' :
      cc === 34 ? '&quot;' : cc === 39 ? '&#39;' : ch;
    return { text, end: k + 1, decoded: ch };
  }
  let k = j;
  while (k < n) {
    const c = s.charCodeAt(k);
    if (isAlnumCode(c) || c === 95) k++;
    else break;
  }
  if (k === j || k >= n || s.charCodeAt(k) !== 59) return null; // needs ';'
  return { text: s.slice(i, k + 1), end: k + 1, decoded: null };
}

// ---- HTML escaping --------------------------------------------------------
// escapeText: escape & < > " ' in a string, except that entity references
// pass through (named verbatim, numeric decoded). Used for text, titles
// and anywhere a raw string becomes HTML text or an attribute value.
function escapeText(s) {
  let out = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38) { // '&'
      const e = entityAt(s, i);
      if (e) {
        if (out === null) out = '';
        out += escapePlain(s, start, i) + e.text;
        i = e.end - 1;
        start = e.end;
        continue;
      }
    }
    if (c === 38 || c === 60 || c === 62 || c === 34 || c === 39) {
      if (out === null) out = '';
      out += s.slice(start, i);
      out += c === 38 ? '&amp;' : c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;';
      start = i + 1;
    }
  }
  if (out === null) return s;
  return out + s.slice(start);
}

// escapePlain: escape & < > " ' in s[a..b), with no entity recognition.
function escapePlain(s, a, b) {
  let out = null;
  let start = a;
  for (let i = a; i < b; i++) {
    const c = s.charCodeAt(i);
    if (c === 38 || c === 60 || c === 62 || c === 34 || c === 39) {
      if (out === null) out = '';
      out += s.slice(start, i);
      out += c === 38 ? '&amp;' : c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;';
      start = i + 1;
    }
  }
  if (out === null) return s.slice(a, b);
  return out + s.slice(start, b);
}

// escapeHref: build an href/src attribute value from a link destination.
// Entity references are kept verbatim (named and numeric alike); every
// other stretch is percent-encoded like encodeURI, then & < > " ' escaped.
function escapeHref(s) {
  let out = '';
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 38) {
      const e = entityAt(s, i);
      if (e) {
        out += encodeSegment(s.slice(start, i));
        out += s.slice(i, e.end);
        i = e.end;
        start = i;
        continue;
      }
    }
    i++;
  }
  out += encodeSegment(s.slice(start));
  return out;
}

// encodeSegment: encodeURI a stretch, then escape the characters encodeURI
// leaves behind that HTML attribute values must not carry raw. Percent
// signs are left alone (marked preserves %20, %zz and bare % verbatim).
function encodeSegment(seg) {
  if (seg.length === 0) return '';
  let enc;
  try {
    enc = encodeURI(seg).replace(/%25/g, '%');
  } catch {
    enc = seg;
  }
  return escapePlain(enc, 0, enc.length);
}

// unescapeBackslashes(s): resolve backslash escapes (backslash + ASCII
// punctuation becomes that punctuation) in a short string such as a
// fenced-code info word. Entities are not decoded.
function unescapeBackslashes(s) {
  if (!s.includes('\\')) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92 && i + 1 < s.length && isAsciiPunctCode(s.charCodeAt(i + 1))) {
      out += s[i + 1];
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

// ---- small line helpers ---------------------------------------------------

function isBlankLine(line) {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

// indentOf: leading whitespace of a line in columns (tab = next multiple of 4).
function indentOf(line) {
  let col = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c === 32) col++;
    else if (c === 9) col += 4 - (col % 4);
    else break;
  }
  return col;
}

// stripIndent(line, n): drop the first n columns of a line's indent.
// A tab straddling the boundary is replaced by the spaces it covers.
// stripFenceIndent(line, n): drop up to n columns of a fenced-code
// content line's indent. Unlike stripIndent, a tab counts as a single
// column here (marked quirk: '  ```\n\t foo' yields 'foo', not
// '   foo'; a straddling tab is dropped whole and stripping continues
// into the following spaces). A tab left at the head of the line is
// kept as a tab (list-item stripping expands tabs separately).
function stripFenceIndent(line, n) {
  let col = 0;
  let i = 0;
  while (i < line.length && col < n) {
    const c = line.charCodeAt(i);
    if (c === 32 || c === 9) { col++; i++; }
    else break;
  }
  return line.slice(i);
}

function stripIndent(line, n) {
  let col = 0;
  let i = 0;
  while (i < line.length && col < n) {
    const c = line.charCodeAt(i);
    if (c === 32) { col++; i++; }
    else if (c === 9) {
      const w = 4 - (col % 4);
      if (col + w <= n) { col += w; i++; }
      else {
        // tab straddles: keep the leftover columns as spaces
        return ' '.repeat(col + w - n) + line.slice(i + 1);
      }
    } else break;
  }
  return line.slice(i);
}

// expandTabsFrom(line, startIdx, startCol): expand the leading tabs of
// line.slice(startIdx) to spaces, where line[startIdx] sits at column
// startCol in the original line. A tab expands to the next multiple of 4.
function expandTabsFrom(line, startIdx, startCol) {
  let col = startCol;
  let i = startIdx;
  let out = '';
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32) { out += ' '; col++; i++; }
    else if (c === 9) { const w = 4 - (col % 4); out += ' '.repeat(w); col += w; i++; }
    else break;
  }
  return out + line.slice(i);
}

// stripColumns(line, n): drop the first n columns of a line, whatever they
// are (marker characters included). A tab straddling the boundary leaves
// the spaces it covers, and any leading tab left in the remainder expands
// to spaces based on its original column. Used for a list item's first
// line, where the first columns are the marker itself.
function stripColumns(line, n) {
  let col = 0;
  let i = 0;
  let out = '';
  while (i < line.length && col < n) {
    const c = line.charCodeAt(i);
    if (c === 9) {
      const w = 4 - (col % 4);
      if (col + w <= n) { col += w; i++; }
      else { out += ' '.repeat(col + w - n); col += w; i++; break; }
    } else { col++; i++; }
  }
  return out + expandTabsFrom(line, i, col);
}

// leadingSpaces(line): count of leading ' ' and '\t' characters (not columns).
function leadingSpaces(line) {
  let i = 0;
  while (i < line.length && (line.charCodeAt(i) === 32 || line.charCodeAt(i) === 9)) i++;
  return i;
}

// ---- inline parsing -------------------------------------------------------
// Token kinds: 0 text (raw), 1 delimiter, 2 code (escaped HTML), 3 raw html,
// 4 hard break, 5 entity (final string), 6 link, 7 image.
// A link token carries html (its rendered text) and plain (its alt-style
// plain text); an image token carries alt (plain) and plain (= alt).

function makeDelim(c, n, canOpen, canClose, nx, pv) {
  return { k: 1, c, n, canOpen, canClose, openTags: null, closeTags: null, dead: false, nx, pv };
}

// Flanking for a delimiter run: prev is the code unit before the run
// (or -1), next is the code unit after it (or -1).
function flanking(prev, next) {
  const prevSpace = prev === -1 ? true : isSpaceCode(prev);
  const nextSpace = next === -1 ? true : isSpaceCode(next);
  const prevPunct = prev === -1 ? false : isPunctCode(prev);
  const nextPunct = next === -1 ? false : isPunctCode(next);
  const left = !nextSpace && (!nextPunct || prevSpace || prevPunct);
  const right = !prevSpace && (!prevPunct || nextSpace || nextPunct);
  return { left, right };
}

function delimCanOpenClose(ch, prev, next) {
  const f = flanking(prev, next);
  if (ch === '_') {
    return {
      canOpen: f.left && (!f.right || (prev !== -1 && isPunctCode(prev))),
      canClose: f.right && (!f.left || (next !== -1 && isPunctCode(next))),
    };
  }
  return { canOpen: f.left, canClose: f.right };
}

// findCodeClose(s, from, m): index just past the closing run of exactly m
// backticks, or -1. Runs of other lengths do not close the span.
function findCodeClose(s, from, m) {
  let i = from;
  const n = s.length;
  while (i < n) {
    if (s.charCodeAt(i) === 96) {
      let j = i;
      while (j < n && s.charCodeAt(j) === 96) j++;
      if (j - i === m) return j;
      i = j;
    } else {
      i++;
    }
  }
  return -1;
}

// findRefLabelEnd(s, start): index of the ']' closing a reference label
// starting after the '[' at start-1. A reference label may not contain an
// unescaped '[' (unlike a link-text label, which may nest balanced
// brackets). -1 when there is none or a '[' intervenes.
function findRefLabelEnd(s, start) {
  let i = start;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 92) { i += 2; continue; } // backslash escape
    if (c === 96) {
      let m = 0;
      while (i + m < n && s.charCodeAt(i + m) === 96) m++;
      const closeEnd = findCodeClose(s, i + m, m);
      if (closeEnd !== -1) {
        // A code span whose content holds a backtick only counts as
        // opaque when its closing run is immediately followed by the
        // label's ']'; otherwise the label is not a link label at all
        // (marked quirk: '[a `` x ` y `` b](u)' is not a link, but
        // '[x `` a ` b ``](u)' is).
        if (s.indexOf('`', i + m) !== -1 && s.indexOf('`', i + m) < closeEnd - m) {
          if (closeEnd >= n || s.charCodeAt(closeEnd) !== 93) return -1;
        }
        i = closeEnd;
        continue;
      }
      i += m;
      continue;
    }
    if (c === 60) { // '<': skip a whole autolink / HTML tag if it is one
      const hEnd = matchInlineHtml(s, i);
      if (hEnd !== -1) { i = hEnd; continue; }
      const a = tryAngleAutolink(s, i);
      if (a) { i = a.end; continue; }
      i++;
      continue;
    }
    if (c === 91) return -1; // nested '[': not a reference label
    if (c === 93) return i;
    i++;
  }
  return -1;
}

// labelHasUnclosedBacktick(label): true when the label holds a
// backtick run with no matching closer run of the same length later
// in the label (greedy code-span pairing: a run pairs with the next
// run of the same length). E.g. '[a ``b` c]' has two unclosed runs;
// '[a `b` c]' pairs into a code span and has none.
function labelHasUnclosedBacktick(label) {
  const open = new Map();
  let i = 0;
  const n = label.length;
  while (i < n) {
    const c = label.charCodeAt(i);
    if (c === 92) { i += 2; continue; }
    if (c === 96) {
      let m = 0;
      while (i + m < n && label.charCodeAt(i + m) === 96) m++;
      const cnt = open.get(m) || 0;
      if (cnt > 0) open.set(m, cnt - 1);
      else open.set(m, cnt + 1);
      i += m;
      continue;
    }
    i++;
  }
  for (const v of open.values()) if (v > 0) return true;
  return false;
}

// hasUnescapedOpenBracket(s): true when s contains a '[' that is not
// backslash-escaped.
function hasUnescapedOpenBracket(s) {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92) { i++; continue; }
    if (s.charCodeAt(i) === 91) return true;
  }
  return false;
}

// findLabelEnd(s, start): index of the ']' balancing the '[' at start-1,
// honouring backslash escapes, code spans, and '<...>' autolinks / HTML
// tags (a ']' inside one of those does not close the label). -1 when none.
// labelBackticksValid(label): false when the label holds an unclosed
// backtick run AND either a code span was formed or it is the only
// run (the label-validity rule of findLabelEnd). Used to vet a
// candidate label end found inside a code span's content.
function labelBackticksValid(label) {
  const open = new Map();
  let spans = 0;
  let i = 0;
  const n = label.length;
  while (i < n) {
    const c = label.charCodeAt(i);
    if (c === 92) { i += 2; continue; }
    if (c === 96) {
      let m = 0;
      while (i + m < n && label.charCodeAt(i + m) === 96) m++;
      const cnt = open.get(m) || 0;
      if (cnt > 0) { open.set(m, cnt - 1); spans++; }
      else open.set(m, cnt + 1);
      i += m;
      continue;
    }
    i++;
  }
  let unclosed = 0;
  for (const v of open.values()) unclosed += v;
  return !(unclosed > 0 && (spans > 0 || unclosed === 1));
}

function findLabelEnd(s, start) {
  let depth = 1;
  let i = start;
  const n = s.length;
  // Backtick-run accounting for the label-validity rule: a label is
  // not a link label when it holds an unclosed backtick run AND
  // either a code span was formed or it is the only run
  // ('[a `b](c)' and '[a `b`c`d](u)' are not links, but
  // '[a ``b` c](u)' — two unclosed runs of different lengths, no
  // code span — is). Runs are counted as they are scanned.
  let spansFormed = 0;
  let unclosedRuns = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 92) { i += 2; continue; } // backslash escape
    if (c === 96) {
      let m = 0;
      while (i + m < n && s.charCodeAt(i + m) === 96) m++;
      const closeEnd = findCodeClose(s, i + m, m);
      if (closeEnd !== -1) {
        // If a ']' at the current depth appears before the closing
        // run and the closing run is on a later line than that ']',
        // or an unescaped '[' appears between that ']' and the
        // closing run, the code span does not contain the ']': the
        // ']' ends the label (e.g. '[run ``response`][ref]' — the
        // lone '`' after 'response' would otherwise swallow the ']'
        // to a far close; '[values ``guide` in](#should)' — the
        // lone '`' after 'guide' would swallow it to '`a_b`').
        // A ']' on the same line as the close, with no '[' between,
        // stays inside the code span (e.g. '[not a `link](/foo`)',
        // '[a `b](c` d](u)').
        let j = i + m;
        let d = depth;
        let labelEnd = -1;
        let hasOpenAfter = false;
        let hasNewlineAfter = false;
        while (j < closeEnd) {
          const cc = s.charCodeAt(j);
          if (cc === 92) { j += 2; continue; }
          if (cc === 10) { if (labelEnd !== -1) hasNewlineAfter = true; j++; continue; }
          if (cc === 91) { d++; if (labelEnd !== -1) hasOpenAfter = true; j++; continue; }
          if (cc === 93) {
            d--;
            if (d === 0 && labelEnd === -1) { labelEnd = j; j++; continue; }
            j++;
            continue;
          }
          j++;
        }
        if (labelEnd !== -1) {
          // The ']' ends the label when the code span does not contain
          // it: a newline or an unescaped '[' follows it and the next
          // char is '(', or the ']' is followed by a complete inline
          // link tail ('(...)') that ends before the closing run
          // ('[a ``b` c](u) *em* `f`' — the lone '`' after 'b' would
          // otherwise swallow the ']' to the '`' before 'f').
          // A ']' whose tail is incomplete before the close stays
          // inside the code span ('[a `b](c` d](u)'). And the label
          // prefix itself must be backtick-valid: '[a `b](c) `x`'
          // has a single unclosed run, so its ']' is not a label end
          // even though a complete tail follows it.
          if (!labelBackticksValid(s.slice(start, labelEnd))) {
            // fall through: the code span swallows the ']'
          } else if (hasNewlineAfter) return labelEnd;
          else if (hasOpenAfter && s.charCodeAt(labelEnd + 1) === 40) return labelEnd;
          else if (s.charCodeAt(labelEnd + 1) === 40) {
            const tail = parseInlineLinkTail(s, labelEnd + 1);
            // The tail must end strictly before the closing run, with
            // content between its ')' and the closer: when the tail
            // ends exactly at the closer ('[foo`](/uri)`'), the ']'
            // is the code span's own content, not a label end.
            if (tail && tail.end < closeEnd - m) return labelEnd;
          }
        }
        // A code span whose content holds a backtick only counts as
        // opaque when its closing run is immediately followed by the
        // label's ']'; otherwise the label is not a link label at all
        // (marked quirk: '[a `` x ` y `` b](u)' is not a link, but
        // '[x `` a ` b ``](u)' is).
        if (s.indexOf('`', i + m) !== -1 && s.indexOf('`', i + m) < closeEnd - m) {
          if (closeEnd >= n || s.charCodeAt(closeEnd) !== 93) return -1;
        }
        spansFormed++;
        i = closeEnd;
        continue;
      }
      unclosedRuns++;
      i += m;
      continue;
    }
    if (c === 60) { // '<': skip a whole autolink / HTML tag if it is one
      const hEnd = matchInlineHtml(s, i);
      if (hEnd !== -1) { i = hEnd; continue; }
      const a = tryAngleAutolink(s, i);
      if (a) { i = a.end; continue; }
      i++;
      continue;
    }
    if (c === 91) depth++;
    else if (c === 93) {
      depth--;
      if (depth === 0) {
        if (unclosedRuns > 0 && (spansFormed > 0 || unclosedRuns === 1)) return -1;
        return i;
      }
    }
    i++;
  }
  return -1;
}

// findBracketClose(s, start): lenient ']' finder for a failed link
// label — skips code spans and backslash escapes, counts '[' / ']'
// depth, but does NOT apply the code-span-backtick rule. Used only to
// locate the label region of a failed inline-link attempt so emphasis
// inside it can be suppressed.
function findBracketClose(s, start) {
  let depth = 1;
  let i = start;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 92) { i += 2; continue; }
    if (c === 96) {
      let m = 0;
      while (i + m < n && s.charCodeAt(i + m) === 96) m++;
      const closeEnd = findCodeClose(s, i + m, m);
      if (closeEnd !== -1) { i = closeEnd; continue; }
      i += m;
      continue;
    }
    if (c === 91) depth++;
    else if (c === 93) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function skipInlineSpace(s, i) {
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10) i++;
    else break;
  }
  return i;
}

// parseInlineLinkTail(s, pos): s[pos] is '('. Returns {dest, title, end}
// or null. dest/title are raw (backslash escapes resolved, entities kept).
function parseInlineLinkTail(s, pos) {
  const n = s.length;
  let i = skipInlineSpace(s, pos + 1);
  let dest = '';
  if (i < n && s.charCodeAt(i) === 60) { // '<...>'
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 62) break;
      if (c === 10) return null;
      if (c === 60) return null;
      if (c === 92 && j + 1 < n && isAsciiPunctCode(s.charCodeAt(j + 1))) {
        dest += s[j + 1];
        j += 2;
        continue;
      }
      dest += s[j];
      j++;
    }
    if (j >= n || s.charCodeAt(j) !== 62) return null;
    i = j + 1;
  } else {
    let depth = 0;
    let j = i;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 32 || c === 9 || c === 10 || c < 32) break;
      if (c === 92 && j + 1 < n && isAsciiPunctCode(s.charCodeAt(j + 1))) {
        dest += s[j + 1];
        j += 2;
        continue;
      }
      if (c === 40) { depth++; dest += s[j]; j++; continue; }
      if (c === 41) {
        if (depth === 0) break;
        depth--;
        dest += s[j];
        j++;
        continue;
      }
      dest += s[j];
      j++;
    }
    i = j;
  }
  i = skipInlineSpace(s, i);
  if (i < n && s.charCodeAt(i) === 41) return { dest, title: null, end: i + 1 };
  let title = '';
  const q = i < n ? s.charCodeAt(i) : -1;
  if (q === 34 || q === 39) { // "..." or '...'
    const qc = String.fromCharCode(q);
    let j = i + 1;
    while (j < n && s.charCodeAt(j) !== q) {
      if (s.charCodeAt(j) === 92 && j + 1 < n && isAsciiPunctCode(s.charCodeAt(j + 1))) {
        title += s[j + 1];
        j += 2;
        continue;
      }
      title += s[j];
      j++;
    }
    if (j >= n) return null;
    i = j + 1;
  } else if (q === 40) { // (...)
    let j = i + 1;
    while (j < n && s.charCodeAt(j) !== 41) {
      if (s.charCodeAt(j) === 92 && j + 1 < n && isAsciiPunctCode(s.charCodeAt(j + 1))) {
        title += s[j + 1];
        j += 2;
        continue;
      }
      title += s[j];
      j++;
    }
    if (j >= n) return null;
    i = j + 1;
  } else {
    return null;
  }
  i = skipInlineSpace(s, i);
  if (i >= n || s.charCodeAt(i) !== 41) return null;
  return { dest, title, end: i + 1 };
}

// normalizeLabel: collapse runs of whitespace to one space, trim, lowercase.
function normalizeLabel(label) {
  let out = '';
  let pendingSpace = false;
  let started = false;
  for (let i = 0; i < label.length; i++) {
    const c = label.charCodeAt(i);
    if (isSpaceCode(c)) {
      if (started) pendingSpace = true;
    } else {
      if (pendingSpace) { out += ' '; pendingSpace = false; }
      out += label[i];
      started = true;
    }
  }
  return caseFold(out);
}

// caseFold(s): Unicode case folding for label matching. toLowerCase
// handles single-character foldings; the multi-character full foldings
// (sharp s, Latin ligatures) are applied explicitly.
function caseFold(s) {
  return s.toLowerCase()
    .replace(/\u00df/g, 'ss')
    .replace(/\ufb00/g, 'ff').replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl')
    .replace(/\ufb03/g, 'ffi').replace(/\ufb04/g, 'ffl')
    .replace(/\ufb05/g, 'st').replace(/\ufb06/g, 'st');
}

// parseLinkAt(s, i, refs, noLinks, isImage): s[i] is '['.
// Returns {token, end} or null.
function parseLinkAt(s, i, refs, noLinks, isImage) {
  if (noLinks) return null;
  const close = findLabelEnd(s, i + 1);
  if (close === -1) return null;
  const labelRaw = s.slice(i + 1, close);
  if (labelRaw.length > 999) return null;
  let pos = close + 1;
  const next = s.charCodeAt(pos);
  if (next === 40) { // '(' inline link
    const tail = parseInlineLinkTail(s, pos);
    if (tail) return finishLink(labelRaw, tail.dest, tail.title, tail.end, refs, isImage);
    // An invalid inline tail falls through to the shortcut reference.
  }
  if (next === 91) { // '[' full / collapsed reference
    const close2 = findRefLabelEnd(s, pos + 1);
    if (close2 !== -1) {
      const refRaw = s.slice(pos + 1, close2);
      const key = normalizeLabel(refRaw === '' ? labelRaw : refRaw);
      if (key !== '') {
        const def = refs.get(key);
        if (def) return finishLink(labelRaw, def.dest, def.title, close2 + 1, refs, isImage);
      }
      // A well-formed reference label that is not defined: no shortcut
      // fallback.
      return null;
    }
    // No well-formed reference label: fall through to the shortcut.
  }
  // Shortcut reference: only when not followed by '(' or '[' (those pick
  // the inline / full-reference form, with no fallback), and the label
  // must not contain an unescaped '[' and must not be empty after
  // normalization.
  if (labelRaw !== '' && !hasUnescapedOpenBracket(labelRaw)) {
    const key = normalizeLabel(labelRaw);
    if (key !== '') {
      const def = refs.get(key);
      if (def) return finishLink(labelRaw, def.dest, def.title, close + 1, refs, isImage);
    }
  }
  return null;
}

function finishLink(labelRaw, dest, title, end, refs, isImage) {
  // Tokenize the label with links allowed but bare autolinks off: a
  // link whose label contains a REAL link is not a link at all (the
  // inner link wins). Angle autolinks inside a label do NOT block the
  // outer link (they nest inside it). Images may contain links in
  // their label (they render as plain text in the alt).
  const labelTokens = tokenizeInline(labelRaw, refs, false, true);
  if (!isImage) {
    for (const t of labelTokens) if (t.k === 6 && !t.angle) return null;
  }
  processEmphasis(labelTokens);
  const html = renderTokens(labelTokens);
  const plain = renderPlain(labelTokens);
  const href = escapeHref(dest);
  const titleAttr = title === null ? null : escapeText(title);
  if (isImage) return { token: { k: 7, src: href, title: titleAttr, alt: plain, plain }, end, labelRaw };
  return { token: { k: 6, href, title: titleAttr, html, plain }, end, labelRaw };
}

// ---- inline HTML ----------------------------------------------------------

function matchInlineHtml(s, i) {
  const n = s.length;
  if (s.charCodeAt(i + 1) === 33) { // '<!'
    if (s.startsWith('<!--', i)) {
      // '<!-->' and '<!--->' are complete comments on their own; the
      // closing '-->' is only sought for longer comments.
      if (s.charCodeAt(i + 4) === 62) return i + 5;
      if (s.startsWith('<!--->', i)) return i + 6;
      const j = s.indexOf('-->', i + 4);
      if (j === -1) return -1;
      return j + 3;
    }
    if (s.startsWith('<![CDATA[', i)) {
      const j = s.indexOf(']]>', i + 9);
      if (j === -1) return -1;
      return j + 3;
    }
    // declaration: '<!' + uppercase letter ... '>'
    const c = s.charCodeAt(i + 2);
    if (c >= 65 && c <= 90) {
      const j = s.indexOf('>', i + 3);
      if (j === -1) return -1;
      return j + 1;
    }
    return -1;
  }
  if (s.charCodeAt(i + 1) === 63) { // '<?'
    const j = s.indexOf('?>', i + 2);
    if (j === -1) return -1;
    return j + 2;
  }
  // open or close tag
  let j = i + 1;
  const isClose = s.charCodeAt(j) === 47;
  if (isClose) j++; // '/'
  const nameStart = j;
  if (j >= n || !isAlnumCode(s.charCodeAt(j)) || !(s.charCodeAt(j) >= 65)) {
    // tag names start with a letter
    const c0 = j < n ? s.charCodeAt(j) : -1;
    if (!((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122))) return -1;
  }
  while (j < n) {
    const c = s.charCodeAt(j);
    if (isAlnumCode(c) || c === 45) j++;
    else break;
  }
  if (j === nameStart) return -1;
  // A closing tag takes no attributes and no self-closing slash: only
  // whitespace may follow the name before '>'.
  if (isClose) {
    let k = j;
    while (k < n && (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9 || s.charCodeAt(k) === 10)) k++;
    if (k < n && s.charCodeAt(k) === 62) return k + 1;
    return -1;
  }
  // attributes
  while (true) {
    // spaces
    let k = j;
    while (k < n && (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9 || s.charCodeAt(k) === 10)) k++;
    if (k >= n) return -1;
    const c = s.charCodeAt(k);
    if (c === 62) return k + 1; // '>'
    if (c === 47) { // '/' must be directly followed by '>'
      if (k + 1 < n && s.charCodeAt(k + 1) === 62) return k + 2;
      return -1;
    }
    if (k === j) return -1; // no space before the attribute: not a tag
    // attribute name
    j = k;
    const a0 = s.charCodeAt(j);
    if (!((a0 >= 65 && a0 <= 90) || (a0 >= 97 && a0 <= 122) || a0 === 95 || a0 === 58)) return -1;
    j++;
    while (j < n) {
      const ac = s.charCodeAt(j);
      if (isAlnumCode(ac) || ac === 95 || ac === 58 || ac === 46 || ac === 45) j++;
      else break;
    }
    // optional = value
    const nameEnd = j;
    k = j;
    while (k < n && (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9 || s.charCodeAt(k) === 10)) k++;
    if (k < n && s.charCodeAt(k) === 61) { // '='
      k++;
      while (k < n && (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9 || s.charCodeAt(k) === 10)) k++;
      if (k >= n) return -1;
      const vc = s.charCodeAt(k);
      if (vc === 34 || vc === 39) { // quoted value
        const q = vc;
        k++;
        while (k < n && s.charCodeAt(k) !== q) k++;
        if (k >= n) return -1;
        j = k + 1;
      } else { // unquoted value: no space, ", ', =, <, >, `
        const vstart = k;
        while (k < n) {
          const uc = s.charCodeAt(k);
          if (uc === 32 || uc === 9 || uc === 10 || uc === 34 || uc === 39 || uc === 61 || uc === 60 || uc === 62 || uc === 96) break;
          k++;
        }
        if (k === vstart) return -1;
        j = k;
      }
    } else {
      // No value: resume just after the attribute name so the next
      // attribute still sees the space that separates it.
      j = nameEnd;
    }
  }
}

// ---- autolinks ------------------------------------------------------------

// Trailing punctuation trimmed from an extended autolink match.
function isAutolinkTrailPunct(c) {
  return c === 63 || c === 33 || c === 46 || c === 44 || c === 58 || c === 59 ||
    c === 42 || c === 95 || c === 126 || c === 34 || c === 39;
}

// trimAutolinkEnd(s, a, b): trim the raw match s[a..b) per the GFM rules:
// drop an unmatched '(' and everything after it, then repeatedly drop
// trailing punctuation, unbalanced ')', and a trailing &name; entity.
function trimAutolinkEnd(s, a, b) {
  // unmatched '(' : cut at the first '(' that never closes
  let depth = 0;
  let cut = -1;
  for (let i = a; i < b; i++) {
    const c = s.charCodeAt(i);
    if (c === 40) { if (cut === -1) cut = i; depth++; }
    else if (c === 41) { if (depth > 0) { depth--; if (depth === 0) cut = -1; } }
  }
  if (depth > 0 && cut !== -1) b = cut;
  // trailing trims
  while (b > a) {
    const c = s.charCodeAt(b - 1);
    if (c === 41) { // trailing ')': trim only if it is NOT a group-closer
      // A ')' is a group-closer when a stack scan pairs it with a '(';
      // an unmatched ')' earlier in the path does not make this one
      // unmatched (e.g. '...page=4)](./docs/create.md)' keeps its final
      // ')', which closes the '(' before './docs').
      let depth = 0, matched = false;
      for (let i = a; i < b; i++) {
        const cc = s.charCodeAt(i);
        if (cc === 40) depth++;
        else if (cc === 41 && depth > 0) { depth--; if (i === b - 1) matched = true; }
      }
      if (!matched) { b--; continue; }
      break;
    }
    if (isAutolinkTrailPunct(c)) {
      if (c === 59) { // ';' preceded by an entity-like &name -> drop the entity
        let k = b - 2;
        while (k >= a) {
          const kc = s.charCodeAt(k);
          if (isAlnumCode(kc)) k--;
          else break;
        }
        if (k >= a && s.charCodeAt(k) === 38 && k > a) {
          // &name; with a letter start
          const nc = s.charCodeAt(k + 1);
          if ((nc >= 65 && nc <= 90) || (nc >= 97 && nc <= 122)) { b = k; continue; }
        }
      }
      b--;
      continue;
    }
    break;
  }
  return b;
}

// Path scan for extended autolinks: from i, consume chars that are not
// whitespace or '<', where '(' must open a balanced group (no nesting).
// Returns the end index.
function scanAutolinkPath(s, i) {
  const n = s.length;
  let j = i;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 60) break;
    if (c === 40) { // '(' needs a matching ')' with no parens inside
      let k = j + 1;
      let ok = false;
      while (k < n) {
        const kc = s.charCodeAt(k);
        if (kc === 41) { ok = true; break; }
        if (kc === 40 || kc === 32 || kc === 9 || kc === 10 || kc === 60) break;
        k++;
      }
      if (!ok) break;
      j = k + 1;
      continue;
    }
    j++;
  }
  return j;
}

function tryWwwAutolink(s, i, prevCode) {
  // preceding char must be start, whitespace, '(', '*', '_' or '~'
  if (i > 0) {
    const p = prevCode;
    if (!(p === 32 || p === 9 || p === 10 || p === 40 || p === 42 || p === 95 || p === 126)) return null;
  }
  if (s.slice(i, i + 4) !== 'www.') return null;
  let j = i + 4;
  const n = s.length;
  const first = j < n ? s.charCodeAt(j) : -1;
  if (!((first >= 48 && first <= 57) || (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95 || first === 45)) return null;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (isAlnumCode(c) || c === 95 || c === 45 || c === 46) j++;
    else break;
  }
  j = scanAutolinkPath(s, j);
  j = trimAutolinkEnd(s, i, j);
  if (j <= i + 4) return null;
  const text = s.slice(i, j);
  return { token: { k: 6, href: escapeHref('http://' + text), title: null, html: escapeText(text), plain: escapeText(text) }, end: j };
}

const SCHEME_AUTOLINKS = ['http://', 'https://', 'ftp://'];

function trySchemeAutolink(s, i) {
  const low = s.slice(i, i + 8).toLowerCase();
  let schemeLen = -1;
  for (const sch of SCHEME_AUTOLINKS) {
    if (low.startsWith(sch)) { schemeLen = sch.length; break; }
  }
  if (schemeLen === -1) return null;
  let j = scanAutolinkPath(s, i + schemeLen);
  j = trimAutolinkEnd(s, i, j);
  if (j <= i + schemeLen) return null;
  const text = s.slice(i, j);
  return { token: { k: 6, href: escapeHref(text), title: null, html: escapeText(text), plain: escapeText(text) }, end: j };
}

// Email local-part characters (GFM) — the full RFC atext set, used by
// angle autolinks.
function isEmailLocalCode(c) {
  return isAlnumCode(c) || c === 46 || c === 33 || c === 35 || c === 36 || c === 37 ||
    c === 38 || c === 39 || c === 42 || c === 43 || c === 47 || c === 61 || c === 63 ||
    c === 94 || c === 95 || c === 96 || c === 123 || c === 124 || c === 125 || c === 126 || c === 45;
}
// Bare-email local-part characters (GFM): exactly [A-Za-z0-9._+-].
function isBareEmailLocalCode(c) {
  return isAlnumCode(c) || c === 46 || c === 95 || c === 43 || c === 45;
}
function isEmailDomainCode(c) {
  return isAlnumCode(c) || c === 95 || c === 45 || c === 46;
}

// tryEmailAutolink(s, at): s[at] is '@'. Returns {token, end} or null.
// The match may start before `at` (local part) and, for a mailto:/xmpp:
// prefix, before that. May extend after the domain with one /segment
// for the scheme form only.
function tryEmailAutolink(s, at, textStart, hasUOpener) {
  const n = s.length;
  // The local part backtracks through the raw source (it may cross '_'
  // delimiter tokens); only bare-email local characters count, so the
  // scan stops at any other token boundary on its own.
  let localStart = at;
  while (localStart > 0) {
    const c = s.charCodeAt(localStart - 1);
    if (!isBareEmailLocalCode(c)) break;
    if (s.charCodeAt(localStart - 2) === 92) break; // escaped char: stop
    localStart--;
  }
  if (localStart === at) return null;
  // Domain, parsed label by label: the first label is free (may start or
  // end with '-' or '_'); each later label must start and end with an
  // alphanumeric (or be a single alphanumeric). A later label that
  // fails ends the domain before it; fewer than two labels is no email.
  let j = at + 1;
  if (j >= n || !isEmailDomainCode(s.charCodeAt(j)) || s.charCodeAt(j) === 46) return null;
  const domStart = j;
  // First label: [A-Za-z0-9_-]+ (dots separate labels).
  while (j < n && isEmailDomainCode(s.charCodeAt(j)) && s.charCodeAt(j) !== 46) j++;
  let labels = 1;
  let end = j;
  while (end < n && s.charCodeAt(end) === 46) {
    let k = end + 1;
    while (k < n && isEmailDomainCode(s.charCodeAt(k)) && s.charCodeAt(k) !== 46) {
      // A '_' at a label boundary is an emphasis closer, not part of
      // the label, when an unmatched '_' opener exists; the label ends
      // at the last alphanumeric before it.
      if (s.charCodeAt(k) === 95 && hasUOpener && (k + 1 >= n || !isAlnumCode(s.charCodeAt(k + 1)))) break;
      k++;
    }
    if (k === end + 1) break; // empty label: domain ends before the dot
    const lab = s.slice(end + 1, k);
    const firstC = lab.charCodeAt(0);
    const lastC = lab.charCodeAt(lab.length - 1);
    if (!isAlnumCode(firstC) || !isAlnumCode(lastC)) break; // invalid label
    labels++;
    end = k;
  }
  if (labels < 2) return null;
  const domain = s.slice(domStart, end);
  // lowercase; any other case links only the email part.
  let start = localStart;
  let scheme = null;
  if (localStart >= 2 && s.charCodeAt(localStart - 1) === 58) {
    let k = localStart - 2;
    while (k >= 0) {
      const c = s.charCodeAt(k);
      if (isAlnumCode(c) || c === 43 || c === 46 || c === 45) k--;
      else break;
    }
    const word = s.slice(k + 1, localStart - 1);
    if (word === 'mailto' || word === 'xmpp') {
      scheme = word;
      start = k + 1;
    }
  }
  const emailText = s.slice(localStart, end);
  let text, href;
  if (scheme) {
    // mailto: takes no path; xmpp: takes one /segment of [A-Za-z0-9.@]
    // with trailing dots trimmed.
    let segEnd = end;
    if (scheme === 'xmpp' && end < n && s.charCodeAt(end) === 47) {
      let p = end + 1;
      while (p < n) {
        const c = s.charCodeAt(p);
        if (isAlnumCode(c) || c === 46 || c === 64) p++;
        else break;
      }
      while (p > end + 1 && s.charCodeAt(p - 1) === 46) p--;
      if (p > end + 1) segEnd = p;
    }
    text = s.slice(start, segEnd);
    href = escapeHref(text);
    return { token: { k: 6, href, title: null, html: escapeText(text), plain: escapeText(text) }, end: segEnd, start };
  }
  text = emailText;
  href = escapeHref('mailto:' + text);
  return { token: { k: 6, href, title: null, html: escapeText(text), plain: escapeText(text) }, end, start };
}

// ---- angle autolinks ------------------------------------------------------

function tryAngleAutolink(s, i) {
  const n = s.length;
  let j = i + 1;
  // scheme: [a-zA-Z][a-zA-Z0-9+.-]{1,31} ':' ...
  if (j < n) {
    const c0 = s.charCodeAt(j);
    if ((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122)) {
      let k = j + 1;
      while (k < n && k - j <= 32) {
        const c = s.charCodeAt(k);
        if (isAlnumCode(c) || c === 43 || c === 46 || c === 45) k++;
        else break;
      }
      if (k - j >= 2 && k - j <= 32 && k < n && s.charCodeAt(k) === 58) {
        let m = k + 1;
        while (m < n) {
          const c = s.charCodeAt(m);
          if (c === 32 || c === 9 || c === 10 || c < 32 || c === 60 || c === 62) break;
          m++;
        }
        if (m < n && s.charCodeAt(m) === 62 && m > k + 1) {
          const dest = s.slice(i + 1, m);
          return { token: { k: 6, href: escapeHref(dest), title: null, html: escapeText(dest), plain: escapeText(dest), angle: true }, end: m + 1 };
        }
      }
    }
  }
  // email: local@domain
  let k = i + 1;
  let at = -1;
  while (k < n) {
    const c = s.charCodeAt(k);
    if (c === 62) break;
    if (c === 32 || c === 9 || c === 10 || c < 32 || c === 60) return null;
    if (c === 64) { at = k; break; }
    k++;
  }
  if (at === -1) return null;
  const local = s.slice(i + 1, at);
  if (local.length === 0) return null;
  for (let t = 0; t < local.length; t++) if (!isEmailLocalCode(local.charCodeAt(t))) return null;
  let m = at + 1;
  const domStart = m;
  while (m < n) {
    const c = s.charCodeAt(m);
    if (c === 62) break;
    if (c === 32 || c === 9 || c === 10 || c < 32 || c === 60) return null;
    m++;
  }
  if (m >= n || s.charCodeAt(m) !== 62) return null;
  const domain = s.slice(domStart, m);
  if (domain.length === 0) return null;
  // CommonMark email regex for angle autolinks
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(domain)) return null;
  const dest = s.slice(i + 1, m);
  return { token: { k: 6, href: escapeHref('mailto:' + dest), title: null, html: escapeText(dest), plain: escapeText(dest), angle: true }, end: m + 1 };
}

// ---- the inline scanner ---------------------------------------------------

// noBare: when true, bare autolinks (www / scheme / email) are NOT
// formed (they are plain text) — used for link labels, where only real
// links and angle autolinks count as nested links. Angle autolinks
// always run, even in labels.
function tokenizeInline(src, refs, noLinks, noBare) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  let textStart = 0;
  // noEmphEnd: index just past the ']' of a failed inline-link label.
  // Emphasis delimiters before it are literal text (a failed '[...](...)'
  // attempt suppresses emphasis in its label).
  let noEmphEnd = -1;
  // suppressEmphUntil: index of the next backtick after a link whose
  // label holds an unclosed backtick run. Emphasis delimiters before
  // it are literal text: the unclosed '`' in the label pairs with
  // that later backtick as a code span, swallowing the emphasis
  // ('[a ``b` c](u) *em* [d `e`](v)' leaves '*em*' literal, but
  // '*em2*' after the code span forms). Set only when a later
  // backtick exists; a link with no later backtick suppresses nothing.
  let suppressEmphUntil = -1;
  const flush = (to) => {
    if (to > textStart) tokens.push({ k: 0, s: src.slice(textStart, to) });
  };
  while (i < n) {
    const c = src.charCodeAt(i);
    if (c === 92) { // backslash
      const nx = i + 1 < n ? src.charCodeAt(i + 1) : -1;
      if (nx === 10) { // backslash + newline: hard break
        flush(i);
        tokens.push({ k: 4 });
        i += 2;
        // A hard break strips the next line's leading spaces/tabs.
        while (i < n && (src.charCodeAt(i) === 32 || src.charCodeAt(i) === 9)) i++;
        textStart = i;
        continue;
      }
      if (nx !== -1 && isAsciiPunctCode(nx)) {
        flush(i);
        tokens.push({ k: 0, s: src[i + 1] });
        i += 2;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 10) { // newline: hard break if 2+ trailing spaces
      let sp = 0;
      let k = i - 1;
      while (k >= textStart && src.charCodeAt(k) === 32) { sp++; k--; }
      if (sp >= 2) {
        flush(i - sp);
        tokens.push({ k: 4 });
        i++;
        // A hard break strips the next line's leading spaces/tabs.
        while (i < n && (src.charCodeAt(i) === 32 || src.charCodeAt(i) === 9)) i++;
        textStart = i;
      } else {
        i++;
      }
      continue;
    }
    if (c === 96) { // backtick run: code span
      let m = 0;
      while (i + m < n && src.charCodeAt(i + m) === 96) m++;
      const closeEnd = findCodeClose(src, i + m, m);
      if (closeEnd !== -1) {
        let content = src.slice(i + m, closeEnd - m);
        if (content.includes('\n')) content = content.replace(/\n/g, ' ');
        if (content.length >= 2 && content.charCodeAt(0) === 32 &&
          content.charCodeAt(content.length - 1) === 32 && content.trim() !== '') {
          content = content.slice(1, -1);
        }
        flush(i);
        tokens.push({ k: 2, s: escapePlain(content, 0, content.length) });
        i = closeEnd;
        textStart = i;
        continue;
      }
      i += m;
      continue;
    }
    if (c === 42 || c === 95) { // '*' or '_'
      const ch = String.fromCharCode(c);
      let m = 0;
      while (i + m < n && src.charCodeAt(i + m) === c) m++;
      // Inside a failed inline-link label, emphasis delimiters are
      // literal text.
      if (i < noEmphEnd || i < suppressEmphUntil) { i += m; continue; }
      const prev = i > 0 ? src.charCodeAt(i - 1) : -1;
      const next = i + m < n ? src.charCodeAt(i + m) : -1;
      const { canOpen, canClose } = delimCanOpenClose(ch, prev, next);
      flush(i);
      tokens.push(makeDelim(ch, m, canOpen, canClose, next, prev));
      i += m;
      textStart = i;
      continue;
    }
    if (c === 126) { // '~' strikethrough: runs of 1-2 only
      let m = 0;
      while (i + m < n && src.charCodeAt(i + m) === 126) m++;
      if (m <= 2) {
        // Inside a failed inline-link label, strikethrough delimiters
        // are literal text.
        if (i < noEmphEnd || i < suppressEmphUntil) { i += m; continue; }
        const prev = i > 0 ? src.charCodeAt(i - 1) : -1;
        const next = i + m < n ? src.charCodeAt(i + m) : -1;
        const { canOpen, canClose } = delimCanOpenClose('~', prev, next);
        flush(i);
        tokens.push(makeDelim('~', m, canOpen, canClose, next, prev));
        i += m;
        textStart = i;
        continue;
      }
      i += m;
      continue;
    }
    if (c === 91 && !noLinks) { // '[' link
      const r = parseLinkAt(src, i, refs, false, false);
      if (r) {
        flush(i);
        tokens.push(r.token);
        i = r.end;
        textStart = i;
        // A link whose label holds an unclosed backtick run suppresses
        // emphasis until the next backtick (see suppressEmphUntil).
        if (r.labelRaw && labelHasUnclosedBacktick(r.labelRaw)) {
          const nx = src.indexOf('`', i);
          if (nx !== -1) suppressEmphUntil = nx;
        }
        continue;
      }
      // A failed inline-link attempt suppresses emphasis in its label,
      // but only for SYNTACTIC failures (no label end, or an invalid
      // tail). When the tail is valid and the link fails only on the
      // nested-link check, emphasis in the label is preserved (cm-519).
      let close = findLabelEnd(src, i + 1);
      if (close === -1) {
        close = findBracketClose(src, i + 1);
        if (close !== -1 && close + 1 < n && src.charCodeAt(close + 1) === 40) {
          noEmphEnd = close + 1;
        }
      } else if (close + 1 < n && src.charCodeAt(close + 1) === 40) {
        if (!parseInlineLinkTail(src, close + 1)) noEmphEnd = close + 1;
      }
      i++;
      continue;
    }
    if (c === 33 && i + 1 < n && src.charCodeAt(i + 1) === 91) { // '![ '
      const r = parseLinkAt(src, i + 1, refs, false, true);
      if (r) {
        flush(i);
        tokens.push(r.token);
        i = r.end;
        textStart = i;
        if (r.labelRaw && labelHasUnclosedBacktick(r.labelRaw)) {
          const nx = src.indexOf('`', i);
          if (nx !== -1) suppressEmphUntil = nx;
        }
        continue;
      }
      // A failed image-link attempt suppresses emphasis in its label,
      // same as a failed link (syntactic failures only; see above).
      let close = findLabelEnd(src, i + 2);
      if (close === -1) {
        close = findBracketClose(src, i + 2);
        if (close !== -1 && close + 1 < n && src.charCodeAt(close + 1) === 40) {
          noEmphEnd = close + 1;
        }
      } else if (close + 1 < n && src.charCodeAt(close + 1) === 40) {
        if (!parseInlineLinkTail(src, close + 1)) noEmphEnd = close + 1;
      }
      i++;
      continue;
    }
    if (c === 60) { // '<' autolink or raw html
      const a = tryAngleAutolink(src, i);
      if (a) {
        flush(i);
        tokens.push(a.token);
        i = a.end;
        textStart = i;
        continue;
      }
      const h = matchInlineHtml(src, i);
      if (h !== -1) {
        flush(i);
        tokens.push({ k: 3, s: src.slice(i, h) });
        i = h;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 38) { // '&' entity
      const e = entityAt(src, i);
      if (e) {
        flush(i);
        tokens.push({ k: 5, s: e.text });
        i = e.end;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (!noBare && c === 119 && src.charCodeAt(i + 1) === 119 && src.charCodeAt(i + 2) === 119 &&
      src.charCodeAt(i + 3) === 46) { // 'www.'
      const prev = i > 0 ? src.charCodeAt(i - 1) : -1;
      const r = tryWwwAutolink(src, i, prev);
      if (r) {
        flush(i);
        tokens.push(r.token);
        i = r.end;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (!noBare && (c === 104 || c === 72 || c === 102 || c === 70)) { // h/H/f/F scheme://
      const r = trySchemeAutolink(src, i);
      if (r) {
        flush(i);
        tokens.push(r.token);
        i = r.end;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 64 && !noBare) { // '@' email autolink (may backtrack into the text run)
      // An unmatched '_' opener earlier in this inline run means a '_'
      // at a domain-label boundary is an emphasis closer, not part of
      // the domain (e.g. '_used first@sprout.example.com_,').
      let hasUOpener = false;
      for (let t = 0; t < tokens.length; t++) {
        const tk = tokens[t];
        if (tk.k === 1 && tk.c === '_' && tk.canOpen && tk.n > 0) { hasUOpener = true; break; }
      }
      const r = tryEmailAutolink(src, i, textStart, hasUOpener);
      if (r) {
        const start = r.start !== undefined ? r.start : i;
        if (start < textStart) {
          // The local part reaches back across '_' delimiters (and the
          // text before them): unwind the tokens covering [start,
          // textStart) so the email swallows them.
          let need = textStart - start;
          while (need > 0 && tokens.length > 0) {
            const t = tokens[tokens.length - 1];
            if (t.k === 0) {
              const L = t.s.length;
              if (L <= need) { tokens.pop(); need -= L; }
              else { t.s = t.s.slice(0, L - need); need = 0; }
            } else if (t.k === 1 && t.c === '_') {
              if (t.n <= need) { tokens.pop(); need -= t.n; }
              else { t.n -= need; need = 0; }
            } else {
              break;
            }
          }
          textStart = start;
        } else {
          flush(start);
        }
        tokens.push(r.token);
        i = r.end;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    i++;
  }
  flush(n);
  return tokens;
}

// ---- emphasis -------------------------------------------------------------

function processEmphasis(tokens) {
  const stack = [];
  for (const t of tokens) if (t.k === 1) stack.push(t);
  if (stack.length === 0) return;
  const bottom = { '*': null, '_': null, '~': null };
  // Matched pairs as [openerIdx, closerIdx] in stack order. A delimiter
  // strictly inside a matched pair cannot open for a closer outside
  // that pair (it is trapped inside the emphasis it sits in).
  const matchedPairs = [];
  let i = 0;
  while (i < stack.length) {
    const closer = stack[i];
    if (closer.n === 0 || !closer.canClose) { i++; continue; }
    let oi = -1;
    for (let j = i - 1; j >= 0; j--) {
      const o = stack[j];
      if (o === bottom[closer.c]) break;
      if (o.c !== closer.c || o.n === 0 || o.dead || !o.canOpen) continue;
      // Trapped inside a matched pair whose closer precedes this one.
      let trapped = false;
      for (let p = 0; p < matchedPairs.length; p++) {
        const pr = matchedPairs[p];
        if (pr[1] < i && pr[0] < j && j < pr[1]) { trapped = true; break; }
      }
      if (trapped) continue;
      // Odd-match rule: if either delimiter can both open and close,
      // the sum of the run lengths must not be a multiple of 3 unless
      // both lengths are multiples of 3. A blocked opener is skipped
      // and the look-back continues to earlier openers.
      const sum3 = (o.n + closer.n) % 3 === 0 && !(o.n % 3 === 0 && closer.n % 3 === 0);
      if (((o.canOpen && o.canClose) || (closer.canOpen && closer.canClose)) && sum3) continue;
      // Intervening-pair rule: if the sum is a multiple of 3 and a
      // matched pair sits strictly between this opener and the closer
      // whose closer can open, the match is blocked and the look-back
      // stops (the closer cannot skip past the blocked opener).
      // This is what keeps '**a *b*c* d**' from matching the outer
      // '*' across the inner '<em>b</em>' pair. It only blocks when
      // the opener run still has length >= 2: '*a *b*c**' (opener
      // length 1) DOES form the outer '<em>' across the inner pair,
      // while '**a *b*c*' (opener length 2) does not.
      if (sum3 && o.n >= 2) {
        let intervening = false;
        for (let p = 0; p < matchedPairs.length; p++) {
          const pr = matchedPairs[p];
          if (pr[0] > j && pr[1] < i && stack[pr[0]].c === closer.c && stack[pr[1]].canOpen) { intervening = true; break; }
        }
        if (intervening) break;
      }
      // Pair block: an intervening matched pair of the same delimiter
      // char, adjacent to this closer (the nearest matched pair
      // strictly between opener and closer), blocks the match when
      // the pair is isolated on the left (the char before its opener
      // is not alphanumeric, '~' or '*') and attached on the right
      // (the char after its closer is alphanumeric or '~'):
      //  - a STRONG pair blocks an EMPHASIS (use=1) match
      //    ('*a **b**c*' stays literal; '*a **b** c*' and
      //    '*foo**bar**baz*' form '<em>'; a nearer emphasis pair
      //    ('*a **b**c*d*e*') unblocks it). A STRONG outer match is
      //    never blocked by a strong pair.
      //  - an EMPHASIS pair blocks an EMPHASIS match when the outer
      //    opener still has length >= 2 ('**a *b*c*' and
      //    '***a *b*c*' stay literal; '*a *b*c*' and '*a *b*c**'
      //    with opener length 1 form '<em>').
      //  - an EMPHASIS pair blocks a STRONG (use=2) match when the
      //    outer closer is fully consumed (length == use) and the
      //    pair's closer is the delimiter immediately before this
      //    closer ('**a *b*c**' stays literal; '**a*b*c**' forms
      //    '<strong>' because the pair is not isolated, and
      //    '**a *b*c* d**' forms '<strong>' because an unmatched '*'
      //    sits between the pair and the closing '**').
      {
        const use = (o.n >= 2 && closer.n >= 2) ? 2 : 1;
        let nearest = -1;
        let nearestClose = -1;
        for (let p = 0; p < matchedPairs.length; p++) {
          const pr = matchedPairs[p];
          if (pr[0] > j && pr[1] < i && pr[1] > nearestClose) { nearest = p; nearestClose = pr[1]; }
        }
        if (nearest !== -1) {
          const pr = matchedPairs[nearest];
          if (stack[pr[0]].c === closer.c) {
            const nx = stack[pr[1]].nx;
            const pv = stack[pr[0]].pv;
            const isAlnum = (x) => (x >= 48 && x <= 57) || (x >= 65 && x <= 90) || (x >= 97 && x <= 122) || (x >= 128 && /[\p{L}\p{N}]/u.test(String.fromCharCode(x)));
            const rightAttached = nx === 126 || isAlnum(nx);
            const leftIsolated = !(pv === 126 || pv === 42 || isAlnum(pv));
            if (rightAttached && leftIsolated) {
              if (use === 1 && pr[2] === 2) break;
              if (use === 1 && pr[2] === 1 && o.n >= 2) break;
              if (use === 2 && pr[2] === 1 && closer.n === 2 && pr[1] === i - 1) break;
            }
          }
        }
      }
      oi = j;
      break;
    }
    if (oi === -1) {
      // No opener found. A closer that can also open stays in the stack
      // as a potential opener for a later closer (it must NOT become the
      // bottom, or it could never open); one that cannot open is dead.
      if (!closer.canOpen) closer.dead = true;
      i++;
      continue;
    }
    const opener = stack[oi];
    const use = (opener.n >= 2 && closer.n >= 2) ? 2 : 1;
    const tag = closer.c === '~' ? 'del' : use === 2 ? 'strong' : 'em';
    if (opener.openTags === null) opener.openTags = [];
    if (closer.closeTags === null) closer.closeTags = [];
    opener.openTags.push(tag);
    closer.closeTags.push(tag);
    opener.n -= use;
    closer.n -= use;
    matchedPairs.push([oi, i, use]);
    // same closer may match another opener: do not advance
  }
}

// ---- rendering ------------------------------------------------------------

function renderTokens(tokens) {
  let out = '';
  for (const t of tokens) {
    if (t.k === 0) out += escapeText(t.s);
    else if (t.k === 1) {
      if (t.closeTags !== null) for (const tag of t.closeTags) out += '</' + tag + '>';
      if (t.n > 0) out += t.c.repeat(t.n);
      if (t.openTags !== null) for (let x = t.openTags.length - 1; x >= 0; x--) out += '<' + t.openTags[x] + '>';
    } else if (t.k === 2) out += '<code>' + t.s + '</code>';
    else if (t.k === 3) out += t.s;
    else if (t.k === 4) out += '<br>';
    else if (t.k === 5) out += t.s;
    else if (t.k === 6) {
      out += '<a href="' + t.href + '"';
      if (t.title !== null) out += ' title="' + t.title + '"';
      out += '>' + t.html + '</a>';
    } else if (t.k === 7) {
      out += '<img src="' + t.src + '" alt="' + t.alt + '"';
      if (t.title !== null) out += ' title="' + t.title + '"';
      out += '>';
    }
  }
  return out;
}

// renderPlain: the label text of an image, with markup dropped and HTML
// tags escaped rather than passed through.
function renderPlain(tokens) {
  let out = '';
  for (const t of tokens) {
    if (t.k === 0) out += escapeText(t.s);
    else if (t.k === 1) {
      if (t.n > 0) out += t.c.repeat(t.n);
    } else if (t.k === 2) out += t.s;
    else if (t.k === 3) out += escapeText(t.s);
    else if (t.k === 4) out += '';
    else if (t.k === 5) out += t.s;
    else if (t.k === 6) out += t.plain;
    else if (t.k === 7) out += t.alt;
  }
  return out;
}

// inline(src, refs): render a paragraph/heading/table-cell string.
function inline(src, refs) {
  if (src.length === 0) return '';
  const tokens = tokenizeInline(src, refs, false);
  processEmphasis(tokens);
  return renderTokens(tokens);
}

// ---- block parsing --------------------------------------------------------

// trimSpaces(s): trim ASCII spaces and tabs from both ends.
function trimSpaces(s) {
  let a = 0;
  let b = s.length;
  while (a < b && (s.charCodeAt(a) === 32 || s.charCodeAt(a) === 9)) a++;
  while (b > a && (s.charCodeAt(b - 1) === 32 || s.charCodeAt(b - 1) === 9)) b--;
  return s.slice(a, b);
}

// ---- link reference definitions -------------------------------------------
// tryDef(lines, i, hi): parse a definition starting at line i (it may span
// lines, but never a blank line). Returns {key, dest, title, lines} or null.
// countLines(s, end): number of lines in s[0..end) (1 + newlines before end).
function countLines(s, end) {
  let n = 1;
  for (let t = 0; t < end; t++) if (s.charCodeAt(t) === 10) n++;
  return n;
}

function tryDef(lines, i, hi) {
  // Quick check on the first line: a definition starts with '[' after at
  // most 3 spaces (a tab means indented code). This avoids joining lines
  // for the many block starts that cannot be definitions.
  const first = lines[i];
  let ind0 = 0;
  while (ind0 < first.length && first.charCodeAt(ind0) === 32 && ind0 < 4) ind0++;
  if (ind0 >= 4 || ind0 >= first.length) return null;
  if (first.charCodeAt(ind0) === 9) return null;
  if (first.charCodeAt(ind0) !== 91) return null;
  // A definition may span lines (a multi-line label or title), but never
  // a blank line.
  let joined = first;
  let count = 1;
  for (let k = i + 1; k < hi && count < 10; k++) {
    if (isBlankLine(lines[k])) break;
    joined += '\n' + lines[k];
    count++;
  }
  let p = 0;
  let ind = 0;
  while (p < joined.length && joined.charCodeAt(p) === 32 && ind < 4) { ind++; p++; }
  if (ind >= 4 || p >= joined.length) return null;
  if (joined.charCodeAt(p) === 9) return null;
  if (joined.charCodeAt(p) !== 91) return null; // '['
  const close = findRefLabelEnd(joined, p + 1);
  if (close === -1) return null;
  const labelRaw = joined.slice(p + 1, close);
  if (labelRaw.length === 0 || labelRaw.length > 999) return null;
  // A definition label may not be empty after normalization.
  if (normalizeLabel(labelRaw) === '') return null;
  p = close + 1;
  if (joined.charCodeAt(p) !== 58) return null; // ':'
  p++;
  p = skipInlineSpace(joined, p);
  if (p >= joined.length) return null;
  let dest = '';
  let angleDest = false;
  if (joined.charCodeAt(p) === 60) { // '<...>'
    angleDest = true;
    let j = p + 1;
    while (j < joined.length) {
      const c = joined.charCodeAt(j);
      if (c === 62) break;
      if (c === 10 || c === 60) return null;
      if (c === 92 && j + 1 < joined.length && isAsciiPunctCode(joined.charCodeAt(j + 1))) {
        dest += joined[j + 1];
        j += 2;
        continue;
      }
      dest += joined[j];
      j++;
    }
    if (j >= joined.length || joined.charCodeAt(j) !== 62) return null;
    p = j + 1;
  } else {
    let depth = 0;
    let j = p;
    while (j < joined.length) {
      const c = joined.charCodeAt(j);
      if (c === 32 || c === 9 || c === 10 || c < 32) break;
      if (c === 92 && j + 1 < joined.length && isAsciiPunctCode(joined.charCodeAt(j + 1))) {
        dest += joined[j + 1];
        j += 2;
        continue;
      }
      if (c === 40) { depth++; dest += joined[j]; j++; continue; }
      if (c === 41) {
        if (depth === 0) break;
        depth--;
        dest += joined[j];
        j++;
        continue;
      }
      dest += joined[j];
      j++;
    }
    p = j;
  }
  if (!angleDest && dest.length === 0) return null;
  const destEnd = p;
  const destLines = countLines(joined, destEnd);
  const key = normalizeLabel(labelRaw);
  const destOnly = { key, dest, title: null, lines: destLines };
  // Optional title: skip whitespace (spaces, tabs, newlines) after the dest.
  const t = skipInlineSpace(joined, destEnd);
  if (t >= joined.length) return destOnly;
  const qc = joined.charCodeAt(t);
  if (qc === 34 || qc === 39 || qc === 40) {
    // A title must be preceded by whitespace.
    if (t === destEnd) return null;
    const titleLaterLine = joined.slice(destEnd, t).indexOf('\n') !== -1;
    let title = '';
    let u;
    if (qc === 40) { // (...) title ends at the first ')'
      u = t + 1;
      while (u < joined.length && joined.charCodeAt(u) !== 41) {
        if (joined.charCodeAt(u) === 92 && u + 1 < joined.length && isAsciiPunctCode(joined.charCodeAt(u + 1))) {
          title += joined[u + 1];
          u += 2;
          continue;
        }
        title += joined[u];
        u++;
      }
      if (u >= joined.length) return titleLaterLine ? destOnly : null;
      u++;
    } else { // "..." or '...'
      u = t + 1;
      while (u < joined.length && joined.charCodeAt(u) !== qc) {
        if (joined.charCodeAt(u) === 92 && u + 1 < joined.length && isAsciiPunctCode(joined.charCodeAt(u + 1))) {
          title += joined[u + 1];
          u += 2;
          continue;
        }
        title += joined[u];
        u++;
      }
      if (u >= joined.length) return titleLaterLine ? destOnly : null;
      u++;
    }
    // Only spaces/tabs may follow the title on its line.
    let v = u;
    while (v < joined.length && (joined.charCodeAt(v) === 32 || joined.charCodeAt(v) === 9)) v++;
    if (v >= joined.length || joined.charCodeAt(v) === 10) {
      return { key, dest, title, lines: countLines(joined, v) };
    }
    // Junk after the title: the definition is just the destination when
    // the title was on a later line, otherwise there is no definition.
    return titleLaterLine ? destOnly : null;
  }
  // No title: the destination's line must end cleanly (spaces/tabs, then
  // newline or end). Text on a later line is not part of the definition.
  let v = destEnd;
  while (v < joined.length && (joined.charCodeAt(v) === 32 || joined.charCodeAt(v) === 9)) v++;
  if (v >= joined.length || joined.charCodeAt(v) === 10) return destOnly;
  return null;
}

// ---- block matchers -------------------------------------------------------

function matchATX(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length || line.charCodeAt(i) !== 35) return null;
  let level = 0;
  while (i + level < line.length && line.charCodeAt(i + level) === 35) level++;
  if (level > 6) return null;
  const after = i + level;
  if (after < line.length) {
    const c = line.charCodeAt(after);
    if (c !== 32 && c !== 9) return null;
  }
  let text = line.slice(after);
  text = text.replace(/[ \t]+#+[ \t]*$/, '');
  text = trimSpaces(text);
  return { level, text };
}

function matchFence(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length) return null;
  const ch = line.charCodeAt(i);
  if (ch !== 96 && ch !== 126) return null;
  let len = 0;
  while (i + len < line.length && line.charCodeAt(i + len) === ch) len++;
  if (len < 3) return null;
  const info = line.slice(i + len);
  if (ch === 96 && info.includes('`')) return null;
  return { ch, len, indent: i, info: trimSpaces(info) };
}

function isFenceClose(line, fence) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length || line.charCodeAt(i) !== fence.ch) return false;
  let len = 0;
  while (i + len < line.length && line.charCodeAt(i + len) === fence.ch) len++;
  if (len < fence.len) return false;
  for (let k = i + len; k < line.length; k++) {
    const c = line.charCodeAt(k);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

function isThematicBreak(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length) return false;
  const ch = line.charCodeAt(i);
  if (ch !== 42 && ch !== 45 && ch !== 95) return false;
  let count = 0;
  for (let j = i; j < line.length; j++) {
    const c = line.charCodeAt(j);
    if (c === ch) count++;
    else if (c !== 32 && c !== 9) return false;
  }
  return count >= 3;
}

function isSetextUnderline(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length) return false;
  const ch = line.charCodeAt(i);
  if (ch !== 61 && ch !== 45) return false;
  let j = i;
  while (j < line.length && line.charCodeAt(j) === ch) j++;
  while (j < line.length && (line.charCodeAt(j) === 32 || line.charCodeAt(j) === 9)) j++;
  return j === line.length;
}

function setextLevel(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32) i++;
  return line.charCodeAt(i) === 61 ? 1 : 2;
}

// stripQuotePrefix(line): remove a '>' marker (up to 3 leading spaces, then
// '>', then one optional space). The remainder's leading tabs expand to
// spaces based on their original columns. Returns the rest, or null.
function stripQuotePrefix(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length || line.charCodeAt(i) !== 62) return null;
  i++;
  if (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32) i++;
    else if (c === 9) {
      // consume 1 column of the tab; the rest stays as spaces
      const w = 4 - (i % 4);
      return ' '.repeat(w - 1) + expandTabsFrom(line, i + 1, i + w);
    }
  }
  return expandTabsFrom(line, i, i);
}

// matchListMarker(line): returns null or
// {type, bullet|delim, num, indent, markerWidth, contentIndent}
function matchListMarker(line) {
  let i = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && i < 3) i++;
  if (i >= line.length) return null;
  const indent = i;
  const c = line.charCodeAt(i);
  let markerWidth;
  let type;
  let bullet = null;
  let delim = null;
  let num = 0;
  if (c === 42 || c === 45 || c === 43) {
    type = 'bullet';
    bullet = String.fromCharCode(c);
    markerWidth = 1;
  } else if (c >= 48 && c <= 57) {
    let j = i;
    while (j < line.length && line.charCodeAt(j) >= 48 && line.charCodeAt(j) <= 57) j++;
    if (j - i > 9) return null;
    const d = j < line.length ? line.charCodeAt(j) : -1;
    if (d !== 46 && d !== 41) return null;
    type = 'ordered';
    delim = String.fromCharCode(d);
    num = parseInt(line.slice(i, j), 10);
    markerWidth = (j - i) + 1;
  } else {
    return null;
  }
  const after = i + markerWidth;
  if (after >= line.length) {
    return { type, bullet, delim, num, indent, markerWidth, contentIndent: indent + markerWidth + 1, empty: true };
  }
  const nc = line.charCodeAt(after);
  if (nc !== 32 && nc !== 9) return null;
  // spaces after the marker, in columns (tabs to the next stop)
  let col = indent + markerWidth;
  let k = after;
  while (k < line.length) {
    const cc = line.charCodeAt(k);
    if (cc === 32) { col++; k++; }
    else if (cc === 9) { col += 4 - (col % 4); k++; }
    else break;
  }
  const spaces = col - (indent + markerWidth);
  if (k >= line.length) {
    return { type, bullet, delim, num, indent, markerWidth, contentIndent: indent + markerWidth + 1, empty: true };
  }
  const contentIndent = indent + markerWidth + (spaces <= 4 ? spaces : 1);
  return { type, bullet, delim, num, indent, markerWidth, contentIndent, empty: false };
}

function canInterruptParagraph(m) {
  if (m.empty) return false;
  if (m.type === 'bullet') return true;
  return m.num === 1;
}

// ---- HTML blocks ----------------------------------------------------------

const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd ' +
  'details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 ' +
  'head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param ' +
  'search section summary table tbody td tfoot th thead title tr track ul').split(' '));

// htmlBlockStart(line): describe the HTML block a line starts, or null.
// forParagraph=true restricts to types 1-6 (type 7 cannot interrupt).
function htmlBlockStart(line, forParagraph) {
  let ind = 0;
  while (ind < line.length && line.charCodeAt(ind) === 32 && ind < 3) ind++;
  if (ind >= line.length || line.charCodeAt(ind) !== 60) return null;
  const rest = line.slice(ind);
  const c1 = rest.charCodeAt(1);
  if (c1 === 33) { // '<!'
    if (rest.startsWith('<!--')) return { type: 2, end: '-->' };
    if (rest.startsWith('<![CDATA[')) return { type: 5, end: ']]>' };
    const c2 = rest.charCodeAt(2);
    if (c2 >= 65 && c2 <= 90) return { type: 4, end: '>' };
    return null;
  }
  if (c1 === 63) return { type: 3, end: '?>' }; // '<?'
  let j = 1;
  let closing = false;
  if (rest.charCodeAt(j) === 47) { closing = true; j++; }
  const c0 = j < rest.length ? rest.charCodeAt(j) : -1;
  if (!((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122))) return null;
  const nameStart = j;
  while (j < rest.length) {
    const c = rest.charCodeAt(j);
    if (isAlnumCode(c) || c === 45) j++;
    else break;
  }
  const name = rest.slice(nameStart, j).toLowerCase();
  const after = j < rest.length ? rest.charCodeAt(j) : -1;
  if (!(after === 32 || after === 9 || after === 62 || after === 47 || after === -1)) return null;
  if (!closing && (name === 'script' || name === 'pre' || name === 'style' || name === 'textarea')) {
    return { type: 1, endTag: name };
  }
  if (BLOCK_TAGS.has(name)) return { type: 6 };
  if (!forParagraph) {
    // type 7: the line is one complete tag and nothing else
    const trimmed = trimSpaces(rest);
    const end = matchInlineHtml(trimmed, 0);
    if (end !== -1 && end === trimmed.length) return { type: 7 };
  }
  return null;
}

// lineContainsCloseTag(line, tag): does the line hold </tag ...> (any case)?
function lineContainsCloseTag(line, tag) {
  const low = line.toLowerCase();
  const needle = '</' + tag;
  let idx = low.indexOf(needle);
  while (idx !== -1) {
    let k = idx + needle.length;
    while (k < low.length && low.charCodeAt(k) === 32) k++;
    if (k < low.length && low.charCodeAt(k) === 62) return true;
    idx = low.indexOf(needle, idx + 1);
  }
  return false;
}

// collectHtmlBlock(lines, i, hi, start): {end, text}
function collectHtmlBlock(lines, i, hi, start) {
  if (start.type === 1) {
    let j = i;
    while (j < hi) {
      if (lineContainsCloseTag(lines[j], start.endTag)) return { end: j + 1, text: lines.slice(i, j + 1).join('\n') };
      j++;
    }
    return { end: hi, text: lines.slice(i, hi).join('\n') };
  }
  if (start.type >= 2 && start.type <= 5) {
    let j = i;
    while (j < hi) {
      if (lines[j].includes(start.end)) return { end: j + 1, text: lines.slice(i, j + 1).join('\n') };
      j++;
    }
    return { end: hi, text: lines.slice(i, hi).join('\n') };
  }
  let j = i;
  while (j < hi && !isBlankLine(lines[j])) j++;
  return { end: j, text: lines.slice(i, j).join('\n') };
}

// isBlockStart(line): would this line start a block that can interrupt a
// paragraph? Used for lazy continuation and table rows.
function isBlockStart(line) {
  if (indentOf(line) > 3) return false;
  if (matchATX(line) || matchFence(line) || isThematicBreak(line)) return true;
  if (stripQuotePrefix(line) !== null) return true;
  const m = matchListMarker(line);
  if (m && canInterruptParagraph(m)) return true;
  if (htmlBlockStart(line, true)) return true;
  return false;
}

// ---- tables ---------------------------------------------------------------

function splitTableRow(line) {
  const cells = [];
  let cur = '';
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line.charCodeAt(i);
    if (c === 92 && i + 1 < n) {
      // Backslash escape: '\|' is a literal pipe in the cell (the escape
      // is consumed); any other escape is kept for inline parsing.
      if (line.charCodeAt(i + 1) === 124) { cur += '|'; i += 2; continue; }
      cur += line[i] + line[i + 1]; i += 2; continue;
    }
    if (c === 96) {
      let m = 0;
      while (i + m < n && line.charCodeAt(i + m) === 96) m++;
      const closeEnd = findCodeClose(line, i + m, m);
      if (closeEnd !== -1) {
        // Copy the code span, consuming '\|' escapes inside it too.
        // A backslash consumes the next char as a pair, so '\\|' keeps
        // its backslash and only a lone '\|' becomes '|'.
        let p = i;
        while (p < closeEnd) {
          if (line.charCodeAt(p) === 92 && p + 1 < closeEnd) {
            if (line.charCodeAt(p + 1) === 124) cur += '|';
            else cur += line[p] + line[p + 1];
            p += 2;
          } else { cur += line[p]; p++; }
        }
        i = closeEnd;
        continue;
      }
      cur += line[i];
      i++;
      continue;
    }
    if (c === 124) { cells.push(cur); cur = ''; i++; continue; }
    cur += line[i];
    i++;
  }
  cells.push(cur);
  if (cells.length > 0 && trimSpaces(cells[0]) === '' && trimSpaces(line).startsWith('|')) cells.shift();
  if (cells.length > 0 && trimSpaces(cells[cells.length - 1]) === '' && trimSpaces(line).endsWith('|')) cells.pop();
  return cells;
}

function isTableDelim(line) {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  for (const cell of cells) {
    const t = trimSpaces(cell);
    let k = 0;
    if (t.charCodeAt(0) === 58) k++;
    let dashes = 0;
    while (k < t.length && t.charCodeAt(k) === 45) { dashes++; k++; }
    if (dashes === 0) return false;
    if (k < t.length && t.charCodeAt(k) === 58) k++;
    if (k !== t.length) return false;
  }
  return true;
}

function parseTable(lines, i, hi, refs, out) {
  const headerCells = splitTableRow(lines[i]);
  const delimCells = splitTableRow(lines[i + 1]);
  const cols = headerCells.length;
  const aligns = [];
  for (let c = 0; c < cols; c++) {
    const d = trimSpaces(delimCells[c]);
    const left = d.charCodeAt(0) === 58;
    const right = d.length > 0 && d.charCodeAt(d.length - 1) === 58;
    aligns.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null);
  }
  const rows = [];
  let j = i + 2;
  while (j < hi) {
    const ln = lines[j];
    // A line with only spaces (or empty) ends the table, but a line
    // containing a tab is a row (marked quirk: '\t' yields an empty
    // row of cells, while ' ' or '' ends the table).
    if (ln.length === 0 || /^[ ]+$/.test(ln)) break;
    if (isBlockStart(ln)) break;
    rows.push(splitTableRow(ln));
    j++;
  }
  if (out) {
    const alignAttr = (a) => a === 'center' ? ' align="center"' : a === 'right' ? ' align="right"' : a === 'left' ? ' align="left"' : '';
    let html = '<table>\n<thead>\n<tr>\n';
    for (let c = 0; c < cols; c++) {
      html += '<th' + alignAttr(aligns[c]) + '>' + inline(trimSpaces(headerCells[c]), refs) + '</th>\n';
    }
    html += '</tr>\n</thead>\n';
    if (rows.length > 0) {
      html += '<tbody>';
      for (const row of rows) {
        html += '<tr>\n';
        for (let c = 0; c < cols; c++) {
          const cell = c < row.length ? trimSpaces(row[c]) : '';
          html += '<td' + alignAttr(aligns[c]) + '>' + inline(cell, refs) + '</td>\n';
        }
        html += '</tr>\n';
      }
      html += '</tbody></table>\n';
    } else {
      html += '</table>\n';
    }
    out.push(html);
  }
  return j;
}

// isOpenParagraphLine(line): could this line be the last line of an open
// paragraph inside a blockquote (so a lazy line may continue it)? It must
// not be blank, must not be indented code, and must not start a block
// that closes the paragraph (ATX, fence, thematic break, setext
// underline, HTML block). List markers and quote markers may contain an
// open paragraph, so they count.
function isOpenParagraphLine(line) {
  if (isBlankLine(line)) return false;
  if (indentOf(line) >= 4) return false;
  if (matchATX(line) || matchFence(line) || isThematicBreak(line)) return false;
  if (isSetextUnderline(line)) return false;
  if (htmlBlockStart(line, true)) return false;
  return true;
}

// isSetextLike(line): the line (ignoring its indent) is a run of '=' or
// '-' characters only.
function isSetextLike(line) {
  let i = 0;
  while (i < line.length && (line.charCodeAt(i) === 32 || line.charCodeAt(i) === 9)) i++;
  if (i >= line.length) return false;
  const ch = line.charCodeAt(i);
  if (ch !== 61 && ch !== 45) return false;
  for (let j = i; j < line.length; j++) {
    if (line.charCodeAt(j) !== ch) return false;
  }
  return true;
}

// ---- the block parser -----------------------------------------------------

function parseBlocks(lines, lo, hi, refs, out, opts) {
  const bare = !!(opts && opts.bare);
  const taskHtml = opts && opts.task ? opts.task : null;
  const paraStrip4 = !!(opts && opts.paraStrip4);
  const endsNL = !!(opts && opts.endsNL);
  const lazyLines = opts && opts.lazyLines ? opts.lazyLines : null;
  // inItem: this parseBlocks call is the direct content of a list item.
  // Inside a list item, ANY non-empty ordered marker can interrupt a
  // paragraph (probe 27/28); at top level and in blockquotes only '1'
  // can. Empty markers never interrupt anywhere.
  const inItem = !!(opts && opts.inItem);
  // info (when supplied) reports whether two direct child blocks were
  // separated by a blank line — used to decide list looseness.
  const info = opts && opts.info ? opts.info : null;
  let firstBlock = true;
  let sawBlank = false;
  let blockCount = 0;
  let i = lo;
  while (i < hi) {
    // link reference definitions at the start of a block
    while (i < hi) {
      const d = tryDef(lines, i, hi);
      if (!d) break;
      if (!refs.has(d.key)) refs.set(d.key, { dest: d.dest, title: d.title });
      // A definition is a block for looseness purposes: a blank line
      // between a previous block and this definition separates blocks.
      if (blockCount > 0 && sawBlank && info) info.loose = true;
      sawBlank = false;
      blockCount++;
      i += d.lines;
    }
    if (i >= hi) break;
    const line = lines[i];
    if (isBlankLine(line)) { sawBlank = true; i++; continue; }
    // A block starts here. A blank line since the previous block means
    // two direct child blocks were separated by a blank line.
    if (blockCount > 0 && sawBlank && info) info.loose = true;
    sawBlank = false;
    blockCount++;

    const taskPrefix = firstBlock && taskHtml ? taskHtml : null;
    const markFirstDone = () => { firstBlock = false; };

    // ATX heading
    const atx = matchATX(line);
    if (atx) {
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push('<h' + atx.level + '>' + inline(atx.text, refs) + '</h' + atx.level + '>\n');
      markFirstDone();
      i++;
      continue;
    }

    // fenced code
    const fence = matchFence(line);
    if (fence) {
      const contentLines = [];
      let j = i + 1;
      while (j < hi && !isFenceClose(lines[j], fence)) {
        contentLines.push(stripFenceIndent(lines[j], fence.indent));
        j++;
      }
      const content = contentLines.length ? contentLines.join('\n') : '';
      const codeContent = content.length > 0 && !content.endsWith('\n') ? content + '\n' : content;
      const lang = fence.info ? unescapeBackslashes(fence.info.split(/[ \t]+/)[0]) : '';
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push('<pre><code' + (lang ? ' class="language-' + escapeText(lang) + '"' : '') +
        '>' + escapePlain(codeContent, 0, codeContent.length) + '</code></pre>\n');
      markFirstDone();
      i = j < hi ? j + 1 : j;
      continue;
    }

    // thematic break
    if (isThematicBreak(line)) {
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push('<hr>\n');
      markFirstDone();
      i++;
      continue;
    }

    // indented code
    if (indentOf(line) >= 4) {
      const codeLines = [];
      let j = i;
      while (j < hi) {
        const ln = lines[j];
        if (isBlankLine(ln)) { codeLines.push(stripIndent(ln, 4)); j++; continue; }
        if (indentOf(ln) >= 4) { codeLines.push(stripIndent(ln, 4)); j++; continue; }
        break;
      }
      while (codeLines.length > 0 && isBlankLine(codeLines[codeLines.length - 1])) codeLines.pop();
      const content = codeLines.length ? codeLines.join('\n') + '\n' : '';
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push('<pre><code>' + escapePlain(content, 0, content.length) + '</code></pre>\n');
      markFirstDone();
      i = j;
      continue;
    }

    // HTML block
    const htmlStart = htmlBlockStart(line, false);
    if (htmlStart) {
      const blk = collectHtmlBlock(lines, i, hi, htmlStart);
      if (out) {
        if (taskPrefix) out.push(taskPrefix);
        // An HTML block's text gains a trailing newline when the next line
        // after the block is not blank, or when the block is the last block
        // and the input ends with a newline.
        let htmlText = blk.text;
        if (blk.end < hi) {
          // Types 1-5 end at a closing marker: a trailing newline is
          // present when the next line is non-empty (even whitespace-
          // only). Types 6-7 end at a blank line, so the next line is
          // blank by construction and there is no trailing newline.
          if (htmlStart.type <= 5 ? lines[blk.end].length > 0 : !isBlankLine(lines[blk.end])) htmlText += '\n';
        } else if (endsNL) {
          htmlText += '\n';
        }
        out.push(htmlText);
      }
      markFirstDone();
      i = blk.end;
      continue;
    }

    // blockquote
    if (stripQuotePrefix(line) !== null) {
      const qlines = [];
      const lazyIdx = new Set();
      let j = i;
      let lastQuoteLine = -1;
      let inFence = null;
      while (j < hi) {
        const ln = lines[j];
        const stripped = stripQuotePrefix(ln);
        if (stripped !== null) {
          // Track fenced-code state: a lazy line after code content must
          // NOT continue the quote (the last qline is code, not a
          // paragraph). A fence opener here is a top-level fence in the
          // quote; a closer ends it.
          if (inFence) {
            if (isFenceClose(stripped, inFence)) inFence = null;
          } else {
            const f = matchFence(stripped);
            if (f) inFence = f;
          }
          qlines.push(stripped);
          lastQuoteLine = qlines.length - 1;
          j++;
          continue;
        }
        // A real blank line (no '>' prefix) ends the quote.
        if (isBlankLine(ln)) break;
        // A lazy line continues the quote only while a paragraph is open
        // and the line is not a block start (a list marker, even an empty
        // one, ends the quote).
        const lastQ = qlines.length > 0 ? qlines[qlines.length - 1] : null;
        if (lastQ !== null && !inFence && isOpenParagraphLine(lastQ) && !isBlockStart(ln) && matchListMarker(ln) === null) {
          if (isSetextLike(ln)) {
            // A setext-looking lazy line is padded to indent 4 so it stays
            // a paragraph continuation instead of becoming a heading.
            const ind = indentOf(ln);
            qlines.push(ind < 4 ? ' '.repeat(4 - ind) + ln : ln);
          } else if (indentOf(ln) >= 4) {
            qlines.push(stripIndent(ln, 4));
          } else {
            qlines.push(ln);
          }
          lazyIdx.add(qlines.length - 1);
          j++;
          continue;
        }
        break;
      }
      // drop trailing raw blank lines (those after the last '>' line)
      while (qlines.length > 0 && isBlankLine(qlines[qlines.length - 1]) && qlines.length - 1 > lastQuoteLine) {
        qlines.pop();
        j--;
      }
      if (j <= i) j = i + 1;
      const inner = out ? [] : null;
      const qopts = {};
      if (paraStrip4) qopts.paraStrip4 = true;
      if (lazyIdx.size > 0) qopts.lazyLines = lazyIdx;
      parseBlocks(qlines, 0, qlines.length, refs, inner, qopts);
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push('<blockquote>\n' + inner.join('') + '</blockquote>\n');
      markFirstDone();
      i = j;
      continue;
    }

    // list
    const listMarker = matchListMarker(line);
    if (listMarker) {
      if (out && taskPrefix) out.push(taskPrefix);
      const lr = parseList(lines, i, hi, refs, out, listMarker, taskPrefix);
      // A list whose last item ended with blank lines consumed them; the
      // blank still separates this list from the next block.
      if (lr.trailingBlank) sawBlank = true;
      i = lr.end;
      markFirstDone();
      continue;
    }

    // table: delimiter cell count must equal the header cell count; a
    // plain '---' delimiter is a setext underline, not a table; the
    // delimiter line must not be indented code.
    if (i + 1 < hi && indentOf(lines[i + 1]) <= 3 && isTableDelim(lines[i + 1]) && !isSetextUnderline(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      const delimCells = splitTableRow(lines[i + 1]);
      if (headerCells.length >= 1 && delimCells.length === headerCells.length) {
        if (out && taskPrefix) out.push(taskPrefix);
        i = parseTable(lines, i, hi, refs, out);
        markFirstDone();
        continue;
      }
    }

    // paragraph (with setext heading)
    const paraLines = [];
    let j = i;
    paraLines.push(line);
    j++;
    let setext = false;
    while (j < hi) {
      const ln = lines[j];
      if (isBlankLine(ln)) {
        // A whitespace-only line (not an empty line) is a paragraph
        // continuation when it is the last line and the input does not
        // end with a newline.
        if (ln.length > 0 && !endsNL && j === hi - 1) {
          paraLines.push(ln);
          j++;
          continue;
        }
        break;
      }
      const isLazy = lazyLines !== null && lazyLines.has(j);
      if (!isLazy && isSetextUnderline(ln)) { setext = true; break; }
      if (!isLazy && indentOf(ln) <= 3) {
        if (matchATX(ln) || matchFence(ln) || isThematicBreak(ln)) break;
        if (stripQuotePrefix(ln) !== null) break;
        const lm = matchListMarker(ln);
        if (lm && (canInterruptParagraph(lm) || (inItem && lm.type === 'ordered' && !lm.empty))) break;
        if (htmlBlockStart(ln, true)) break;
      }
      if (paraStrip4 && indentOf(ln) >= 4) paraLines.push(stripIndent(ln, 4));
      else paraLines.push(ln);
      j++;
    }
    const text = paraLines.join('\n');
    if (setext) {
      const level = setextLevel(lines[j]);
      let heading = stripIndent(paraLines[0], Math.min(indentOf(paraLines[0]), 3));
      if (paraLines.length > 1) heading += '\n' + paraLines.slice(1).join('\n');
      let hEnd = heading.length;
      while (hEnd > 0 && (heading.charCodeAt(hEnd - 1) === 32 || heading.charCodeAt(hEnd - 1) === 9)) hEnd--;
      heading = heading.slice(0, hEnd);
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push('<h' + level + '>' + inline(heading, refs) + '</h' + level + '>\n');
      markFirstDone();
      i = j + 1;
      continue;
    }
    if (bare) {
      if (out && taskPrefix) out.push(taskPrefix);
      if (out) out.push(inline(text, refs));
    } else {
      if (out) out.push('<p>' + (taskPrefix || '') + inline(text, refs) + '</p>\n');
    }
    markFirstDone();
    i = j;
  }
}

// parseList(lines, i, hi, refs, out, firstMarker, taskPrefix): parse a list
// starting at line i. Returns the index of the first line after the list.
function parseList(lines, i, hi, refs, out, firstMarker, taskPrefix) {
  const bullet = firstMarker.type === 'bullet';
  const items = [];
  let j = i;
  let loose = false;
  let lastTrailingBlanks = 0;
  while (j < hi) {
    if (isThematicBreak(lines[j])) break;
    const m = matchListMarker(lines[j]);
    if (!m) break;
    if (m.type !== firstMarker.type) break;
    if (bullet) { if (m.bullet !== firstMarker.bullet) break; }
    else if (m.delim !== firstMarker.delim) break;
    const contentIndent = m.contentIndent;
    let firstContent = stripColumns(lines[j], contentIndent);
    let task = null;
    const tm = firstContent.match(/^\[([ xX])\][ \t]+\S/);
    if (tm) {
      task = tm[1] !== ' ';
      firstContent = firstContent.replace(/^\[[ xX]\][ \t]+/, '');
    }
    const itemLines = [firstContent];
    let itemHasContent = !isBlankLine(firstContent);
    let itemClosed = false;
    j++;
    while (j < hi) {
      const ln = lines[j];
      if (isBlankLine(ln)) {
        // A blank line closes an item that has no content yet (later
        // indented lines are not part of it); blank lines themselves are
        // still consumed as separators.
        if (!itemHasContent) itemClosed = true;
        itemLines.push('');
        j++;
        continue;
      }
      if (itemClosed) break;
      if (indentOf(ln) >= contentIndent) {
        itemLines.push(stripColumns(ln, contentIndent));
        itemHasContent = true;
        j++;
        continue;
      }
      if (matchListMarker(ln)) break;
      // A lazy line cannot continue a fenced code block: when the last
      // line of the item opens a fence, a line with insufficient indent
      // ends the item instead of becoming fence content.
      const lastLine = itemLines.length > 0 ? itemLines[itemLines.length - 1] : null;
      if (lastLine !== null && matchFence(lastLine)) break;
      if (itemLines.length > 0 && !isBlankLine(itemLines[itemLines.length - 1]) && !isBlockStart(ln)) {
        itemLines.push(ln);
        itemHasContent = true;
        j++;
        continue;
      }
      break;
    }
    let trailingBlanks = 0;
    // Trailing blank lines separate this item from the next, but the
    // item's own (empty) first line does not count as one.
    while (itemLines.length > 1 && isBlankLine(itemLines[itemLines.length - 1])) {
      itemLines.pop();
      trailingBlanks++;
    }
    lastTrailingBlanks = trailingBlanks;
    if (trailingBlanks > 0 && j < hi) {
      const nm = matchListMarker(lines[j]);
      if (nm && nm.type === firstMarker.type &&
        (bullet ? nm.bullet === firstMarker.bullet : nm.delim === firstMarker.delim)) {
        loose = true;
      }
    }
    items.push({ lines: itemLines, task });
  }
  // In collect mode there is no output; just walk the items so that
  // definitions inside them are registered.
  if (!out) {
    for (const item of items) {
      parseBlocks(item.lines, 0, item.lines.length, refs, null, { paraStrip4: true, inItem: true });
    }
    return { end: j, trailingBlank: lastTrailingBlanks > 0 && j < hi };
  }
  // Blank lines between an item's own direct child blocks also make the
  // list loose. Only items that contain a blank line need the check; the
  // check parses the item's block structure, so blank lines inside a
  // nested list or quote do not count for the enclosing list.
  for (const item of items) {
    let hasBlank = false;
    for (const l of item.lines) if (isBlankLine(l)) { hasBlank = true; break; }
    if (!hasBlank) continue;
    const info = {};
    parseBlocks(item.lines, 0, item.lines.length, refs, null, { info, paraStrip4: true, inItem: true });
    if (info.loose) { loose = true; break; }
  }
  const startNum = bullet ? null : firstMarker.num;
  out.push(bullet ? '<ul>\n' : '<ol' + (startNum !== null && startNum !== 1 ? ' start="' + startNum + '"' : '') + '>\n');
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const taskStr = item.task === null ? null :
      '<input ' + (item.task ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
    out.push('<li>');
    const inner = [];
    parseBlocks(item.lines, 0, item.lines.length, refs, inner,
      { bare: !loose, task: taskStr, paraStrip4: true, inItem: true });
    out.push(inner.join(''));
    out.push('</li>\n');
  }
  out.push(bullet ? '</ul>\n' : '</ol>\n');
  return { end: j, trailingBlank: lastTrailingBlanks > 0 && j < hi };
}

// ---- entry point ----------------------------------------------------------

export function parse(markdown) {
  const src = String(markdown).replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  if (src.endsWith('\n')) lines.pop();
  const refs = new Map();
  const opts = { endsNL: src.endsWith('\n') };
  // Collect pass (out null): walk the whole block structure once so that
  // forward link reference definitions — including ones inside blockquotes
  // and list items — are registered before any inline text is rendered.
  parseBlocks(lines, 0, lines.length, refs, null, opts);
  const out = [];
  parseBlocks(lines, 0, lines.length, refs, out, opts);
  return out.join('');
}
