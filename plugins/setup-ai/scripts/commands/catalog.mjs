import { GLOBAL_TOKENS, out, pluginVersion, readJson } from '../lib/util.mjs';
import { loadPacks } from '../lib/packs.mjs';

/** `catalog` — every pack's manifest (minus its path) and the global tokens. */
export function cmdCatalog() {
  const all = loadPacks();
  out({
    ok: true,
    version: pluginVersion(),
    globalTokens: readJson(GLOBAL_TOKENS, {}),
    packs: Object.values(all).map(({ root: _root, ...p }) => p),
  });
}
