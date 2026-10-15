import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./screen-geometry.js', import.meta.url), 'utf8');
function measure({ top = 70, buttonTop = top, origin = 0, webWidth = 402, cssWidth = 402, safeTop = 62, title = true } = {}) {
  const element = (tagName, top) => ({ tagName, textContent: '가상 제목', getAttribute: () => null,
    getBoundingClientRect: () => ({ top, left: 16, width: 44, height: 44, bottom: top + 44 }) });
  const controls = [element('BUTTON', buttonTop), ...(title ? [element('H1', top)] : [])];
  const header = { ...element('HEADER', 0), querySelectorAll: () => controls };
  const sandbox = { document: { querySelector: () => header }, window: { innerWidth: cssWidth, innerHeight: 874, devicePixelRatio: 3 },
    native: { safeTop, webViewOriginY: origin, webViewWidth: webWidth } };
  return vm.runInNewContext(`(function(native) { ${source} })(native)`, sandbox);
}

test('the actual failing edge-to-edge header overlaps the Dynamic Island safe area', () => {
  const result = measure({ top: 8, buttonTop: 6 });
  assert.equal(result.valid, false);
  assert.equal(result.violations.length, 2);
});

test('safe-area padding protects both the title and every interactive header button', () => {
  assert.equal(measure().valid, true);
  assert.equal(measure({ buttonTop: 6 }).valid, false);
  assert.equal(measure({ title: false }).valid, false);
  assert.equal(measure({ safeTop: 0 }).valid, false);
});

test('native WebView origin and CSS scale are accounted for without double-counting insets', () => {
  assert.equal(measure({ top: 8, origin: 62 }).valid, true);
  assert.equal(measure({ top: 32, webWidth: 402, cssWidth: 201 }).valid, true);
  assert.equal(measure({ top: 30, webWidth: 402, cssWidth: 201 }).valid, false);
});
