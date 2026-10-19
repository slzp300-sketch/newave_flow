"""Manual macOS signing/upload; keep credentials and signed artifacts off public CI artifacts."""
import argparse
import hashlib
import json
import os
import plistlib
import re
import runpy
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
helpers = runpy.run_path(str(HERE / 'release-preflight.py'))
require = helpers['require']
verify_bundle = runpy.run_path(str(HERE / 'verify-bundle.py'))['verify']


def command(args, label, *, cwd=None, env=None):
    # Signing tools may print a certificate owner's real name or profile contents.
    # Never forward their raw output/arguments to public GitHub logs/artifacts.
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True)
    require(result.returncode == 0, f'{label} failed; no signing credentials or raw private logs were published')
    return result.stdout


def command_plist(args, label):
    output = command(args, label)
    try:
        result = plistlib.loads(output)
        require(isinstance(result, dict), 'Expected a property-list dictionary')
    except Exception:
        # Parser errors can contain fragments of private tool output.
        raise ValueError(f'{label} returned invalid property-list data; no raw private output was published') from None
    return result


def signed_entitlements(app, label):
    # Modern codesign defaults to a human-readable DER representation, not a plist.
    # https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles
    return command_plist(['codesign', '--display', '--entitlements', '-', '--xml', str(app)], label)


def private_directory():
    require(sys.platform == 'darwin', 'Signing/upload only runs on a disposable macOS runner')
    temp = Path(os.environ['RUNNER_TEMP']).resolve()
    private = temp / 'newave-ios-release'
    require(private.parent == temp and not private.is_symlink(), 'Unexpected temporary release directory')
    return private


def sign():
    helpers['validate_inputs'](os.environ)
    private = private_directory()
    require(not private.exists(), 'Use a fresh runner for each signed build')
    private.mkdir(mode=0o700)
    team = os.environ.get('APPLE_TEAM_ID', '')
    apple = os.environ['APPLE_LOGIN'] == 'true'
    push = os.environ.get('PUSH_NOTIFICATIONS', 'false') == 'true'
    certificate = private / 'distribution.p12'
    certificate.write_bytes(helpers['decode_secret'](os.environ, 'IOS_CERTIFICATE_BASE64'))
    profile_file = private / 'distribution.mobileprovision'
    profile_file.write_bytes(helpers['decode_secret'](os.environ, 'IOS_PROFILE_BASE64'))
    require(bool(os.environ.get('P12_PASSWORD')), 'Missing secret: P12_PASSWORD')
    profile = command_plist(['security', 'cms', '-D', '-i', str(profile_file)], 'Profile decoding')
    profile_uuid = helpers['validate_profile'](profile, team, apple, push_notifications=push)
    entitlement_file = private / 'release.entitlements'
    entitlement_file.write_bytes(plistlib.dumps(helpers['release_entitlements'](apple, push)))
    cert_pem = private / 'distribution.pem'
    cert_pem.write_bytes(command(['openssl', 'pkcs12', '-in', str(certificate), '-clcerts', '-nokeys',
                                 '-passin', 'env:P12_PASSWORD'], 'Certificate decoding'))
    cert_der = command(['openssl', 'x509', '-in', str(cert_pem), '-outform', 'DER'], 'Certificate conversion')
    require(cert_der in profile['DeveloperCertificates'], 'Certificate is not included in the provisioning profile')
    command(['openssl', 'x509', '-in', str(cert_pem), '-checkend', '86400', '-noout'], 'Certificate expiration check')
    keychain = private / 'signing.keychain-db'
    password = secrets.token_urlsafe(32)
    command(['security', 'create-keychain', '-p', password, str(keychain)], 'Temporary keychain creation')
    command(['security', 'set-keychain-settings', '-lut', '3600', str(keychain)], 'Keychain settings')
    command(['security', 'unlock-keychain', '-p', password, str(keychain)], 'Keychain unlock')
    command(['security', 'import', str(certificate), '-P', os.environ['P12_PASSWORD'], '-A', '-t', 'cert',
             '-f', 'pkcs12', '-k', str(keychain)], 'Signing identity import')
    command(['security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-k', password,
             str(keychain)], 'Signing access configuration')
    command(['security', 'list-keychains', '-d', 'user', '-s', str(keychain)], 'Signing keychain selection')
    identities = command(['security', 'find-identity', '-v', '-p', 'codesigning', str(keychain)], 'Signing identity validation').decode()
    matches = re.findall(r'\b([A-Fa-f0-9]{40})\s+"Apple Distribution:', identities)
    require(len(matches) == 1, 'Exactly one valid Apple Distribution identity is required')
    installed = Path.home() / 'Library/MobileDevice/Provisioning Profiles' / f'{profile_uuid}.mobileprovision'
    require(not installed.exists(), 'A provisioning profile already exists; use a fresh runner')
    installed.parent.mkdir(parents=True, exist_ok=True)
    # Persist only our cleanup target, before installing it. Never remove other profiles.
    (private / 'cleanup.json').write_text(json.dumps({'profile': str(installed)}))
    shutil.copyfile(profile_file, installed)
    archive = private / 'App.xcarchive'
    print('Creating the signed archive for the confirmed commit.')
    command(['xcodebuild', '-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Release',
             '-destination', 'generic/platform=iOS', '-archivePath', str(archive),
             '-derivedDataPath', str(private / 'DerivedData'), 'archive',
             'CODE_SIGN_STYLE=Manual', f'DEVELOPMENT_TEAM={team}', f'CODE_SIGN_IDENTITY={matches[0]}',
             f'PROVISIONING_PROFILE_SPECIFIER={profile_uuid}', f'OTHER_CODE_SIGN_FLAGS=--keychain {keychain}',
             f'MARKETING_VERSION={os.environ["RELEASE_VERSION"]}', f'CURRENT_PROJECT_VERSION={os.environ["RELEASE_BUILD"]}',
             f'NEWAVE_APPLE_SIGN_IN_ENABLED={"YES" if apple else "NO"}',
             f'CODE_SIGN_ENTITLEMENTS={entitlement_file}'],
            'Signed archive build', cwd=ROOT / 'frontend')
    app = archive / 'Products/Applications/App.app'
    summary = verify_bundle(app, apple_login=apple, device=True)
    require(summary['version'] == os.environ['RELEASE_VERSION'] and summary['build'] == os.environ['RELEASE_BUILD'], 'Archive version mismatch')
    command(['codesign', '--verify', '--deep', '--strict', str(app)], 'Archive signature validation')
    archive_entitlements = signed_entitlements(app, 'Archive entitlement inspection')
    helpers['verify_signed_entitlements'](archive_entitlements, team, apple, push)
    export = private / 'ExportOptions.plist'
    export.write_bytes(plistlib.dumps({'method': 'app-store-connect', 'destination': 'export',
        'signingStyle': 'manual', 'teamID': team, 'signingCertificate': matches[0],
        'provisioningProfiles': {helpers['BUNDLE_ID']: profile_uuid},
        'manageAppVersionAndBuildNumber': False, 'uploadSymbols': False}))
    command(['xcodebuild', '-exportArchive', '-archivePath', str(archive), '-exportOptionsPlist', str(export),
             '-exportPath', str(private / 'export')], 'IPA export')
    ipas = list((private / 'export').glob('*.ipa'))
    require(len(ipas) == 1, 'Expected one exported IPA')
    command(['ditto', '-x', '-k', str(ipas[0]), str(private / 'unpacked')], 'Exported IPA inspection')
    exported_app = private / 'unpacked/Payload/App.app'
    exported = verify_bundle(exported_app, apple_login=apple, device=True)
    require(exported == summary, 'Export changed the app metadata')
    command(['codesign', '--verify', '--deep', '--strict', str(exported_app)], 'Exported IPA signature validation')
    exported_entitlements = signed_entitlements(exported_app, 'Exported entitlement inspection')
    helpers['verify_signed_entitlements'](exported_entitlements, team, apple, push)
    exported_profile = command_plist(['security', 'cms', '-D', '-i', str(exported_app / 'embedded.mobileprovision')], 'Exported profile inspection')
    require(helpers['validate_profile'](exported_profile, team, apple, push_notifications=push) == profile_uuid, 'Export used a different provisioning profile')
    summary.update({'commit': os.environ['RELEASE_SHA'], 'ipaSha256': hashlib.sha256(ipas[0].read_bytes()).hexdigest(),
                    'pushEnabled': push, 'uploadCommandCompleted': False, 'appleProcessingVerified': False})
    (private / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf8')
    print('Signed archive, entitlements, privacy resources and IPA export passed. No Apple upload has occurred.')


def upload():
    helpers['validate_inputs'](os.environ)
    require(os.environ['UPLOAD'] == 'true', 'Upload was not requested')
    private = private_directory()
    summary_file = private / 'summary.json'
    summary = json.loads(summary_file.read_text())
    require(summary['commit'] == os.environ['RELEASE_SHA'], 'Release summary commit mismatch')
    key_id = os.environ.get('ASC_API_KEY_ID', '')
    issuer = os.environ.get('ASC_API_ISSUER_ID', '')
    require(re.fullmatch(r'[A-Z0-9]{10}', key_id) is not None, 'A team App Store Connect API key ID is required')
    require(re.fullmatch(helpers['UUID_PATTERN'], issuer) is not None, 'A team App Store Connect API issuer ID is required')
    key = helpers['decode_secret'](os.environ, 'ASC_API_KEY_BASE64')
    require(key.startswith(b'-----BEGIN PRIVATE KEY-----'), 'Expected an App Store Connect private key')
    key_dir = private / 'private_keys'
    key_dir.mkdir(mode=0o700)
    (key_dir / f'AuthKey_{key_id}.p8').write_bytes(key)
    ipas = list((private / 'export').glob('*.ipa'))
    require(len(ipas) == 1 and hashlib.sha256(ipas[0].read_bytes()).hexdigest() == summary['ipaSha256'], 'Exported IPA changed')
    # The .p8 lookup directory is local to this command. No Apple ID/password or key text in argv.
    env = {**os.environ, 'API_PRIVATE_KEYS_DIR': str(key_dir)}
    auth = ['--apiKey', key_id, '--apiIssuer', issuer]
    command(['xcrun', 'altool', '--validate-app', '-f', str(ipas[0]), '-t', 'ios', *auth], 'Apple binary validation', env=env)
    command(['xcrun', 'altool', '--upload-app', '-f', str(ipas[0]), '-t', 'ios', *auth], 'Apple binary upload', env=env)
    # Tool success is delivery evidence only. Confirm processing in App Store Connect separately.
    summary['uploadCommandCompleted'] = True
    summary_file.write_text(json.dumps(summary, indent=2), encoding='utf8')
    print('Upload command completed. App Store Connect processing and TestFlight availability remain unverified.')


def cleanup():
    private = private_directory()
    if not private.exists():
        return
    target = private / 'cleanup.json'
    if target.is_file():
        installed = Path(json.loads(target.read_text())['profile'])
        expected_parent = Path.home() / 'Library/MobileDevice/Provisioning Profiles'
        require(installed.parent == expected_parent and re.fullmatch(helpers['UUID_PATTERN'] + r'\.mobileprovision', installed.name), 'Unexpected profile cleanup target')
        installed.unlink(missing_ok=True)
    keychain = private / 'signing.keychain-db'
    if keychain.exists():
        command(['security', 'delete-keychain', str(keychain)], 'Temporary keychain cleanup')
    shutil.rmtree(private)
    print('Removed this run\'s signing material and signed artifacts.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('sign', 'upload', 'cleanup'))
    try:
        globals()[parser.parse_args().action]()
    except (OSError, ValueError, plistlib.InvalidFileException) as error:
        # Do not print subprocess arguments, environment values, or private profile data.
        raise SystemExit(str(error)) from None
