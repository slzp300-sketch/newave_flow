"""Capture five actual simulator screens; never log in to a backend or export an app binary."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import signal
import struct
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUTPUT = ROOT / 'frontend/.verification/store-screenshots'


def command(args, timeout=60):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=timeout).strip()


def inspect_png(path):
    raw = path.read_bytes()
    if raw[:8] != b'\x89PNG\r\n\x1a\n' or raw[12:16] != b'IHDR':
        raise ValueError('Not a PNG screenshot')
    width, height, depth, color = struct.unpack('>IIBB', raw[16:26])
    if (width, height) != (1206, 2622) or depth != 8 or color != 2:
        raise ValueError(f'Screenshot must be a native accepted iPhone portrait size and opaque 8-bit RGB: {width}x{height}, type {color}')
    return {'width': width, 'height': height, 'sha256': hashlib.sha256(raw).hexdigest()}


def main():
    if sys.platform != 'darwin' or os.environ.get('GITHUB_ACTIONS') != 'true':
        raise SystemExit('Capture only on the disposable macOS simulator runner')
    selected = json.loads((OUTPUT / 'device.json').read_text())
    simulator = selected['udid']
    expected = [scene['file'] for scene in json.loads((HERE / 'fixtures.json').read_text(encoding='utf8'))['scenes']]
    products = OUTPUT / 'DerivedData/Build/Products/Release-iphonesimulator'
    app = products / 'App.app'
    app_info = plistlib.loads((app / 'Info.plist').read_bytes())
    raw_dir = OUTPUT / 'originals'
    raw_dir.mkdir(exist_ok=True)
    screenshots = OUTPUT / 'screenshots'
    screenshots.mkdir(exist_ok=True)
    command(['xcrun', 'simctl', 'bootstatus', simulator, '-b'], timeout=240)
    command(['xcrun', 'simctl', 'status_bar', simulator, 'override', '--time', '9:41',
             '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100'])
    command(['xcrun', 'simctl', 'ui', simulator, 'appearance', 'light'])
    command(['xcrun', 'simctl', 'install', simulator, str(app)])
    container = Path(command(['xcrun', 'simctl', 'get_app_container', simulator, 'app.newaveflow.mobile', 'data']))
    handoff = container / 'tmp/newave-store-screenshots'
    if handoff.exists():
        raise ValueError('Capture requires a fresh simulator app container')
    args = ['xcodebuild', '-project', 'frontend/ios/App/App.xcodeproj', '-scheme', 'App',
            '-configuration', 'Release', '-destination', f'id={simulator}', '-parallel-testing-enabled', 'NO',
            '-derivedDataPath', str(OUTPUT / 'DerivedData'), '-resultBundlePath', str(OUTPUT / 'screenshots.xcresult'),
            '-only-testing:AppTests/NewaveStoreScreenshotTests', 'ENABLE_TESTABILITY=YES',
            'CODE_SIGN_IDENTITY=-', 'CODE_SIGNING_ALLOWED=YES', 'test-without-building']
    captured = {}
    process = None
    try:
        with (OUTPUT / 'capture-tests.log').open('w', encoding='utf8') as log:
            process = subprocess.Popen(args, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            deadline = time.monotonic() + 600
            while process.poll() is None and time.monotonic() < deadline:
                marker = handoff / 'ready'
                filename = marker.read_text() if marker.is_file() else ''
                if filename and filename not in expected:
                    raise ValueError('Unexpected screenshot handoff filename')
                if filename and filename not in captured:
                    raw = raw_dir / filename
                    output = screenshots / filename
                    command(['xcrun', 'simctl', 'io', simulator, 'screenshot', '--type=png', str(raw)], timeout=30)
                    command([str(OUTPUT / 'normalize-png'), str(raw), str(output)], timeout=30)
                    captured[filename] = inspect_png(output)
                    (handoff / (filename + '.captured')).write_text('captured')
                    print(f'Captured {filename}: {captured[filename]["width"]}x{captured[filename]["height"]}', flush=True)
                time.sleep(0.25)
            if process.poll() is None:
                raise TimeoutError('Native screenshot test exceeded ten minutes')
            if process.returncode != 0 or set(captured) != set(expected) or not (handoff / 'complete').is_file():
                raise ValueError('Native screenshot verification failed; inspect the synthetic diagnostics and test log')
    finally:
        if process is not None and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
        if handoff.is_dir():
            diagnostics = OUTPUT / 'diagnostics'
            diagnostics.mkdir(exist_ok=True)
            for item in handoff.glob('*.json'):
                shutil.copyfile(item, diagnostics / item.name)
    receipt = {'sourceCommit': os.environ['GITHUB_SHA'], 'version': app_info['CFBundleShortVersionString'],
               'build': app_info['CFBundleVersion'], 'device': selected['name'], 'runtime': selected['runtime'],
               'nativeSimulator': True, 'syntheticData': True, 'externalNetworkBlocked': True,
               'nativeConfiguration': 'Release with testability enabled; fixture code is only in AppTests',
               'fixtureKind': 'invented-store-screenshots-v1', 'screenshotFiles': expected, 'files': captured}
    (OUTPUT / 'capture-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    command(['xcrun', 'simctl', 'shutdown', simulator], timeout=45)


if __name__ == '__main__':
    main()
