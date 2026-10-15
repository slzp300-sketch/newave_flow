// Function body evaluated by WKWebView with its actual native-window geometry as `native`.
// It only measures the rendered app; it never changes layout or safe-area CSS.
const rect = element => {
  const r = element.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
};
const header = document.querySelector('header');
const pointScale = native.webViewWidth / window.innerWidth;
const controls = header ? [...header.querySelectorAll('h1, button')].map(element => {
  const bounds = rect(element);
  return { tag: element.tagName, label: element.getAttribute('aria-label') || element.textContent?.trim() || '',
    bounds, windowTop: native.webViewOriginY + bounds.top * pointScale };
}).filter(control => control.bounds.width > 0 && control.bounds.height > 0) : [];
const violations = [];
if (!(native.safeTop > 0) || !(pointScale > 0) || !Number.isFinite(pointScale)) violations.push('Missing native iPhone safe-area geometry');
if (!header || !controls.some(control => control.tag === 'H1')) violations.push('Visible header title is missing');
for (const control of controls) {
  if (control.windowTop < native.safeTop - 1) violations.push(`${control.tag} ${control.label} overlaps the native top safe area`);
}
return { valid: violations.length === 0, native, viewport: { width: window.innerWidth, height: window.innerHeight,
  devicePixelRatio: window.devicePixelRatio }, pointScale, header: header ? rect(header) : null, controls, violations };
