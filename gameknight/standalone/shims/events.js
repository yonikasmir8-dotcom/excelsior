class EventEmitter {
  constructor() { this._l = {}; }
  setMaxListeners() {}
  on(n, f) { (this._l[n] ||= []).push(f); return this; }
  off(n, f) { this._l[n] = (this._l[n] || []).filter(x => x !== f); return this; }
  emit(n, ...a) { for (const f of [...(this._l[n] || [])]) f(...a); return !!(this._l[n] || []).length; }
}
module.exports = { EventEmitter };
