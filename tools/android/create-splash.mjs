import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Export the established SVG emblem as Android vectors, without changing its paths.
const root = new URL('../../', import.meta.url)
const source = readFileSync(new URL('frontend/public/brand/newave-emblem.svg', root), 'utf8')
const [, width, height] = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
const body = source.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '')
  .replace(/<g transform="translate\(0 ([\d.]+)\) scale\(1 -1\)">/g, '<group android:translateY="$1" android:scaleY="-1">')
  .replace(/<g transform="matrix\(1 0 0 1 ([-\d.]+) ([-\d.]+)\)">/g, '<group android:translateX="$1" android:translateY="$2">')
  .replace(/<g>/g, '<group>').replace(/<\/g>/g, '</group>')
  .replace(/<path d=/g, '<path android:fillColor="#FFFFFF" android:pathData=')
if (/transform=|<g\b|<svg|\bd=/.test(body)) throw new Error('Unsupported SVG transform; do not export a changed logo.')
const vector = (dimensions, content) => `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from newave-emblem.svg by tools/android/create-splash.mjs. -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android" ${dimensions}>\n${content}\n</vector>\n`
const output = new URL('frontend/android/app/src/main/res/drawable/', root)
writeFileSync(new URL('newave_splash_logo.xml', output), vector(`android:width="208dp" android:height="174dp" android:viewportWidth="${width}" android:viewportHeight="${height}"`, body))
const logoWidth = 144
const scale = logoWidth / Number(width)
const top = (288 - Number(height) * scale) / 2
writeFileSync(new URL('newave_splash_icon.xml', output), vector('android:width="288dp" android:height="288dp" android:viewportWidth="288" android:viewportHeight="288"', `<group android:translateX="72" android:translateY="${top}" android:scaleX="${scale}" android:scaleY="${scale}">${body}</group>`))
if (Math.hypot(logoWidth, Number(height) * scale) > 192) throw new Error('Logo exceeds the Android 12 safe circle.')
console.log(`Exported full emblem and safe Android 12 icon to ${fileURLToPath(output)}`)
