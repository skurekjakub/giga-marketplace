/**
 * Condition expressions used by `@if` blocks, `fileConditions`, `@when` and
 * `when` fields.
 *
 * Terms: `pack:x` | `option:key[=value]` | `profile:x` | `detect:<flag>` |
 * `platform:win32`. `!` negates a term, `+` ands terms, `|` ors groups
 * (`+` binds tighter).
 *
 * @param {string} expr
 * @param {{packs: string[], options: object, detect: ?object}} ctx
 * @returns {boolean}
 * @throws {Error} When a term has an unknown kind.
 */
export function evalCond(expr, ctx) {
  return expr.split('|').some((group) => group.split('+').every((raw) => evalTerm(raw, ctx)));
}

function evalTerm(raw, ctx) {
  let term = raw.trim();
  const neg = term.startsWith('!');
  if (neg) term = term.slice(1).trim();
  let val = false;
  const [kind, rest = ''] = term.split(/:(.*)/s);
  if (kind === 'pack') val = ctx.packs.includes(rest);
  else if (kind === 'profile') val = ctx.options.profile === rest;
  else if (kind === 'detect') val = Boolean(ctx.detect?.flags?.[rest]);
  else if (kind === 'platform') val = process.platform === rest;
  else if (kind === 'option') {
    const [key, want] = rest.split('=');
    const have = ctx.options[key];
    val = want === undefined
      ? Boolean(have && (!Array.isArray(have) || have.length))
      : Array.isArray(have) ? have.includes(want) : String(have) === want;
  } else throw new Error(`bad condition term: ${term}`);
  return neg ? !val : val;
}
