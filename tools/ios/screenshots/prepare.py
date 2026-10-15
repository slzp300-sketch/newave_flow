"""Prepare the synthetic capture test only in a disposable GitHub macOS checkout."""
import base64
import json
import os
from pathlib import Path
import runpy
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUTPUT = ROOT / 'frontend/.verification/store-screenshots'
MODELS = {'iPhone 16 Pro', 'iPhone 17', 'iPhone 17 Pro'}


def encode(value):
    return base64.b64encode(value.encode('utf8')).decode('ascii')


def sources():
    data = json.loads((HERE / 'fixtures.json').read_text(encoding='utf8'))
    if data.get('fixtureKind') != 'invented-store-screenshots-v1':
        raise ValueError('Only the invented screenshot fixture is allowed')
    serialized = json.dumps(data, ensure_ascii=False)
    javascript = (HERE / 'fixture-network.js').read_text(encoding='utf8').replace('__NEWAVE_FIXTURE__', serialized)
    payload = base64.urlsafe_b64encode(json.dumps({'exp': 4102444800, 'sub': 'synthetic-screenshot-only'}).encode()).decode().rstrip('=')
    auth = json.dumps({'state': {'user': data['user'], 'accessToken': f'synthetic.{payload}.not-a-real-signature',
        'refreshToken': 'synthetic-unused-refresh', 'apiEnvironment': 'production', 'authIdentity': None}, 'version': 0}, ensure_ascii=False)
    swift = (HERE / 'NewaveStoreScreenshotTests.swift').read_text(encoding='utf8')
    geometry = (HERE / 'screen-geometry.js').read_text(encoding='utf8')
    for key, value in [('__FIXTURE_BASE64__', serialized), ('__SCRIPT_BASE64__', javascript), ('__AUTH_BASE64__', auth),
                       ('__GEOMETRY_BASE64__', geometry)]:
        if swift.count(key) != 1:
            raise ValueError('Screenshot template must contain exactly one expected placeholder')
        swift = swift.replace(key, encode(value))
    return data, javascript, swift


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('RUNNER_OS') != 'macOS':
        raise SystemExit('Prepare screenshots only in the disposable GitHub macOS workflow')
    if os.environ.get('VITE_API_URL') != 'https://screenshots.newaveflow.invalid/api':
        raise SystemExit('Screenshot build must use the reserved .invalid API address')
    devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '--json'], text=True))['devices']
    eligible = {runtime: [device for device in entries if device.get('name') in MODELS]
                for runtime, entries in devices.items()}
    selected = runpy.run_path(str(HERE.parent / 'select-simulator.py'))['select_device'](eligible, 'iphone')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'device.json').write_text(json.dumps(selected, indent=2) + '\n', encoding='utf8')
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf8') as env:
        env.write(f'SCREENSHOT_SIMULATOR_ID={selected["udid"]}\n')
    _, _, swift = sources()
    # Reuse the existing test-target wiring, without changing production code or the shared project.
    target = ROOT / 'frontend/ios/App/AppTests/NewaveKeychainTests.swift'
    if 'final class NewaveKeychainTests' not in target.read_text(encoding='utf8'):
        raise SystemExit('Unexpected native test source; refusing replacement')
    target.write_text(swift, encoding='utf8')
    print(f'Prepared a test-only fixture on {selected["name"]} / {selected["runtime"]}')


if __name__ == '__main__':
    main()
