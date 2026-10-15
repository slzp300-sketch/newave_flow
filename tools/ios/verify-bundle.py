"""Inspect the built app, not just source files. No Apple credentials required."""
import argparse
import json
import plistlib
from pathlib import Path

BUNDLE_ID = 'app.newaveflow.mobile'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_plist(path):
    with path.open('rb') as source:
        return plistlib.load(source)


def verify(app, apple_login=False, device=False):
    app = Path(app)
    info = load_plist(app / 'Info.plist')
    require(info.get('CFBundleIdentifier') == BUNDLE_ID, 'Unexpected app identifier')
    require(info.get('CFBundleDisplayName') == '뉴웨이브 플로우', 'App name is missing')
    require(info.get('UIDeviceFamily') == [1], 'Review iPad assets before changing supported devices')
    require(float(info.get('MinimumOSVersion', '0')) >= 15, 'Unsupported minimum iOS version')
    expected_platform = 'iPhoneOS' if device else 'iPhoneSimulator'
    require(expected_platform in info.get('CFBundleSupportedPlatforms', []), 'Wrong build platform')
    require(info.get('NewaveAppleSignInEnabled') == ('YES' if apple_login else 'NO'), 'Apple login setting mismatch')
    schemes = [s for entry in info.get('CFBundleURLTypes', []) for s in entry.get('CFBundleURLSchemes', [])]
    require(schemes == ['newaveflow'], 'Unexpected callback URL schemes')
    require(not info.get('NSAppTransportSecurity', {}).get('NSAllowsArbitraryLoads'), 'Unrestricted HTTP is enabled')
    for key in ('NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription'):
        require(len(info.get(key, '')) > 10, 'Missing photo/camera purpose text')
    config = json.loads((app / 'capacitor.config.json').read_text(encoding='utf8'))
    server = config.get('server', {})
    require(config.get('appId') == BUNDLE_ID, 'Capacitor app identifier mismatch')
    require(config.get('loggingBehavior') == 'none', 'Native bridge logging is enabled')
    require(not server.get('url') and not server.get('cleartext'), 'Live reload or HTTP is enabled')
    require(server.get('iosScheme') == 'capacitor' and server.get('hostname') == 'localhost', 'Unexpected webview origin')
    require((app / 'public/index.html').is_file(), 'Bundled web application is missing')
    require((app / 'public/privacy/index.html').is_file(), 'Bundled privacy policy is missing')
    require(any((app / 'public/assets').glob('*.js')), 'Built JavaScript is missing')
    # Source maps and native credentials must never become ordinary app resources.
    forbidden = {'.p8', '.p12', '.pem', '.key', '.map'}
    for resource in (app / 'public').rglob('*'):
        require(resource.suffix.lower() not in forbidden and not resource.name.startswith('.env'), 'Private/development resource in web bundle')
    privacy_paths = [app / 'PrivacyInfo.xcprivacy'] + [
        app / f'Frameworks/{sdk}.framework/PrivacyInfo.xcprivacy' for sdk in ('Capacitor', 'Cordova')
    ]
    require({path.name for path in (app / 'Frameworks').glob('*.framework')} == {'Capacitor.framework', 'Cordova.framework'},
            'Native SDK inventory changed; review manifests and signatures before releasing')
    require(set(app.rglob('PrivacyInfo.xcprivacy')) == set(privacy_paths), 'Privacy manifest inventory changed; review the added SDK/resource')
    for privacy_path in privacy_paths:
        privacy = load_plist(privacy_path)
        require(privacy.get('NSPrivacyTracking') is False, 'Unexpected tracking declaration')
        require(not privacy.get('NSPrivacyTrackingDomains'), 'Tracking domains require a new privacy review')
    app_privacy = load_plist(privacy_paths[0])
    require(any(entry.get('NSPrivacyAccessedAPIType') == 'NSPrivacyAccessedAPICategoryUserDefaults'
                and 'CA92.1' in entry.get('NSPrivacyAccessedAPITypeReasons', [])
                for entry in app_privacy.get('NSPrivacyAccessedAPITypes', [])), 'Missing UserDefaults reason')
    return {'bundleId': BUNDLE_ID, 'version': info.get('CFBundleShortVersionString'),
            'build': info.get('CFBundleVersion'), 'platform': expected_platform,
            'appleLogin': apple_login, 'privacyManifests': 3}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('app', type=Path)
    parser.add_argument('--device', action='store_true')
    parser.add_argument('--apple-login', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.app, args.apple_login, args.device), ensure_ascii=False))
    except (OSError, ValueError, plistlib.InvalidFileException) as error:
        raise SystemExit(f'iOS bundle check failed: {error}') from None
