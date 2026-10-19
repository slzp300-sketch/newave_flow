"""Bound each simulator operation and keep timings without weakening the login-screen check."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time


def simulator_application():
    developer = Path(os.environ.get('DEVELOPER_DIR', ''))
    application = developer / 'Applications/Simulator.app'
    if (not developer.is_absolute() or not application.is_dir()
            or not (application / 'Contents/MacOS/Simulator').is_file()):
        raise ValueError('DEVELOPER_DIR must select an installed Xcode containing Applications/Simulator.app')
    return application


class LaunchCheck:
    def __init__(self, output, family):
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.family = family
        self.started = time.monotonic()
        self.wall_started = time.time()
        # Leave 30 seconds for shutdown/reporting within the workflow's nine-minute limit.
        self.deadline = self.started + 510
        self.records = []
        self.log = self.output / f'{family}-release-launch.log'

    def run(self, label, args, limit, *, allowed=(0,), deadline=None, output_limit=None):
        remaining = (self.deadline if deadline is None else deadline) - time.monotonic()
        if remaining <= 0:
            raise ValueError(f'{self.family}: time budget exhausted before {label}')
        timeout = min(limit, remaining)
        started = time.monotonic()
        record = {'phase': label, 'timeoutSeconds': round(timeout, 2)}
        print(f'{self.family}: {label} (limit {timeout:.0f}s)', flush=True)
        output = ''
        try:
            if output_limit is None:
                result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                        text=True, timeout=timeout, check=False)
                output = result.stdout or ''
            else:
                # A transient file keeps even verbose diagnostic output out of memory.
                # Only its bounded tail is retained, and the file closes/deletes on every outcome.
                with tempfile.TemporaryFile() as captured:
                    try:
                        result = subprocess.run(args, stdout=captured, stderr=subprocess.STDOUT,
                                                text=True, timeout=timeout, check=False)
                    finally:
                        size = captured.seek(0, os.SEEK_END)
                        captured.seek(max(0, size - output_limit))
                        output = captured.read(output_limit).decode('utf-8', errors='replace')
                        if size > output_limit:
                            record['outputTruncated'] = True
                            output = '[earlier diagnostic output truncated]\n' + output
            record['returnCode'] = result.returncode
        except subprocess.TimeoutExpired as error:
            record['timedOut'] = True
            if output_limit is None:
                output = error.stdout or ''
                if isinstance(output, bytes):
                    output = output.decode('utf-8', errors='replace')
        finally:
            record['elapsedSeconds'] = round(time.monotonic() - started, 2)
            self.records.append(record)
        with self.log.open('a', encoding='utf-8') as log:
            log.write(f'{label}: {json.dumps(record)}\n{output}\n')
        print(f'{self.family}: {label} finished after {record["elapsedSeconds"]}s', flush=True)
        if record.get('timedOut'):
            raise ValueError(f'{self.family}: {label} timed out after {timeout:.0f}s; see launch diagnostics')
        if result.returncode not in allowed:
            raise ValueError(f'{self.family}: {label} exited {result.returncode}; see launch diagnostics')
        return result.returncode

    def wait_for_screen(self, simulator, screenshot, checker):
        # Cold simulator capture and Vision initialization exceeded 30s on the hosted
        # Apple Silicon runner even though the saved screen was fully rendered.
        # Share one bounded allowance, still within the original 510s device budget.
        deadline = min(self.deadline, time.monotonic() + 150)
        while time.monotonic() < deadline:
            # Never accept an image from an earlier attempt when capture fails.
            screenshot.unlink(missing_ok=True)
            self.run('capture', ['xcrun', 'simctl', 'io', simulator, 'screenshot', str(screenshot)],
                     60, deadline=deadline)
            code = self.run('login-screen-ocr', [str(checker), str(screenshot)],
                            60, allowed=(0, 2), deadline=deadline)
            if code == 0:
                return
            time.sleep(min(5, max(0, deadline - time.monotonic())))
        raise ValueError(f'{self.family}: Release login screen was not verified within the remaining screen/device budget')

    def capture_failure_diagnostics(self, simulator):
        # Evidence only: neither a diagnostic image nor a status result can pass this check.
        deadline = min(self.deadline, time.monotonic() + 25)
        screenshot = self.output / f'{self.family}-failure-diagnostic.png'
        operations = [
            ('failure-diagnostic-capture',
             ['xcrun', 'simctl', 'io', simulator, 'screenshot', str(screenshot)], 20),
            ('failure-diagnostic-simulator-status',
             ['xcrun', 'simctl', 'list', 'devices', 'booted'], 5),
            ('failure-diagnostic-launch-log',
             ['xcrun', 'simctl', 'spawn', simulator, 'log', 'show', '--style', 'compact',
              '--last', '8m', '--predicate',
              '(process == "runningboardd" OR process == "SpringBoard" OR process == "App") AND '
              '(eventMessage CONTAINS[c] "app.newaveflow.mobile") AND '
              '(eventMessage CONTAINS[c] "launch" OR eventMessage CONTAINS[c] "watchdog" OR '
              'eventMessage CONTAINS[c] "terminate" OR eventMessage CONTAINS[c] "exit")'], 5),
        ]
        for label, args, limit in operations:
            if time.monotonic() >= deadline:
                self.records.append({'phase': label, 'skipped': 'diagnostic time budget exhausted'})
                continue
            try:
                if label == 'failure-diagnostic-capture':
                    screenshot.unlink(missing_ok=True)
                options = {'output_limit': 32_768} if label == 'failure-diagnostic-launch-log' else {}
                self.run(label, args, limit, deadline=deadline, **options)
            except (OSError, ValueError) as failure:
                # Preserve the original check failure even if diagnostics cannot be collected.
                self.records.append({'phase': label, 'diagnosticError': str(failure)})
        self.capture_crash_summaries(simulator, deadline)

    def capture_crash_summaries(self, simulator, deadline):
        label = 'failure-diagnostic-crash-summaries'
        if time.monotonic() >= deadline:
            self.records.append({'phase': label, 'skipped': 'diagnostic time budget exhausted'})
            return
        started = time.monotonic()
        deadline = min(deadline, started + 2)
        directories = [Path.home() / 'Library/Logs/DiagnosticReports']
        if re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', simulator):
            directories.append(Path.home() / 'Library/Developer/CoreSimulator/Devices' / simulator
                               / 'data/Library/Logs/CrashReporter')
        reports = []
        inspected = 0
        try:
            for directory in directories:
                if not directory.is_dir():
                    continue
                for path in directory.glob('App*.ips'):
                    if time.monotonic() >= deadline or inspected >= 20 or len(reports) >= 3:
                        break
                    inspected += 1
                    if path.is_symlink() or path.stat().st_mtime < self.wall_started:
                        continue
                    # IPS can contain environment, arguments and application data: never copy it.
                    with path.open('rb') as source:
                        raw = source.read(1_048_577)
                    if len(raw) > 1_048_576:
                        continue
                    try:
                        text = raw.decode('utf-8')
                        header, offset = json.JSONDecoder().raw_decode(text)
                        body = json.loads(text[offset:]) if text[offset:].strip() else header
                        if not isinstance(header, dict) or not isinstance(body, dict):
                            continue
                        bundle = body.get('bundleInfo', {})
                        bundle_id = bundle.get('CFBundleIdentifier') if isinstance(bundle, dict) else None
                        if (bundle_id or header.get('bundleID')) != 'app.newaveflow.mobile':
                            continue
                        if (body.get('procName') or header.get('app_name')) != 'App':
                            continue
                        summary = {'file': path.name}
                        for key in ('captureTime', 'procName', 'pid'):
                            value = body.get(key)
                            if isinstance(value, (str, int)):
                                summary[key] = str(value)[:160] if isinstance(value, str) else value
                        for section, keys in (('exception', ('type', 'signal', 'codes')),
                                              ('termination', ('namespace', 'code', 'indicator'))):
                            data = body.get(section, {})
                            if isinstance(data, dict):
                                summary[section] = {key: str(data[key])[:160] for key in keys
                                                    if isinstance(data.get(key), (str, int))}
                        reports.append(summary)
                    except (UnicodeError, ValueError, RecursionError):
                        continue
            (self.output / f'{self.family}-failure-crash-summaries.json').write_text(
                json.dumps({'reports': reports}, indent=2) + '\n', encoding='utf-8')
            self.records.append({'phase': label, 'reports': len(reports),
                                 'elapsedSeconds': round(time.monotonic() - started, 2)})
        except OSError:
            self.records.append({'phase': label, 'diagnosticError': 'App crash summary unavailable'})

    def check(self, simulator, app, checker):
        # Validate before any simulator command; do not fall back to another installed Xcode.
        application = simulator_application()
        name = 'iphone-launch.png' if self.family == 'iphone' else 'ipad-compatibility-launch.png'
        error = None
        try:
            # Complete boot before GUI startup can asynchronously boot the same device.
            # A fresh iPad runtime migrates its system data before our app is installed.
            # This preparation remains inside the same 510-second total budget.
            self.run('boot', ['xcrun', 'simctl', 'bootstatus', simulator, '-b'],
                     240 if self.family == 'ipad' else 120)
            # Hosted macOS can take longer to activate Simulator after a cold boot.
            # run() still clamps this allowance to the remaining device budget.
            self.run('prepare-simulator-gui', ['open', '-g', '-a', str(application), '--args',
                                             '-CurrentDeviceUDID', simulator], 60)
            # Cold installcoordinationd can exceed 90s on a 7 GB hosted Mac.
            # This allowance is clamped to the same overall device deadline.
            self.run('install-release', ['xcrun', 'simctl', 'install', simulator, str(app)], 180)
            # Installation follows the native tests; no second terminate-and-relaunch operation is needed.
            self.run('launch-release', ['xcrun', 'simctl', 'launch', simulator, 'app.newaveflow.mobile'], 360)
            self.wait_for_screen(simulator, self.output / name, checker)
        except (OSError, ValueError) as failure:
            error = str(failure)
            self.capture_failure_diagnostics(simulator)
        finally:
            try:
                self.run('shutdown', ['xcrun', 'simctl', 'shutdown', simulator], 20,
                         deadline=time.monotonic() + 20)
            except (OSError, ValueError) as failure:
                if error is None:
                    error = str(failure)
            report = {'family': self.family, 'loginScreenVerified': error is None,
                      'elapsedSeconds': round(time.monotonic() - self.started, 2), 'phases': self.records}
            if error is not None:
                report['error'] = error
            (self.output / f'{self.family}-release-launch.json').write_text(
                json.dumps(report, indent=2) + '\n', encoding='utf-8')
        if error is not None:
            raise ValueError(error)
        print(f'{self.family}: actual Release login screen passed', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--family', choices=('iphone', 'ipad'), required=True)
    parser.add_argument('--simulator', required=True)
    parser.add_argument('--app', type=Path, required=True)
    parser.add_argument('--checker', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    LaunchCheck(args.output, args.family).check(args.simulator, args.app, args.checker.resolve())


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        raise SystemExit(f'Release launch check failed: {error}') from None
