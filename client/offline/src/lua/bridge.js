// Minimal, correct Lua<->JS bridge built directly on the fengari C API.
//
// Conventions:
//  - JS objects/functions are exposed as full userdata with shared metatables.
//  - Property access: __index/__newindex read/write the JS object directly.
//  - Calls:
//      obj:method(a, b) -> method(obj, a, b)   (colon: self arrives as 1st arg)
//      T.func(a)        -> func(a)             (fn proxy: plain call, no self)
//  - Lua functions passed to JS are wrapped in JS closures (registry ref).
//  - Every JS entry point saves/restores the stack top.

import {
  lua, lauxlib, to_luastring, to_jsstring,
} from '../../vendor/fengari.mjs';

const { luaL_ref, luaL_unref } = lauxlib;

const {
  LUA_REGISTRYINDEX, LUA_MULTRET, LUA_OK, LUA_YIELD,
  LUA_TNIL, LUA_TBOOLEAN, LUA_TNUMBER, LUA_TSTRING, LUA_TTABLE,
  LUA_TFUNCTION, LUA_TTHREAD, LUA_TUSERDATA,
  lua_gettop, lua_settop, lua_pushnil, lua_pushboolean, lua_pushnumber,
  lua_pushinteger,
  lua_pushstring,
  lua_setmetatable,
  lua_toboolean, lua_tonumber, lua_touserdata,
  lua_rawgeti, lua_rawseti, lua_pushthread,
  lua_pcall, lua_resume, lua_tothread,
  lua_getglobal, lua_getfield,
  lua_pushcfunction, lua_settable, lua_newuserdata, lua_rawlen, lua_absindex, lua_pushvalue,
  lua_pcallk, lua_yield,
} = lua;

const { luaL_newmetatable, luaL_getmetatable, luaL_error } = lauxlib;

export class Bridge {
  constructor() {
    this.L = null;
    this.byId = new Map();
    this.jsToId = new WeakMap();
    this.nextId = 1;
    this.metaRef = null;
    this.fnMetaRef = null;
    this.coRefs = new Set();
  }

  init(L) {
    this.L = L;
    this.curL = L;
    this.buildMetatables(L);
    this.installHelpers(L);
    this.registerErrorHandlers(L);
    return this;
  }

  // Install JS-error reporting so protected calls surface JS exceptions.
  registerErrorHandlers(L) {
    lua.lua_atnativeerror(L, function (L2) {
      const e = lua.lua_touserdata(L2, 1);
      const msg = e && e.message ? e.message : String(e);
      const stk = e && e.stack ? String(e.stack).split('\n').slice(0, 3).join(' | ') : '';
      lua.lua_pushstring(L2, to_luastring('JS error: ' + msg + (stk ? ' (' + stk + ')' : '')));
      return 1;
    });
  }

  intern(obj) {
    let id = this.jsToId.get(obj);
    if (id === undefined) {
      id = this.nextId++;
      this.jsToId.set(obj, id);
      this.byId.set(id, obj);
    }
    return id;
  }

  pushObj(L, obj) {
    const id = this.intern(obj);
    const ud = lua_newuserdata(L, 8);
    ud.__rbxId = id;
    lua_rawgeti(L, LUA_REGISTRYINDEX, this.metaRef);
    lua_setmetatable(L, -2);
  }

  pushFn(L, fn) {
    const id = this.intern(fn);
    const ud = lua_newuserdata(L, 8);
    ud.__rbxId = id;
    lua_rawgeti(L, LUA_REGISTRYINDEX, this.fnMetaRef);
    lua_setmetatable(L, -2);
  }

  push(L, v) {
    if (v === undefined || v === null) { lua_pushnil(L); return; }
    const t = typeof v;
    if (t === 'boolean') { lua_pushboolean(L, v); return; }
    if (t === 'number') {
      // Push integral values as Lua integers so they behave/stringify like
      // Luau integer literals ("10", not "10.0").
      if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) {
        lua_pushinteger(L, v);
      } else {
        lua_pushnumber(L, v);
      }
      return;
    }
    if (t === 'string') { lua_pushstring(L, to_luastring(v)); return; }
    if (t === 'bigint') { lua_pushnumber(L, Number(v)); return; }
    if (typeof v === 'function') { this.pushFn(L, v); return; }
    if (Array.isArray(v)) {
      lua.lua_createtable(L, v.length, 0);
      for (let i = 0; i < v.length; i++) {
        this.push(L, v[i]);
        lua_rawseti(L, -2, i + 1);
      }
      return;
    }
    if (t === 'object') { this.pushObj(L, v); return; }
    lua_pushnil(L);
  }

  pushMulti(L, v) {
    if (Array.isArray(v) && v.__rbxMulti) {
      for (const x of v) this.push(L, x);
      return v.length;
    }
    this.push(L, v);
    return 1;
  }

  toJs(L, idx) {
    const t = lua.lua_type(L, idx);
    switch (t) {
      case LUA_TNIL: return undefined;
      case LUA_TBOOLEAN: return lua_toboolean(L, idx);
      case LUA_TNUMBER: return lua_tonumber(L, idx);
      case LUA_TSTRING: {
        const s = lua.lua_tojsstring(L, idx);
        return s === null || s === undefined ? undefined : s;
      }
      case LUA_TUSERDATA: {
        const ud = lua_touserdata(L, idx);
        if (ud && typeof ud === 'object' && '__rbxId' in ud && this.byId.has(ud.__rbxId)) {
          return this.byId.get(ud.__rbxId);
        }
        return undefined;
      }
      case LUA_TFUNCTION: return this.wrapLuaFn(L, idx);
      case LUA_TTHREAD: return undefined;
      case LUA_TTABLE: return this.tableToJs(L, idx);
      default: return undefined;
    }
  }

  wrapLuaFn(L, idx) {
    lua_pushvalue(L, idx);
    const ref = luaL_ref(L, LUA_REGISTRYINDEX); // pops the copy
    const B = this;
    const wrapper = function (...args) {
      const L2 = B.curL;
      const saved = lua_gettop(L2);
      lua_rawgeti(L2, LUA_REGISTRYINDEX, ref);
      for (const a of args) B.push(L2, a);
      const state = { err: false, errMsg: null };
      // Continuation: on yield, propagate the yield ABOVE the pcall so the
      // inner Lua function stays suspended and resumable later.
      const cont = function (L3, status, ctx) {
        if (status === LUA_YIELD) {
          const n = Math.max(0, lua_gettop(L3) - (saved + 1 + args.length));
          lua_yield(L3, n); // throws; never returns
          return 0;
        }
        state.err = true;
        const n = lua_gettop(L3) - saved;
        if (n <= 0) {
          lua_pushstring(L3, to_luastring('unknown lua error'));
          return 1;
        }
        return n;
      };
      let r;
      try {
        r = lua_pcallk(L2, args.length, LUA_MULTRET, 0, 0, cont);
      } catch (e) {
        lua_settop(L2, saved);
        B.releaseLuaFn(wrapper);
        throw e;
      }
      // If we get here, the inner call finished (normal return or error via cont).
      const topN = lua_gettop(L2) - saved;
      if (state.err || r !== LUA_OK) {
        let msg = 'unknown lua error';
        if (topN > 0) {
          const v = B.toJs(L2, lua_gettop(L2));
          if (typeof v === 'string') msg = v;
        }
        lua_settop(L2, saved);
        B.releaseLuaFn(wrapper);
        throw new Error(msg);
      }
      const out = new Array(topN);
      for (let i = 1; i <= topN; i++) out[i - 1] = B.toJs(L2, saved + i);
      lua_settop(L2, saved);
      return out.length === 1 ? out[0] : out;
    };
    wrapper.__rbxLuaRef = ref;
    return wrapper;
  }

  releaseLuaFn(wrapper) {
    if (wrapper && wrapper.__rbxLuaRef !== undefined) {
      luaL_unref(this.L, LUA_REGISTRYINDEX, wrapper.__rbxLuaRef);
      wrapper.__rbxLuaRef = undefined;
    }
  }

  tableToJs(L, idx, seen) {
    seen = seen || new Set();
    const ud = lua_touserdata(L, idx);
    if (ud) {
      if (seen.has(ud)) return {};
      seen.add(ud);
    }
    const absIdx = lua_absindex(L, idx);
    const len = lua_rawlen(L, absIdx) || 0;
    const arr = new Array(len);
    for (let i = 1; i <= len; i++) {
      lua_rawgeti(L, absIdx, i);
      arr[i - 1] = this.toJs(L, -1);
      lua_pop_(L, 1);
    }
    const extra = {};
    let hasExtra = false;
    lua_pushnil(L);
    while (lua.lua_next(L, absIdx)) {
      const k = this.toJs(L, -2);
      const v = this.toJs(L, -1);
      lua_pop_(L, 1);
      // array-part keys (1..len) are already in `arr`
      if (typeof k === 'number' && Number.isInteger(k) && k >= 1 && k <= len) continue;
      extra[k] = v;
      hasExtra = true;
    }
    if (ud) seen.delete(ud);
    if (!hasExtra) return arr; // pure array
    const out = {};
    for (let i = 0; i < len; i++) out[i] = arr[i];
    for (const k of Object.keys(extra)) out[k] = extra[k];
    return out;
  }

  buildMetatables(L) {
    const B = this;
    const getObj = (idx) => {
      const ud = lua_touserdata(L, idx);
      if (!ud || typeof ud !== 'object' || !('__rbxId' in ud)) return undefined;
      return B.byId.get(ud.__rbxId);
    };

    // ------- object metatable -------
    luaL_newmetatable(L, '__rbxObj');
    const add = (name, f) => {
      // NOTE: fengari lua_settable expects key BELOW, value ON TOP
      lua_pushstring(L, to_luastring(name));
      lua_pushcfunction(L, f);
      lua_settable(L, -3); // table at -3
    };
    add('__index', function (L2) {
      B.curL = L2;
      const obj = getObj(1);
      const key = B.toJs(L2, 2);
      let v;
      try { v = obj ? obj[key] : undefined; } catch (e) { v = undefined; }
      return B.pushMulti(L2, v);
    });
    add('__newindex', function (L2) {
      B.curL = L2;
      const obj = getObj(1);
      const key = B.toJs(L2, 2);
      const val = B.toJs(L2, 3);
      if (obj !== undefined) {
        try {
          if (val === undefined) delete obj[key];
          else obj[key] = val;
        } catch (e) { /* ignore */ }
      }
      return 0;
    });
    add('__call', function (L2) {
      B.curL = L2;
      const obj = getObj(1);
      const n = lua_gettop(L2) - 1;
      const args = new Array(n);
      for (let i = 0; i < n; i++) args[i] = B.toJs(L2, i + 2);
      const top = lua_gettop(L2);
      try {
        if (typeof obj === 'function') {
          return B.pushMulti(L2, obj(...args));
        }
        if (obj && typeof obj.__rbxCall === 'function') {
          return B.pushMulti(L2, obj.__rbxCall(...args));
        }
        luaL_error(L2, to_luastring('attempt to call a non-callable object'));
        return 0;
      } catch (e) {
        lua_settop(L2, top);
        luaL_error(L2, to_luastring('JS error: ' + (e && e.message ? e.message : String(e))));
        return 0;
      }
    });
    add('__pairs', function (L2) {
      B.curL = L2;
      const obj = getObj(1);
      let keys = [];
      if (obj && typeof obj.__rbxPairs === 'function') {
        try { keys = obj.__rbxPairs(); } catch (e) { keys = []; }
      } else if (obj && typeof obj === 'object' && typeof obj !== 'function') {
        try { keys = Object.keys(obj); } catch (e) { keys = []; }
      }
      const state = { i: 0, keys, obj };
      const iter = function (L3) {
        const st = B.toJs(L3, 1);
        if (!st || st.i >= st.keys.length) { lua_pushnil(L3); return 1; }
        const k = st.keys[st.i++];
        B.push(L3, k);
        let v;
        try { v = st.obj ? st.obj[k] : undefined; } catch (e) { v = undefined; }
        B.push(L3, v);
        return 2;
      };
      // Must return (iterator, state, control): first result is the BOTTOM
      // of the returned stack window.
      lua_pushcfunction(L2, iter);
      B.push(L2, state);
      lua_pushnil(L2);
      return 3;
    });
    add('__tostring', function (L2) {
      B.curL = L2;
      const obj = getObj(1);
      let s;
      if (obj && typeof obj.__rbxToString === 'function') {
        try { s = obj.__rbxToString(obj); } catch (e) { s = String(obj); }
      } else {
        s = obj === undefined ? 'nil' : (obj && obj.toString ? obj.toString() : String(obj));
      }
      lua_pushstring(L2, to_luastring(String(s)));
      return 1;
    });

    const binop = (method) => function (L2) {
      B.curL = L2;
      const a = getObj(1);
      const b = B.toJs(L2, 2);
      const top = lua_gettop(L2);
      try {
        if (!a || typeof a[method] !== 'function') {
          luaL_error(L2, to_luastring('unsupported operator for ' + (a && a.constructor ? a.constructor.name : typeof a)));
          return 0;
        }
        return B.pushMulti(L2, a[method](a, b));
      } catch (e) {
        lua_settop(L2, top);
        luaL_error(L2, to_luastring('JS operator error: ' + (e && e.message ? e.message : String(e))));
        return 0;
      }
    };
    add('__add', binop('__rbxAdd'));
    add('__sub', binop('__rbxSub'));
    add('__mul', binop('__rbxMul'));
    add('__div', binop('__rbxDiv'));
    add('__mod', binop('__rbxMod'));
    add('__pow', binop('__rbxPow'));
    add('__unm', function (L2) {
      B.curL = L2;
      const a = getObj(1);
      const top = lua_gettop(L2);
      try {
        if (!a || typeof a.__rbxUnm !== 'function') { luaL_error(L2, to_luastring('unsupported unary minus')); return 0; }
        return B.pushMulti(L2, a.__rbxUnm(a));
      } catch (e) {
        lua_settop(L2, top);
        luaL_error(L2, to_luastring('JS operator error: ' + (e && e.message ? e.message : String(e))));
        return 0;
      }
    });
    add('__concat', binop('__rbxConcat'));
    add('__eq', function (L2) {
      B.curL = L2;
      const a = getObj(1);
      const b = B.toJs(L2, 2);
      const top = lua_gettop(L2);
      try {
        const r = a && typeof a.__rbxEq === 'function' ? a.__rbxEq(a, b) : a === b;
        lua_pushboolean(L2, !!r);
        return 1;
      } catch (e) {
        lua_settop(L2, top);
        lua_pushboolean(L2, false);
        return 1;
      }
    });
    add('__lt', binop('__rbxLt'));
    add('__le', binop('__rbxLe'));
    add('__len', function (L2) {
      B.curL = L2;
      const a = getObj(1);
      const top = lua_gettop(L2);
      try {
        if (!a || typeof a.__rbxLen !== 'function') { luaL_error(L2, to_luastring('unsupported # operator')); return 0; }
        B.push(L2, a.__rbxLen());
        return 1;
      } catch (e) {
        lua_settop(L2, top);
        luaL_error(L2, to_luastring('JS # error: ' + (e && e.message ? e.message : String(e))));
        return 0;
      }
    });
    this.metaRef = luaL_ref(L, LUA_REGISTRYINDEX); // consumes metatable

    // ------- fn metatable -------
    luaL_newmetatable(L, '__rbxFn');
    add('__call', function (L2) {
      B.curL = L2;
      const obj = getObj(1);
      const n = lua_gettop(L2) - 1;
      const args = new Array(n);
      for (let i = 0; i < n; i++) args[i] = B.toJs(L2, i + 2);
      const top = lua_gettop(L2);
      try {
        if (typeof obj !== 'function') { luaL_error(L2, to_luastring('not a function')); return 0; }
        return B.pushMulti(L2, obj(...args));
      } catch (e) {
        lua_settop(L2, top);
        luaL_error(L2, to_luastring('JS error: ' + (e && e.message ? e.message : String(e))));
        return 0;
      }
    });
    add('__tostring', function (L2) { lua_pushstring(L2, to_luastring('function (js)')); return 1; });
    add('__pairs', function (L2) {
      // Must return (iterator, state, control)
      lua_pushcfunction(L2, function (L3) { lua_pushnil(L3); return 1; });
      B.push(L2, { i: 0, keys: [], obj: null });
      lua_pushnil(L2);
      return 3;
    });
    this.fnMetaRef = luaL_ref(L, LUA_REGISTRYINDEX); // consumes metatable
  }

  installHelpers(L) {
    const B = this;
    const setG = (name, f) => { lua_pushcfunction(L, f); lua.lua_setglobal(L, to_luastring(name)); };

    // Note: in fengari each coroutine is its own state object.
    // lua_tothread(L, idx) returns that state; lua_resume is called on it.
    //
    // IMPORTANT: the coroutine runs the *actual Lua function* as its main
    // function (via coroutine.create). A JS closure must NOT sit in the
    // yield path: on the first yield the JS stack unwinds and can never be
    // re-entered, and fengari's unroll() would then invoke the pcallk
    // continuation with LUA_YIELD even after the function has *returned*,
    // corrupting the result.
    setG('__rbxInvokeInCo', function (L2) {
      B.curL = L2;
      // __rbxInvokeInCo(fn, ...) -> coHandle, 'done'|yieldValue | 'error', msg
      const fn = B.toJs(L2, 1);
      const total = lua_gettop(L2);
      const args = new Array(Math.max(0, total - 1));
      for (let i = 0; i < total - 1; i++) args[i] = B.toJs(L2, i + 2);
      if (typeof fn !== 'function' || fn.__rbxLuaRef === undefined) {
        lua_settop(L2, 0);
        luaL_error(L2, to_luastring('__rbxInvokeInCo expects a Lua function'));
        return 0;
      }
      lua_settop(L2, 0); // clear input args; results pushed below
      const saved = lua_gettop(L2);
      // coroutine.create(<the actual lua function from the registry>)
      lua_getglobal(L2, to_luastring('coroutine'));
      lua_getfield(L2, -1, to_luastring('create'));
      lua_remove(L2, -2);
      lua_rawgeti(L2, LUA_REGISTRYINDEX, fn.__rbxLuaRef);
      const r = lua_pcall(L2, 1, 1, 0);
      if (r !== LUA_OK) {
        const m = lua.lua_tolstring(L2, -1);
        lua_settop(L2, saved);
        luaL_error(L2, to_luastring('coroutine.create failed: ' + (m ? to_jsstring(m) : '?')));
        return 0;
      }
      const coL = lua_tothread(L2, -1);
      if (!coL) {
        lua_settop(L2, saved);
        luaL_error(L2, to_luastring('coroutine.create returned a non-thread'));
        return 0;
      }
      const coRef = luaL_ref(L2, LUA_REGISTRYINDEX);
      B.coRefs.add(coL);
      // DO NOT clear coL's stack: coroutine.create left the main function
      // there; the first lua_resume expects [mainFn, args...] on the stack.
      for (const a of args) B.push(coL, a);
      const st = lua_resume(coL, L2, args.length);
      if (st === LUA_OK) {
        const rn = lua_gettop(coL);
        const rv = new Array(rn);
        for (let i = 1; i <= rn; i++) rv[i - 1] = B.toJs(coL, i);
        lua_settop(coL, 0);
        B.coRefs.delete(coL);
        luaL_unref(L2, LUA_REGISTRYINDEX, coRef);
        B.push(L2, { __coRef: coRef, __coState: coL, __alive: false });
        B.push(L2, 'done');
        for (const v of rv) B.push(L2, v);
        return 2 + rv.length;
      }
      if (st === LUA_YIELD) {
        const yn = lua_gettop(coL);
        const yv = new Array(yn);
        for (let i = 1; i <= yn; i++) yv[i - 1] = B.toJs(coL, i);
        lua_settop(coL, 0);
        B.push(L2, { __coRef: coRef, __coState: coL, __alive: true });
        B.push(L2, 'yield');
        for (const v of yv) B.push(L2, v);
        return 2 + yv.length;
      }
      const m = lua.lua_tolstring(coL, -1);
      lua_settop(coL, 0);
      B.coRefs.delete(coL);
      luaL_unref(L2, LUA_REGISTRYINDEX, coRef);
      B.push(L2, { __coRef: coRef, __coState: coL, __alive: false });
      B.push(L2, 'error');
      B.push(L2, m ? to_jsstring(m) : 'unknown lua error');
      return 3;
    });

    setG('__rbxResumeCo', function (L2) {
      B.curL = L2;
      // __rbxResumeCo(handle, ...) -> ok, ...yieldValues | false, errMsg
      const handle = B.toJs(L2, 1);
      const coRef = handle && handle.__coRef;
      const coL = handle && handle.__coState;
      if (!coRef || !coL || !B.coRefs.has(coL)) {
        luaL_error(L2, to_luastring('__rbxResumeCo: dead or bad handle'));
        return 0;
      }
      const n = lua_gettop(L2) - 1;
      const args = new Array(n);
      for (let i = 0; i < n; i++) args[i] = B.toJs(L2, i + 2);
      lua_settop(L2, 0); // clear input args; results pushed below
      for (const a of args) B.push(coL, a);
      const st = lua_resume(coL, L2, args.length);
      if (st === LUA_OK) {
        const rn = lua_gettop(coL);
        const rv = new Array(rn);
        for (let i = 1; i <= rn; i++) rv[i - 1] = B.toJs(coL, i);
        lua_settop(coL, 0);
        B.coRefs.delete(coL);
        luaL_unref(L2, LUA_REGISTRYINDEX, coRef);
        B.push(L2, 'done');
        for (const v of rv) B.push(L2, v);
        return 1 + rv.length;
      }
      if (st === LUA_YIELD) {
        const yn = lua_gettop(coL);
        const yv = new Array(yn);
        for (let i = 1; i <= yn; i++) yv[i - 1] = B.toJs(coL, i);
        lua_settop(coL, 0);
        B.push(L2, 'yield');
        for (const v of yv) B.push(L2, v);
        return 1 + yv.length;
      }
      const m = lua.lua_tolstring(coL, -1);
      lua_settop(coL, 0);
      B.coRefs.delete(coL);
      luaL_unref(L2, LUA_REGISTRYINDEX, coRef);
      B.push(L2, 'error');
      B.push(L2, m ? to_jsstring(m) : 'unknown lua error');
      return 2;
    });

    setG('__rbxCoAlive', function (L2) {
      B.curL = L2;
      const handle = B.toJs(L2, 1);
      const coL = handle && handle.__coState;
      lua_pushboolean(L2, !!(coL && B.coRefs.has(coL)));
      return 1;
    });

    setG('__rbxReleaseFn', function (L2) {
      B.curL = L2;
      const fn = B.toJs(L2, 1);
      if (fn && fn.__rbxLuaRef !== undefined) B.releaseLuaFn(fn);
      return 0;
    });
  }
}

// Mark an array as "multiple Lua return values" (varargs).
export function rbxMulti(...args) {
  const a = args;
  a.__rbxMulti = true;
  return a;
}

function lua_pop_(L, n) {
  lua.lua_settop(L, lua_gettop(L) - n);
}
function lua_remove(L, pos) {
  lua.lua_remove(L, pos);
}
