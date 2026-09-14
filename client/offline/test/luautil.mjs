// Shared helpers for Node-side Lua testing
import { to_jsstring } from '../vendor/fengari.mjs';

// Read the value at idx as a JS string (works for both luastring and plain strings).
export function strAt(luaMod, L, idx) {
  const s = luaMod.lua_tojsstring(L, idx);
  if (typeof s === 'string') return s;
  if (s instanceof Uint8Array) return to_jsstring(s);
  return null;
}
