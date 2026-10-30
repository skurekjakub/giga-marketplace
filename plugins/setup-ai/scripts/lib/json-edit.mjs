// Minimal-diff JSON rewriting: the members a change leaves alone keep their
// original text (blank lines, one-line arrays, key order), and only the
// subtrees that changed are re-serialized, in the file's own indentation.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The file's indentation unit and line ending; `''` for a one-line file. */
export function jsonStyle(text) {
  const oneLine = !text.trim().includes('\n');
  return {
    unit: oneLine ? '' : text.match(/^[ \t]+(?=["{[\]}])/m)?.[0] ?? '  ',
    eol: text.includes('\r\n') ? '\r\n' : '\n',
  };
}

// Index just past the string whose opening quote is at `i`.
function stringEnd(text, i) {
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === '"') return j + 1;
  }
  throw new Error('unterminated string');
}

const skipWs = (text, i) => {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
};

// Index just past the JSON value that starts at `i`.
function valueEnd(text, i) {
  const c = text[i];
  if (c === '"') return stringEnd(text, i);
  if (c === '{' || c === '[') {
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (ch === '"') j = stringEnd(text, j) - 1;
      else if (ch === '{' || ch === '[') depth++;
      else if ((ch === '}' || ch === ']') && --depth === 0) return j + 1;
    }
    throw new Error('unterminated container');
  }
  const m = /^[^,\]}\s]+/.exec(text.slice(i));
  if (!m) throw new Error(`unexpected ${c}`);
  return i + m[0].length;
}

// The members of the object whose `{` is at `open`: key, where the key starts,
// and the value's span.
function members(text, open) {
  const list = [];
  let i = skipWs(text, open + 1);
  if (text[i] === '}') return list;
  for (;;) {
    const keyStart = i;
    const keyEnd = stringEnd(text, i);
    i = skipWs(text, skipWs(text, keyEnd) + 1);
    const end = valueEnd(text, i);
    list.push({ key: JSON.parse(text.slice(keyStart, keyEnd)), keyStart, valueStart: i, valueEnd: end });
    i = skipWs(text, end);
    if (text[i] === ',') i = skipWs(text, i + 1);
    else if (text[i] === '}') return list;
    else throw new Error('malformed object');
  }
}

// Leading whitespace of the line holding `pos`.
const lineIndent = (text, pos) => /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', pos - 1) + 1))[0];

const serialize = (v, indent, unit, eol) => JSON.stringify(v, null, unit).split('\n').join(eol + indent);

// Collects the edits that turn object `cur` (text at `open`) into `next`.
// Returns false, having collected nothing, when the change can't be made in
// place — kept keys reordered, new keys anywhere but the end, or every key
// replaced — so the caller re-serializes the whole value.
function objectEdits(text, open, cur, next, edits, style) {
  const curKeys = Object.keys(cur);
  const nextKeys = Object.keys(next);
  const kept = curKeys.filter((k) => k in next);
  const added = nextKeys.filter((k) => !(k in cur));
  if (nextKeys.some((k, i) => k !== (i < kept.length ? kept[i] : added[i - kept.length]))) return false;
  if (!kept.length && added.length && curKeys.length) return false;
  const list = members(text, open);
  const mine = [];
  const firstKept = list.findIndex((m) => m.key in next);
  list.forEach((m, idx) => {
    if (m.key in next) return;
    // A removed member takes the comma before it; leading removed members
    // take everything up to the first kept key instead.
    if (firstKept === -1) {
      if (idx === 0) mine.push({ start: open + 1, end: text.indexOf('}', list[list.length - 1].valueEnd), text: '' });
    } else if (idx < firstKept) {
      if (idx === 0) mine.push({ start: m.keyStart, end: list[firstKept].keyStart, text: '' });
    } else mine.push({ start: list[idx - 1].valueEnd, end: m.valueEnd, text: '' });
  });
  for (const m of list) {
    if (!(m.key in next) || same(cur[m.key], next[m.key])) continue;
    if (isObj(cur[m.key]) && isObj(next[m.key]) && objectEdits(text, m.valueStart, cur[m.key], next[m.key], mine, style)) continue;
    mine.push({ start: m.valueStart, end: m.valueEnd, text: serialize(next[m.key], lineIndent(text, m.keyStart), style.unit, style.eol) });
  }
  edits.push(...mine);
  if (!added.length) return true;
  const { unit, eol } = style;
  const nl = unit ? eol : '';
  const sep = unit ? ': ' : ':';
  if (list.length) {
    const last = list[list.length - 1];
    const ind = unit ? lineIndent(text, last.keyStart) : '';
    edits.push({ start: last.valueEnd, end: last.valueEnd, text: added.map((k) => `,${nl}${ind}${JSON.stringify(k)}${sep}${serialize(next[k], ind, unit, eol)}`).join('') });
  } else {
    const outer = unit ? lineIndent(text, open) : '';
    const ind = outer + unit;
    const close = text.indexOf('}', open);
    edits.push({ start: open + 1, end: close, text: nl + added.map((k) => `${ind}${JSON.stringify(k)}${sep}${serialize(next[k], ind, unit, eol)}`).join(`,${nl}`) + nl + outer });
  }
  return true;
}

/**
 * The text of JSON document `text` changed to hold `next`, touching only
 * what differs: unchanged members keep their exact text, changed subtrees are
 * re-serialized in the file's indentation and line endings, and new keys are
 * appended after the last member of their object. A removed key or a
 * reordered object falls back to re-serializing that object (the whole
 * document at the top level), still in the file's style.
 *
 * @param {string} text - The current file contents; must parse as JSON.
 * @param {*} next - The value the file should hold.
 * @returns {string} The new contents; `text` itself when it already holds `next`.
 */
export function editJson(text, next) {
  const cur = JSON.parse(text);
  if (same(cur, next)) return text;
  const style = jsonStyle(text);
  const full = () => JSON.stringify(next, null, style.unit).split('\n').join(style.eol) + style.eol;
  const open = skipWs(text, 0);
  if (!isObj(cur) || !isObj(next) || text[open] !== '{') return full();
  try {
    const edits = [];
    if (!objectEdits(text, open, cur, next, edits, style)) return full();
    let res = text;
    for (const e of edits.sort((a, b) => b.start - a.start)) res = res.slice(0, e.start) + e.text + res.slice(e.end);
    return same(JSON.parse(res), next) ? res : full();
  } catch {
    return full();
  }
}
