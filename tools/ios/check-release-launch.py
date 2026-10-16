"""Bound each simulator operation and keep timings without weakening the login-screen check."""
import argparse
import json
from pathlib import Path
import subprocess
import time


class LaunchCheck:
    def __init__(self, output, family):
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.family = family
        self.started = time.monotonic()
        # Leave 30 seconds for shutdown/reporting within the workflow's nine-minute limit.
        self.deadline = self.started + 510
        self.records = []
        self.log = self.output / f'{family}-release-launch.log'

    def run(self, label, args, limit, *, allowed=(0,), deadline=None):
        remaining = (self.deadline if deadline is None else deadline) - time.monotonic()
        if remaining <= 0:
            raise ValueError(f'{self.family}: time budget exhausted before {label}')
        timeout = min(limit, remaining)
        started = time.monotonic()
        record = {'phase': label, 'timeoutSeconds': round(timeout, 2)}
        print(f'{self.family}: {label} (limit {timeout:.0f}s)', flush=True)
        try:
            result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, timeout=timeout, check=False)
            record['returnCode'] = result.returncode
            output = result.stdout or ''
        except subprocess.TimeoutExpired as error:
            record['timedOut'] = True
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
        deadline = min(self.deadline, time.monotonic() + 90)
        while time.monotonic() < deadline:
            # Never accept an image from an earlier attempt when capture fails.
            screenshot.unlink(missing_ok=True)
            self.run('capture', ['xcrun', 'simctl', 'io', simulator, 'screenshot', str(screenshot)],
                     30, deadline=deadline)
            code = self.run('login-screen-ocr', [str(checker), str(screenshot)],
                            30, allowed=(0, 2), deadline=deadline)
            if code == 0:
                return
            time.sleep(min(5, max(0, deadline - time.monotonic())))
        raise ValueError(f'{self.family}: Release login screen was not visible within 90 seconds')

    def capture_failure_diagnostics(self, simulator):
        # Evidence only: neither a diagnostic image nor a status result can pass this check.
        deadline = min(self.deadline, time.monotonic() + 25)
        screenshot = self.output / f'{self.family}-failure-diagnostic.png'
        operations = [
            ('failure-diagnostic-capture',
             ['xcrun', 'simctl', 'io', simulator, 'screenshot', str(screenshot)], 20),
            ('failure-diagnostic-simulator-status',
             ['xcrun', 'simctl', 'list', 'devices', 'booted'], 5),
        ]
        for label, args, limit in operations:
            if time.monotonic() >= deadline:
                self.records.append({'phase': label, 'skipped': 'diagnostic time budget exhausted'})
                continue
            try:
                if label == 'failure-diagnostic-capture':
                    screenshot.unlink(missing_ok=True)
                self.run(label, args, limit, deadline=deadline)
            except (OSError, ValueError) as failure:
                # Preserve the original check failure even if diagnostics cannot be collected.
                self.records.append({'phase': label, 'diagnosticError': str(failure)})

    def check(self, simulator, app, checker):
        name = 'iphone-launch.png' if self.family == 'iphone' else 'ipad-compatibility-launch.png'
        error = None
        try:
            self.run('boot', ['xcrun', 'simctl', 'bootstatus', simulator, '-b'], 120)
            self.run('install-release', ['xcrun', 'simctl', 'install', simulator, str(app)], 90)
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
