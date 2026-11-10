"""Widget distribution profiles and primary-login isolation; synthetic values only."""
import copy
import datetime as dt
import runpy
import unittest
from pathlib import Path

p = runpy.run_path(str(Path(__file__).with_name('release-preflight.py')))

class WidgetSigning(unittest.TestCase):
    def test_shared_groups_keep_primary_login_private(self):
        for extension in (False, True):
            e = p['release_entitlements'](False, widgets=True, team_id='SYNTHETIC1', extension=extension)
            expected = ['SYNTHETIC1.app.newaveflow.mobile.widgets']
            if not extension: expected.insert(0,'SYNTHETIC1.app.newaveflow.mobile')
            self.assertEqual(e['keychain-access-groups'],expected)
            e.update({'application-identifier':'SYNTHETIC1.app.newaveflow.mobile'+('.widgets' if extension else ''), 'com.apple.developer.team-identifier':'SYNTHETIC1'})
            p['verify_signed_entitlements'](e,'SYNTHETIC1',False,widgets=True,extension=extension)
            for groups in (expected[::-1] if not extension else expected+['SYNTHETIC1.app.newaveflow.mobile'], []):
                with self.assertRaises(ValueError):
                    p['verify_signed_entitlements']({**e,'keychain-access-groups':groups},'SYNTHETIC1',False,widgets=True,extension=extension)

    def test_both_profiles_require_registered_app_group_and_correct_identifier(self):
        now = dt.datetime(2026,1,1,tzinfo=dt.timezone.utc)
        for extension in (False, True):
            e = p['release_entitlements'](False,widgets=True,team_id='SYNTHETIC1',extension=extension)
            e.update({'application-identifier':'SYNTHETIC1.app.newaveflow.mobile'+('.widgets' if extension else ''),
                      'com.apple.developer.team-identifier':'SYNTHETIC1','get-task-allow':False,'beta-reports-active':True})
            profile={'TeamIdentifier':['SYNTHETIC1'],'UUID':'00000000-1111-2222-3333-444444444444',
                     'ExpirationDate':now+dt.timedelta(days=10),'DeveloperCertificates':[b'synthetic'],'Entitlements':e}
            p['validate_profile'](profile,'SYNTHETIC1',False,now,widgets=True,extension=extension)
            for key in ('com.apple.security.application-groups','keychain-access-groups'):
                invalid=copy.deepcopy(profile);invalid['Entitlements'][key]=[]
                with self.assertRaises(ValueError):p['validate_profile'](invalid,'SYNTHETIC1',False,now,widgets=True,extension=extension)
