import datetime as dt
import pathlib
import runpy
import unittest

helpers = runpy.run_path(str(pathlib.Path(__file__).with_name('release-preflight.py')))


class PushPreflightTests(unittest.TestCase):
    def test_entitlements_are_explicit_and_default_off(self):
        self.assertEqual(helpers['release_entitlements'](False), {})
        self.assertEqual(helpers['release_entitlements'](True), {'com.apple.developer.applesignin': ['Default']})
        self.assertEqual(helpers['release_entitlements'](False, True), {'aps-environment': 'production'})

    def test_signed_push_must_match_release_choice(self):
        entitlements = {'application-identifier': 'ABCDEFGHIJ.app.newaveflow.mobile',
                        'com.apple.developer.team-identifier': 'ABCDEFGHIJ'}
        helpers['verify_signed_entitlements'](entitlements, 'ABCDEFGHIJ', False)
        with self.assertRaises(ValueError):
            helpers['verify_signed_entitlements'](entitlements, 'ABCDEFGHIJ', False, True)
        entitlements['aps-environment'] = 'development'
        with self.assertRaises(ValueError):
            helpers['verify_signed_entitlements'](entitlements, 'ABCDEFGHIJ', False, True)
        entitlements['aps-environment'] = 'production'
        helpers['verify_signed_entitlements'](entitlements, 'ABCDEFGHIJ', False, True)
        with self.assertRaises(ValueError):
            helpers['verify_signed_entitlements'](entitlements, 'ABCDEFGHIJ', False, False)

    def test_profile_requires_production_push_only_when_enabled(self):
        profile = {'TeamIdentifier': ['ABCDEFGHIJ'], 'Entitlements': {
            'application-identifier': 'ABCDEFGHIJ.app.newaveflow.mobile',
            'com.apple.developer.team-identifier': 'ABCDEFGHIJ',
            'get-task-allow': False, 'beta-reports-active': True},
            'ExpirationDate': dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30),
            'UUID': '00000000-0000-0000-0000-000000000001', 'DeveloperCertificates': [b'synthetic']}
        helpers['validate_profile'](profile, 'ABCDEFGHIJ', False)
        with self.assertRaises(ValueError):
            helpers['validate_profile'](profile, 'ABCDEFGHIJ', False, push_notifications=True)
        profile['Entitlements']['aps-environment'] = 'production'
        helpers['validate_profile'](profile, 'ABCDEFGHIJ', False, push_notifications=True)


if __name__ == '__main__':
    unittest.main()
