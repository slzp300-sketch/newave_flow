// Loaded only by the disposable native screenshot test, never by the shipped web/app bundle.
(() => {
  'use strict';
  const fixture = __NEWAVE_FIXTURE__;
  const state = window.__newaveScreenshot = { fixtureKind: fixture.fixtureKind, requests: [], errors: [] };
  const RealDate = Date;
  const fixedNow = RealDate.parse(fixture.clock);
  window.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  };
  localStorage.clear();
  sessionStorage.clear();
  const reply = (method, address) => {
    const url = new URL(address, location.href);
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    if (url.origin !== 'https://screenshots.newaveflow.invalid' || !url.pathname.startsWith('/api/') || method.toUpperCase() !== 'GET') {
      state.errors.push(`Blocked request: ${method} ${url.origin}${url.pathname}`);
      return { status: 599, body: { message: 'Screenshot fixture blocked this request' } };
    }
    state.requests.push(path);
    if (path === '/events') {
      return { status: 200, body: fixture.events.filter(event =>
        (!url.searchParams.get('from') || event.eventDate >= url.searchParams.get('from')) &&
        (!url.searchParams.get('to') || event.eventDate <= url.searchParams.get('to'))) };
    }
    if (path === '/events/903') return { status: 200, body: fixture.events.find(event => event.id === 903) };
    if (Object.hasOwn(fixture.responses, path)) return { status: 200, body: fixture.responses[path] };
    state.errors.push(`Missing fixture: ${path}`);
    return { status: 599, body: { message: 'Screenshot fixture is incomplete' } };
  };
  class FixtureXHR extends EventTarget {
    constructor() {
      super();
      this.readyState = 0; this.status = 0; this.responseType = ''; this.responseText = '';
      this.response = ''; this.timeout = 0; this.withCredentials = false;
      this.upload = new EventTarget(); this.onloadend = null; this.onreadystatechange = null;
      this.onload = null; this.onerror = null; this.onabort = null; this.ontimeout = null;
    }
    open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
    setRequestHeader() {}
    getAllResponseHeaders() { return 'content-type: application/json\r\n'; }
    getResponseHeader(name) { return name.toLowerCase() === 'content-type' ? 'application/json' : null; }
    abort() { this.aborted = true; this.emit('abort'); }
    emit(type) { const event = new Event(type); this.dispatchEvent(event); this[`on${type}`]?.(event); }
    send() {
      queueMicrotask(() => {
        if (this.aborted) return;
        const result = reply(this.method, this.url);
        this.status = result.status; this.statusText = result.status === 200 ? 'OK' : 'Fixture blocked';
        this.responseURL = this.url; this.responseText = JSON.stringify(result.body);
        this.response = this.responseType === 'json' ? result.body : this.responseText;
        this.readyState = 4; this.emit('readystatechange'); this.emit('load'); this.emit('loadend');
      });
    }
  }
  window.XMLHttpRequest = FixtureXHR;
  window.fetch = async (input, init = {}) => {
    const result = reply(init.method || input.method || 'GET', typeof input === 'string' ? input : input.url);
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } });
  };
  window.WebSocket = class { constructor() { throw new Error('Network is disabled in screenshot fixtures'); } };
  window.EventSource = window.WebSocket;
  navigator.sendBeacon = () => false;
  window.addEventListener('error', event => state.errors.push(event.message || 'Browser error'));
  window.addEventListener('unhandledrejection', event => state.errors.push(String(event.reason)));
})();
