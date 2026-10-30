"""Fail-closed validation helpers for the manually started TestFlight workflow."""
import base64
import datetime as dt
import os
import re

BUNDLE_ID = 'app.newaveflow.mobile'
UUID_PATTERN = r'[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_inputs(env):
    require(env.get('IOS_RELEASE_CONFIGURED') == 'true', 'Configure the protected ios-testflight environment first')
    require(env.get('GITHUB_REF') in ('refs/heads/main', 'refs/heads/codex/ios-review-clarity', 'refs/heads/codex/ios-first-update'), 'Signed builds require an explicitly approved release branch')
    sha = env.get('RELEASE_SHA', '')
    require(re.fullmatch(r'[a-f0-9]{40}', sha) is not None and sha == env.get('GITHUB_SHA'), 'Confirm the exact current selected-branch commit SHA')
    require(re.fullmatch(r'[1-9][0-9]{0,3}\.(?:0|[1-9][0-9]{0,1})\.(?:0|[1-9][0-9]{0,1})', env.get('RELEASE_VERSION', '')) is not None, 'Use a numeric version such as 1.0.0')
    require(re.fullmatch(r'[1-9][0-9]{0,3}', env.get('RELEASE_BUILD', '')) is not None, 'Use an unused build number between 1 and 9999')
    require(env.get('APPLE_LOGIN') in ('true', 'false'), 'Explicit Apple login choice required')
    require(env.get('PUSH_NOTIFICATIONS', 'false') in ('true', 'false'), 'Invalid push notification choice')
    require(env.get('UPLOAD') in ('true', 'false'), 'Explicit upload choice required')
    if env['UPLOAD'] == 'true':
        require(env.get('UPLOAD_CONFIRMATION') == 'UPLOAD TO TESTFLIGHT', 'Upload confirmation is missing')


def decode_secret(env, key):
    value = env.get(key, '')
    require(bool(value), f'Missing secret: {key}')
    try:
        result = base64.b64decode(value, validate=True)
    except ValueError:
        raise ValueError(f'Invalid base64 secret: {key}') from None
    require(bool(result), f'Empty secret: {key}')
    return result


def validate_profile(profile, team_id, apple_login, now=None, push_notifications=False):
    require(re.fullmatch(r'[A-Z0-9]{10}', team_id) is not None, 'Invalid Apple team identifier')
    require(profile.get('TeamIdentifier') == [team_id], 'Provisioning profile belongs to a different team')
    entitlements = profile.get('Entitlements', {})
    require(entitlements.get('application-identifier') == f'{team_id}.{BUNDLE_ID}', 'Profile must use this explicit app identifier')
    require(entitlements.get('com.apple.developer.team-identifier') == team_id, 'Profile entitlement team mismatch')
    require(entitlements.get('get-task-allow') is False, 'Development profiles cannot be uploaded')
    require(entitlements.get('beta-reports-active') is True, 'An App Store distribution profile is required')
    require(not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices'), 'Ad hoc/enterprise profiles are not supported')
    expiry = profile.get('ExpirationDate')
    require(isinstance(expiry, dt.datetime), 'Provisioning profile expiration is missing')
    expiry = expiry.replace(tzinfo=dt.timezone.utc) if expiry.tzinfo is None else expiry
    require(expiry > (now or dt.datetime.now(dt.timezone.utc)) + dt.timedelta(days=1), 'Provisioning profile expires within 24 hours')
    require(re.fullmatch(UUID_PATTERN, profile.get('UUID', '')) is not None, 'Profile UUID is invalid')
    require(bool(profile.get('DeveloperCertificates')), 'Profile has no signing certificates')
    if apple_login:
        require(entitlements.get('com.apple.developer.applesignin') == ['Default'], 'Enable Sign in with Apple and regenerate the profile')
    if push_notifications:
        require(entitlements.get('aps-environment') == 'production', 'Enable Push Notifications and regenerate the distribution profile')
    return profile['UUID']


def release_entitlements(apple_login, push_notifications=False):
    result = {}
    if apple_login:
        result['com.apple.developer.applesignin'] = ['Default']
    if push_notifications:
        result['aps-environment'] = 'production'
    return result


def verify_signed_entitlements(entitlements, team_id, apple_login, push_notifications=False):
    require(entitlements.get('application-identifier') == f'{team_id}.{BUNDLE_ID}', 'Signed app identifier mismatch')
    require(entitlements.get('com.apple.developer.team-identifier') == team_id, 'Signed app team mismatch')
    require(entitlements.get('get-task-allow', False) is False, 'Signed app enables debugging')
    if apple_login:
        require(entitlements.get('com.apple.developer.applesignin') == ['Default'], 'Signed app lacks Apple login entitlement')
    else:
        require(not entitlements.get('com.apple.developer.applesignin'), 'Disabled Apple login must not request its entitlement')
    if push_notifications:
        require(entitlements.get('aps-environment') == 'production', 'Signed app lacks production push entitlement')
    else:
        require(not entitlements.get('aps-environment'), 'Disabled push must not request its entitlement')


if __name__ == '__main__':
    try:
        validate_inputs(os.environ)
        print('Release inputs accepted; credentials, native signing and Apple processing are separate checks.')
    except ValueError as error:
        raise SystemExit(str(error)) from None
