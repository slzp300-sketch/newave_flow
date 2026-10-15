import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fixture = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const script = readFileSync(new URL('./fixture-network.js', import.meta.url), 'utf8')
  .replace('__NEWAVE_FIXTURE__', JSON.stringify(fixture));
function install() {
  const sandbox = { URL, EventTarget, Event, Response, queueMicrotask,
    location: { href: 'capacitor://localhost/' }, navigator: {},
    localStorage: { clear() {} }, sessionStorage: { clear() {} }, addEventListener() {} };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(script, context);
  return context;
}
const address = path => `https://screenshots.newaveflow.invalid/api${path}`;

test('every captured scene has explicit successful GET fixtures', async () => {
  const context = install();
  assert.equal(fixture.scenes.length, 5);
  for (const scene of fixture.scenes) {
    for (const path of scene.requests) {
      assert.equal((await context.fetch(address(path))).status, 200, path);
    }
  }
  assert.equal(context.__newaveScreenshot.errors.length, 0);
});

test('unknown, production, relative API and write requests fail closed without real fetch/XHR', async () => {
  const context = install();
  for (const [url, method] of [[address('/unimplemented'), 'GET'],
    ['https://newaveflow-production.up.railway.app/api/classes', 'GET'],
    ['/api/classes', 'GET'], [address('/attendance'), 'POST']]) {
    const response = await context.fetch(url, { method });
    assert.equal(response.status, 599);
  }
  assert.equal(context.__newaveScreenshot.errors.length, 4);
  assert.equal(context.navigator.sendBeacon('https://example.invalid', 'data'), false);
  assert.throws(() => new context.WebSocket('wss://example.invalid'));
});

test('XHR returns the actual JSON contract and loadend used by Axios', async () => {
  const context = install();
  const xhr = new context.XMLHttpRequest();
  const completed = new Promise(resolve => { xhr.onloadend = resolve; });
  xhr.open('GET', address('/classes/901/students'));
  xhr.setRequestHeader('Authorization', 'synthetic-only');
  xhr.send();
  await completed;
  assert.equal(xhr.readyState, 4);
  assert.equal(xhr.status, 200);
  assert.equal(JSON.parse(xhr.responseText)[0].name, '김새봄');
  assert.match(xhr.getAllResponseHeaders(), /application\/json/);
});

test('clock and event date windows are reproducible without changing native app pixels', async () => {
  const context = install();
  assert.equal(vm.runInContext('new Date().toISOString()', context), fixture.clock);
  assert.equal(vm.runInContext('new Date(2026, 0, 1).getFullYear()', context), 2026);
  const events = await (await context.fetch(address('/events?from=2026-10-11&to=2026-10-17'))).json();
  assert.deepEqual(events.map(event => event.id), [901, 902]);
  assert.equal(fixture.user.email.endsWith('.invalid'), true);
});

test('aborted XHR cannot later complete or record a request', async () => {
  const context = install();
  const xhr = new context.XMLHttpRequest();
  let loaded = false;
  xhr.onloadend = () => { loaded = true; };
  xhr.open('GET', address('/classes'));
  xhr.send();
  xhr.abort();
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(loaded, false);
  assert.equal(context.__newaveScreenshot.requests.length, 0);
});
