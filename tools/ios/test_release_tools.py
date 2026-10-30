"""Synthetic regression checks for release guards; never contact Apple or use real keys."""
import base64
import copy
import datetime as dt
import json
import plistlib
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parent
preflight = runpy.run_path(str(HERE / 'release-preflight.py'))
bundle = runpy.run_path(str(HERE / 'verify-bundle.py'))
release = runpy.run_path(str(HERE / 'release.py'))


class ReleaseOrchestration(unittest.TestCase):
    def test_failed_command_never_prints_raw_private_output(self):
        with patch('subprocess.run', return_value=Mock(returncode=1, stdout=b'private owner', stderr=b'private key')):
            with self.assertRaises(ValueError) as error:
                release['command'](['signing-tool', 'private-argument'], 'Signing')
        self.assertNotIn('private owner', str(error.exception))
        self.assertNotIn('private key', str(error.exception))
        self.assertNotIn('private-argument', str(error.exception))

    def test_signed_entitlements_request_xml_and_preserve_validation(self):
        entitlements = {'application-identifier': 'SYNTHETIC1.app.newaveflow.mobile',
                        'com.apple.developer.team-identifier': 'SYNTHETIC1', 'get-task-allow': False}

        def codesign(args, **kwargs):
            # Current codesign's default display is human-readable DER, not a plist.
            output = plistlib.dumps(entitlements) if '--xml' in args else b'[Dict]\n[Key] private owner'
            return Mock(returncode=0, stdout=output, stderr=b'Executable=private path')

        with patch('subprocess.run', side_effect=codesign):
            for stage in ('Archive entitlement inspection', 'Exported entitlement inspection'):
                with self.subTest(stage=stage):
                    inspected = release['signed_entitlements'](Path('Synthetic.app'), stage)
                    self.assertEqual(inspected, entitlements)
                    preflight['verify_signed_entitlements'](inspected, 'SYNTHETIC1', False)
                    with self.assertRaises(ValueError):
                        preflight['verify_signed_entitlements'](inspected, 'DIFFERENT1', False)

    def test_invalid_plist_output_reports_stage_without_private_contents(self):
        for stage in ('Profile decoding', 'Archive entitlement inspection',
                      'Exported entitlement inspection', 'Exported profile inspection'):
            for output in (b'[Dict]\n[Key] private owner', b'<?xml version="1.0"?><private-owner>',
                           plistlib.dumps(['private owner'])):
                with self.subTest(stage=stage, output_type=output[:8]), \
                     patch('subprocess.run', return_value=Mock(returncode=0, stdout=output)):
                    with self.assertRaises(ValueError) as error:
                        release['command_plist'](['synthetic-tool', 'private-argument'], stage)
                    self.assertEqual(str(error.exception),
                                     f'{stage} returned invalid property-list data; no raw private output was published')
                    self.assertTrue(error.exception.__suppress_context__)

    def test_signing_and_upload_stop_before_platform_commands_when_not_configured(self):
        with patch.dict('os.environ', {}, clear=True), patch('subprocess.run') as run:
            for action in ('sign', 'upload'):
                with self.subTest(action=action), self.assertRaises(ValueError):
                    release[action]()
            run.assert_not_called()

    def test_cleanup_refuses_a_profile_outside_its_managed_location(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            private = root / 'owned'
            private.mkdir()
            unowned = root / 'keep.mobileprovision'
            unowned.write_text('synthetic unowned file')
            (private / 'cleanup.json').write_text(json.dumps({'profile': str(unowned)}))
            with patch.dict(release['cleanup'].__globals__, {'private_directory': lambda: private}):
                with self.assertRaises(ValueError):
                    release['cleanup']()
            self.assertEqual(unowned.read_text(), 'synthetic unowned file')


class ReleaseInputs(unittest.TestCase):
    def setUp(self):
        self.env = {'IOS_RELEASE_CONFIGURED': 'true', 'GITHUB_REF': 'refs/heads/main',
                    'RELEASE_SHA': 'a' * 40, 'GITHUB_SHA': 'a' * 40, 'RELEASE_VERSION': '1.0.0',
                    'RELEASE_BUILD': '2', 'APPLE_LOGIN': 'false', 'UPLOAD': 'false'}

    def test_archive_only_has_no_upload_confirmation_requirement(self):
        preflight['validate_inputs'](self.env)

    def test_missing_environment_and_non_main_fail_closed(self):
        for key, value in [('IOS_RELEASE_CONFIGURED', ''), ('GITHUB_REF', 'refs/heads/feature'),
                           ('RELEASE_SHA', 'b' * 40)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                preflight['validate_inputs']({**self.env, key: value})

    def test_review_branch_requires_exact_name_and_commit(self):
        env = {**self.env, 'GITHUB_REF': 'refs/heads/codex/ios-review-clarity'}
        preflight['validate_inputs'](env)
        for change in ({'RELEASE_SHA': 'b' * 40}, {'GITHUB_REF': 'refs/heads/codex/ios-review-clarity-other'},
                       {'GITHUB_REF': 'refs/tags/codex/ios-review-clarity'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                preflight['validate_inputs']({**env, **change})

    def test_upload_needs_exact_confirmation(self):
        with self.assertRaises(ValueError):
            preflight['validate_inputs']({**self.env, 'UPLOAD': 'true'})
        preflight['validate_inputs']({**self.env, 'UPLOAD': 'true', 'UPLOAD_CONFIRMATION': 'UPLOAD TO TESTFLIGHT'})

    def test_rejects_shell_and_newline_inputs(self):
        for key in ('RELEASE_SHA', 'RELEASE_VERSION', 'RELEASE_BUILD', 'APPLE_LOGIN', 'UPLOAD'):
            for value in ('$(echo injection)', '1\nOTHER=value', 'true; echo bad'):
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    preflight['validate_inputs']({**self.env, key: value})

    def test_invalid_secret_values_are_not_echoed(self):
        for value in ('', 'private-value!'):
            with self.assertRaises(ValueError) as error:
                preflight['decode_secret']({'SYNTHETIC_SECRET': value}, 'SYNTHETIC_SECRET')
            self.assertNotIn('private-value!', str(error.exception))
        self.assertEqual(preflight['decode_secret']({'S': base64.b64encode(b'synthetic').decode()}, 'S'), b'synthetic')


class ProvisioningProfiles(unittest.TestCase):
    def setUp(self):
        self.team = 'SYNTHETIC1'
        self.now = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
        self.profile = {'TeamIdentifier': [self.team], 'UUID': '00000000-1111-2222-3333-444444444444',
                        'ExpirationDate': dt.datetime(2026, 2, 1), 'DeveloperCertificates': [b'synthetic-cert'],
                        'Entitlements': {'application-identifier': f'{self.team}.app.newaveflow.mobile',
                         'com.apple.developer.team-identifier': self.team, 'get-task-allow': False,
                         'beta-reports-active': True}}

    def validate(self, profile=None, apple=False):
        return preflight['validate_profile'](profile or self.profile, self.team, apple, self.now)

    def test_valid_explicit_app_store_profile(self):
        self.assertEqual(self.validate(), self.profile['UUID'])

    def test_development_ad_hoc_enterprise_and_expired_profiles_rejected(self):
        for patch in ({'ProvisionedDevices': ['synthetic-device']}, {'ProvisionsAllDevices': True},
                      {'ExpirationDate': self.now}, {'TeamIdentifier': ['DIFFERENT1']},
                      {'DeveloperCertificates': []}, {'UUID': '../unexpected'}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.validate({**self.profile, **patch})
        for patch in ({'get-task-allow': True}, {'beta-reports-active': False},
                      {'application-identifier': f'{self.team}.*'}):
            profile = copy.deepcopy(self.profile)
            profile['Entitlements'].update(patch)
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.validate(profile)

    def test_apple_login_requires_profile_capability(self):
        with self.assertRaises(ValueError):
            self.validate(apple=True)
        self.profile['Entitlements']['com.apple.developer.applesignin'] = ['Default']
        self.validate(apple=True)

    def test_signed_app_must_match_requested_capability_and_team(self):
        entitlements = self.profile['Entitlements']
        preflight['verify_signed_entitlements'](entitlements, self.team, False)
        with self.assertRaises(ValueError):
            preflight['verify_signed_entitlements'](entitlements, self.team, True)
        with self.assertRaises(ValueError):
            preflight['verify_signed_entitlements'](entitlements, 'DIFFERENT1', False)
        entitlements['com.apple.developer.applesignin'] = ['Default']
        preflight['verify_signed_entitlements'](entitlements, self.team, True)
        with self.assertRaises(ValueError):
            preflight['verify_signed_entitlements'](entitlements, self.team, False)


class BuiltBundle(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = Path(self.temp.name) / 'App.app'
        self.app.mkdir()
        self.info = {'CFBundleIdentifier': 'app.newaveflow.mobile', 'CFBundleDisplayName': '뉴웨이브 플로우',
                     'UIDeviceFamily': [1], 'MinimumOSVersion': '15.4', 'CFBundleSupportedPlatforms': ['iPhoneSimulator'],
                     'CFBundleShortVersionString': '1.0.0', 'CFBundleVersion': '1', 'NewaveAppleSignInEnabled': 'NO',
                     'ITSAppUsesNonExemptEncryption': False,
                     'CFBundleURLTypes': [{'CFBundleURLSchemes': ['newaveflow']}],
                     'NSCameraUsageDescription': 'Synthetic camera purpose', 'NSPhotoLibraryUsageDescription': 'Synthetic photo purpose'}
        self.write_plist('Info.plist', self.info)
        self.config = {'appId': 'app.newaveflow.mobile', 'loggingBehavior': 'none',
                       'server': {'iosScheme': 'capacitor', 'hostname': 'localhost', 'cleartext': False}}
        self.write_config()
        self.write_plist('PrivacyInfo.xcprivacy', {'NSPrivacyTracking': False, 'NSPrivacyAccessedAPITypes': [
            {'NSPrivacyAccessedAPIType': 'NSPrivacyAccessedAPICategoryUserDefaults', 'NSPrivacyAccessedAPITypeReasons': ['CA92.1']}]})
        for sdk in ('Capacitor', 'Cordova'):
            self.write_plist(f'Frameworks/{sdk}.framework/PrivacyInfo.xcprivacy', {'NSPrivacyTracking': False})
        for filename in ('public/index.html', 'public/privacy/index.html', 'public/assets/app.js'):
            path = self.app / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('Synthetic test resource')

    def write_plist(self, filename, content):
        path = self.app / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(plistlib.dumps(content))

    def write_config(self):
        (self.app / 'capacitor.config.json').write_text(json.dumps(self.config))

    def test_complete_simulator_bundle(self):
        self.assertEqual(bundle['verify'](self.app)['privacyManifests'], 3)

    def test_old_ios_versions_cannot_ship_dialogs_they_do_not_support(self):
        for version in ('14.8', '15.0', '15.3'):
            self.info['MinimumOSVersion'] = version
            self.write_plist('Info.plist', self.info)
            with self.subTest(version=version), self.assertRaises(ValueError):
                bundle['verify'](self.app)

    def test_missing_or_changed_encryption_declaration_requires_review(self):
        for value in (None, True, 'false'):
            with self.subTest(value=value):
                if value is None:
                    self.info.pop('ITSAppUsesNonExemptEncryption', None)
                else:
                    self.info['ITSAppUsesNonExemptEncryption'] = value
                self.write_plist('Info.plist', self.info)
                with self.assertRaises(ValueError):
                    bundle['verify'](self.app)

    def test_sdk_manifest_must_reach_final_app(self):
        (self.app / 'Frameworks/Cordova.framework/PrivacyInfo.xcprivacy').unlink()
        with self.assertRaises(ValueError):
            bundle['verify'](self.app)

    def test_new_sdk_requires_inventory_review(self):
        self.write_plist('Frameworks/NewSDK.framework/PrivacyInfo.xcprivacy', {'NSPrivacyTracking': False})
        with self.assertRaises(ValueError):
            bundle['verify'](self.app)

    def test_tracking_or_logging_requires_review(self):
        self.config['loggingBehavior'] = 'debug'
        self.write_config()
        with self.assertRaises(ValueError):
            bundle['verify'](self.app)
        self.config['loggingBehavior'] = 'none'
        self.write_config()
        self.write_plist('Frameworks/Capacitor.framework/PrivacyInfo.xcprivacy', {'NSPrivacyTracking': True})
        with self.assertRaises(ValueError):
            bundle['verify'](self.app)

    def test_live_reload_and_private_resources_rejected(self):
        self.config['server']['url'] = 'http://localhost:5173'
        self.write_config()
        with self.assertRaises(ValueError):
            bundle['verify'](self.app)
        del self.config['server']['url']
        self.write_config()
        (self.app / 'public/unwanted.p8').write_text('synthetic forbidden resource')
        with self.assertRaises(ValueError):
            bundle['verify'](self.app)

    def test_device_and_apple_login_build_are_explicit(self):
        with self.assertRaises(ValueError):
            bundle['verify'](self.app, device=True)
        self.info.update({'CFBundleSupportedPlatforms': ['iPhoneOS'], 'NewaveAppleSignInEnabled': 'YES'})
        self.write_plist('Info.plist', self.info)
        bundle['verify'](self.app, device=True, apple_login=True)


if __name__ == '__main__':
    unittest.main()
