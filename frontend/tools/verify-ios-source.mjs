import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const plist = require('plist')
const xcode = require('xcode')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = path.join(root, 'ios/App/App')
const info = plist.parse(fs.readFileSync(path.join(app, 'Info.plist'), 'utf8'))
const privacy = plist.parse(fs.readFileSync(path.join(app, 'PrivacyInfo.xcprivacy'), 'utf8'))
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'))
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
assert.equal(packageInfo.dependencies['@capacitor/ios'], packageInfo.dependencies['@capacitor/core'])
assert.equal(config.appId, 'app.newaveflow.mobile')
assert.equal(config.server.iosScheme, 'capacitor')
assert.equal(config.server.cleartext, false)
assert.equal(config.server.url, undefined, 'Live reload must not ship in the app')
assert.equal(info.CFBundleDisplayName, '뉴웨이브 플로우')
assert.deepEqual(info.CFBundleURLTypes.flatMap(v => v.CFBundleURLSchemes), ['newaveflow'])
assert.equal(info.NSAppTransportSecurity?.NSAllowsArbitraryLoads, undefined)
assert.ok(info.NSCameraUsageDescription?.length > 10)
assert.ok(info.NSPhotoLibraryUsageDescription?.length > 10)
assert.equal(privacy.NSPrivacyTracking, false)
assert.ok(privacy.NSPrivacyAccessedAPITypes.some(v => v.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults' && v.NSPrivacyAccessedAPITypeReasons.includes('CA92.1')))

const project = xcode.project(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'))
project.parseSync()
const objects = project.hash.project.objects
const appTarget = project.getFirstTarget()
const targets = Object.entries(objects.PBXNativeTarget).filter(([,v]) => v?.isa === 'PBXNativeTarget')
const tests = targets.find(([,v]) => v.productType?.includes('unit-test'))
assert.ok(tests, 'Native keychain tests must be part of the Xcode project')
assert.equal(objects.PBXFileReference[tests[1].productReference].path.replaceAll('"',''), 'AppTests.xctest')
assert.equal(appTarget.firstTarget.dependencies.length, 0, 'App must not depend on its test bundle')
assert.ok(tests[1].dependencies.some(d => objects.PBXTargetDependency[d.value].target === appTarget.uuid))
const sources = objects.PBXSourcesBuildPhase[appTarget.firstTarget.buildPhases.find(p => p.comment === 'Sources').value]
const sourceNames = sources.files.map(f => objects.PBXFileReference[objects.PBXBuildFile[f.value].fileRef].path.replaceAll('"', ''))
for (const name of ['NewaveBridgeViewController.swift','NewaveKeychainStore.swift','NewaveSecureStoragePlugin.swift']) assert.ok(sourceNames.includes(name), `${name} must compile in App`)
assert.ok(fs.readFileSync(path.join(app, 'SceneDelegate.swift'),'utf8').includes('NewaveBridgeViewController()'))
assert.ok(fs.readFileSync(path.join(app, 'Base.lproj/Main.storyboard'),'utf8').includes('customClass="NewaveBridgeViewController"'))
const icon = fs.readFileSync(path.join(app,'Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'))
assert.equal(icon.readUInt32BE(16),1024)
assert.equal(icon.readUInt32BE(20),1024)
// PNG color types 4 and 6 carry alpha, which App Store icons may not contain.
assert.ok([0,2,3].includes(icon[25]), 'App icon must have no alpha channel')
const swiftPackage = fs.readFileSync(path.join(root,'ios/App/CapApp-SPM/Package.swift'),'utf8')
assert.ok(swiftPackage.includes('exact: "8.5.3"'))
assert.ok(!swiftPackage.includes('C:\\') && !swiftPackage.includes('/Users/'))
console.log('iOS source checks passed: native wiring, Keychain test target, package versions, icon, privacy and HTTPS settings')
