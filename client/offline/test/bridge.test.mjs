// Node test: Lua<->JS bridge
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from '../vendor/fengari.mjs';
import { Bridge, rbxMulti } from '../src/lua/bridge.js';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
const B = new Bridge().init(L);

function run(code, nresults = 1) {
  const rc = lauxlib.luaL_loadstring(L, to_luastring(code));
  if (rc !== 0) {
    const m = lua.lua_tolstring(L, -1);
    lua.lua_settop(L, 0);
    return { err: 'load: ' + (m ? to_jsstring(m) : '?') };
  }
  const res = lua.lua_pcall(L, 0, nresults, 0);
  if (res !== 0) {
    const m = lua.lua_tolstring(L, -1);
    lua.lua_settop(L, 0);
    return { err: 'pcall: ' + (m ? to_jsstring(m) : '?') };
  }
  const out = [];
  for (let i = 0; i < nresults; i++) out.push(B.toJs(L, -(nresults - i)));
  lua.lua_settop(L, 0);
  return { out };
}

// call a global JS-exposed Lua helper with JS args, from JS
function callGlobal(name, ...args) {
  const saved = lua.lua_gettop(L);
  lua.lua_getglobal(L, to_luastring(name));
  for (const a of args) B.push(L, a);
  const r = lua.lua_pcall(L, args.length, lua.LUA_MULTRET, 0);
  if (r !== lua.LUA_OK) {
    const m = lua.lua_tolstring(L, -1);
    lua.lua_settop(L, saved);
    throw new Error('callGlobal ' + name + ': ' + (m ? to_jsstring(m) : r));
  }
  const n = lua.lua_gettop(L);
  const out = [];
  for (let i = 1; i <= n; i++) out.push(B.toJs(L, i));
  lua.lua_settop(L, saved);
  return out;
}

// ---- basic object exposure ----
const part = {
  _name: 'Baseplate',
  get Name() { return this._name; },
  set Name(v) { this._name = v; },
  _size: { x: 4, y: 1, z: 2 },
  getSize(self) { return rbxMulti(self._size.x, self._size.y, self._size.z); },
  setPos(self, x, y, z) { self._pos = rbxMulti(x, y, z); },
  get Pos() { return this._pos || rbxMulti(0, 0, 0); },
  getPos(self) { return rbxMulti(...(self._pos || [0, 0, 0])); },
};
B.push(L, part);
lua.lua_setglobal(L, to_luastring('part'));

{
  const r = run('return part.Name');
  check('prop get', r.out[0] === 'Baseplate', JSON.stringify(r));
  const r2 = run('part.Name = "NewName" return part.Name');
  check('prop set', r2.out[0] === 'NewName', JSON.stringify(r2));
  const r3 = run('local a,b,c = part:getSize() return a+b+c');
  check('colon call', r3.out[0] === 7, JSON.stringify(r3));
  const r4 = run('part:setPos(1, 2, 3) local x,y,z = part:getPos() return x*100 + y*10 + z');
  check('set + tuple get', r4.out[0] === 123, JSON.stringify(r4));
}

// ---- fn proxy (dot call, no self) + operators ----
const vecMod = {
  new(x, y, z) {
    return {
      x, y, z,
      mag(self) { return Math.sqrt(self.x * self.x + self.y * self.y + self.z * self.z); },
      __rbxAdd(self, o) { return vecMod.new(self.x + o.x, self.y + o.y, self.z + o.z); },
      __rbxMul(self, k) { return typeof k === 'number' ? vecMod.new(self.x * k, self.y * k, self.z * k) : self; },
      __rbxToString(self) { return `Vector3(${self.x}, ${self.y}, ${self.z})`; },
      __rbxEq(self, o) { return !!(o && o.x === self.x && o.y === self.y && o.z === self.z); },
    };
  },
};
B.push(L, vecMod);
lua.lua_setglobal(L, to_luastring('Vector3'));
{
  const r = run('local v = Vector3.new(3, 4, 0) return v.x + v.y');
  check('ctor dot call', r.out[0] === 7, JSON.stringify(r));
  const r2 = run('local v = Vector3.new(3, 4, 0) local w = v + Vector3.new(1, 1, 1) return w.x');
  check('operator +', r2.out[0] === 4, JSON.stringify(r2));
  const r3 = run('local v = Vector3.new(3, 4, 0) local w = v * 2 return w.y');
  check('operator *', r3.out[0] === 8, JSON.stringify(r3));
  const r4 = run('local v = Vector3.new(1, 2, 3) return tostring(v)');
  check('tostring', r4.out[0] === 'Vector3(1, 2, 3)', JSON.stringify(r4));
  const r5 = run('local v = Vector3.new(1, 2, 3) return v == Vector3.new(1, 2, 3)');
  check('operator ==', r5.out[0] === true, JSON.stringify(r5));
  const r6 = run('local v = Vector3.new(3, 4, 0) return v:mag()');
  check('method call', r6.out[0] === 5, JSON.stringify(r6));
}

// ---- Lua function passed to JS, stored, called later (signal pattern) ----
{
  const sig = {
    handlers: [],
    Connect(self, fn) { self.handlers.push(fn); return { disconnect() {} }; },
    Fire(self, ...args) { for (const h of self.handlers) h(...args); },
  };
  B.push(L, sig);
  lua.lua_setglobal(L, to_luastring('sig'));
  const r = run(`
    sig:Connect(function(x) seen = seen .. x end)
    seen = ''
    sig:Fire('z')
    return seen
  `);
  check('signal connect/fire', r.out[0] === 'z', JSON.stringify(r));
  sig.handlers.length = 0;
  const r2 = run(`
    local n = 0
    sig:Connect(function() n = n + 1 end)
    sig:Fire() sig:Fire() sig:Fire()
    return n
  `);
  check('multiple fires', r2.out[0] === 3, JSON.stringify(r2));
}

// ---- coroutine + yield scheduling ----
{
  const defR = run(`
    __yieldFn = function()
      local r1 = coroutine.yield(1)
      local r2 = coroutine.yield(2)
      return r1 .. '-' .. r2
    end
    return 'ok'
  `);
  check('yield fn def', defR.out[0] === 'ok', JSON.stringify(defR));

  const got = callGlobal('__rbxInvokeInCo', (function () {
    // fetch the lua function __yieldFn as a JS wrapper
    lua.lua_getglobal(L, to_luastring('__yieldFn'));
    const v = B.toJs(L, -1);
    lua.lua_settop(L, lua.lua_gettop(L) - 1);
    return v;
  })());
  // contract: (handle, 'done'|'yield'|'error', ...values)
  const safe = (arr) => arr.map((v) =>
    v && typeof v === 'object' && v.__coRef !== undefined ? '<coHandle>' : v
  ).join(',');
  check('first yield value', got[1] === 'yield' && got[2] === 1, safe(got));
  const got2 = callGlobal('__rbxResumeCo', got[0], 10);
  // contract: ('done'|'yield'|'error', ...values)
  check('second yield value', got2[0] === 'yield' && got2[1] === 2, safe(got2));
  const got3 = callGlobal('__rbxResumeCo', got[0], 20);
  check('final result', got3[0] === 'done' && got3[1] === '10-20', safe(got3));
}

// ---- pairs over JS object ----
{
  const obj = { a: 1, b: 2, c: 3 };
  B.push(L, obj);
  lua.lua_setglobal(L, to_luastring('po'));
  const r = run('local n = 0 for k, v in pairs(po) do n = n + v end return n');
  check('pairs', r.out[0] === 6, JSON.stringify(r));
}

// ---- table conversion both ways ----
{
  const r = run('return {1, 2, 3}');
  const arr = r.out[0];
  check('lua table -> js', Array.isArray(arr) && arr[0] === 1 && arr[2] === 3, JSON.stringify(arr));
  const arrFn = { make() { return ['x', 'y', 'z']; } };
  B.push(L, arrFn);
  lua.lua_setglobal(L, to_luastring('af'));
  const r2 = run('local t = af:make() return #t .. t[1] .. t[3]');
  check('js array -> lua', r2.out[0] === '3xz', JSON.stringify(r2));
}

// ---- error propagation ----
{
  const boom = { go() { throw new Error('kaboom'); } };
  B.push(L, boom);
  lua.lua_setglobal(L, to_luastring('boom'));
  const r = run('local ok, err = pcall(function() boom:go() end) return ok, err', 2);
  check('js error pcall', r.out[0] === false && /kaboom/.test(r.out[1] || ''), JSON.stringify(r));
}

// ---- recursive lua fn through JS (call depth / reentrancy) ----
{
  const r = run(`
    local function fib(n) if n < 2 then return n end return fib(n-1) + fib(n-2) end
    __fib = fib
    return 'ok'
  `);
  check('fib def', r.out[0] === 'ok');
  const fibJs = (function () {
    lua.lua_getglobal(L, to_luastring('__fib'));
    const v = B.toJs(L, -1);
    lua.lua_settop(L, lua.lua_gettop(L) - 1);
    return v;
  })();
  check('fib via js', fibJs(10) === 55, String(fibJs(10)));
}

console.log(failures === 0 ? '\nALL BRIDGE TESTS PASSED' : `\n${failures} BRIDGE TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
