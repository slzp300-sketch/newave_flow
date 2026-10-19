"""Synthetic process failures must never turn a missing native screen into a pass."""
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

launch = runpy.run_path(str(Path(__file__).with_name('check-release-launch.py')))
LaunchCheck = launch['LaunchCheck']


class ReleaseLaunch(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name)
        self.check = LaunchCheck(self.output, 'iphone')
        self.developer = self.output / 'Xcode.app/Contents/Developer'
        self.simulator_app = self.developer / 'Applications/Simulator.app'
        executable = self.simulator_app / 'Contents/MacOS/Simulator'
        executable.parent.mkdir(parents=True)
        executable.write_text('synthetic executable; never run')
        environment = patch.dict(os.environ, {'DEVELOPER_DIR': str(self.developer)})
        environment.start()
        self.addCleanup(environment.stop)
        home = patch.object(Path, 'home', return_value=self.output)
        home.start()
        self.addCleanup(home.stop)

    def test_missing_or_invalid_selected_xcode_never_runs_a_command(self):
        for developer in ('', 'relative/Developer', str(self.output / 'missing')):
            with self.subTest(developer=developer), patch.dict(os.environ, {'DEVELOPER_DIR': developer}), \
                    patch('subprocess.run') as command:
                with self.assertRaisesRegex(ValueError, 'DEVELOPER_DIR'):
                    self.check.check('synthetic-device', Path('App.app'), Path('checker'))
                command.assert_not_called()

    def test_command_timeout_keeps_phase_and_partial_output(self):
        with patch('subprocess.run', side_effect=subprocess.TimeoutExpired('simctl', 12, output=b'boot pending')):
            with self.assertRaisesRegex(ValueError, 'timed out'):
                self.check.run('boot', ['synthetic'], 12)
        self.assertTrue(self.check.records[0]['timedOut'])
        self.assertIn('boot pending', self.check.log.read_text())

    def test_reset_rejects_local_and_self_hosted_before_any_command(self):
        for actions, runner in (('', ''), ('true', 'self-hosted'), ('false', 'github-hosted')):
            with self.subTest(runner=runner), patch.dict(os.environ, {
                    'GITHUB_ACTIONS': actions, 'RUNNER_ENVIRONMENT': runner}), \
                    patch.object(self.check, 'run') as command:
                with self.assertRaisesRegex(ValueError, 'disposable GitHub-hosted'):
                    self.check.check('synthetic-device', Path('App.app'), Path('checker'),
                                     reset_ci_simulator=True)
                command.assert_not_called()

    def test_ci_reset_is_bounded_and_precedes_boot_and_install(self):
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}), \
                patch.object(self.check, 'run', return_value=0) as command, \
                patch.object(self.check, 'wait_for_screen') as screen:
            self.check.check('synthetic-device', Path('App.app'), Path('checker'), reset_ci_simulator=True)
        self.assertEqual([call.args[0] for call in command.call_args_list][:3],
                         ['shutdown-ci-simulators', 'erase-ci-simulator', 'boot'])
        self.assertEqual(command.call_args_list[1].args,
                         ('erase-ci-simulator', ['xcrun', 'simctl', 'erase', 'synthetic-device'], 45))
        self.assertAlmostEqual(self.check.deadline - self.check.started, 510)
        screen.assert_called_once()

    def test_ci_reset_failure_cannot_install_or_accept_screen(self):
        def run(label, *args, **kwargs):
            if label == 'erase-ci-simulator':
                raise ValueError('reset failed')
            return 0
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted'}), \
                patch.object(self.check, 'run', side_effect=run) as command, \
                patch.object(self.check, 'wait_for_screen') as screen:
            with self.assertRaisesRegex(ValueError, 'reset failed'):
                self.check.check('synthetic-device', Path('App.app'), Path('checker'), reset_ci_simulator=True)
        self.assertNotIn('install-release', [call.args[0] for call in command.call_args_list])
        screen.assert_not_called()

    def test_ocr_not_ready_can_retry_but_ocr_error_fails(self):
        with patch('subprocess.run', return_value=Mock(returncode=2, stdout='not ready')):
            self.assertEqual(self.check.run('ocr', ['synthetic'], 30, allowed=(0, 2)), 2)
        with patch('subprocess.run', return_value=Mock(returncode=1, stdout='vision failed')):
            with self.assertRaisesRegex(ValueError, 'exited 1'):
                self.check.run('ocr', ['synthetic'], 30, allowed=(0, 2))

    def test_expired_device_budget_cannot_start_another_command(self):
        self.check.deadline = 0
        with patch('subprocess.run') as command:
            with self.assertRaisesRegex(ValueError, 'time budget exhausted'):
                self.check.run('launch-release', ['synthetic'], 360)
        command.assert_not_called()

    def test_capture_failure_removes_stale_image_and_does_not_run_ocr(self):
        screenshot = self.output / 'stale.png'
        screenshot.write_bytes(b'old passing image')
        with patch.object(self.check, 'run', side_effect=ValueError('capture failed')) as command:
            with self.assertRaisesRegex(ValueError, 'capture failed'):
                self.check.wait_for_screen('synthetic-device', screenshot, Path('synthetic-checker'))
        self.assertFalse(screenshot.exists())
        self.assertEqual(command.call_count, 1)

    def test_launch_failure_still_shuts_down_and_writes_failed_report(self):
        with patch.object(self.check, 'run', side_effect=[0, 0, 0, ValueError('launch failed'), 0, 0, 0, 0]) as command, \
                patch.object(self.check, 'wait_for_screen') as screen:
            with self.assertRaisesRegex(ValueError, 'launch failed'):
                self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        screen.assert_not_called()
        self.assertEqual([call.args[0] for call in command.call_args_list],
                         ['boot', 'prepare-simulator-gui', 'install-release', 'launch-release',
                          'failure-diagnostic-capture', 'failure-diagnostic-simulator-status',
                          'failure-diagnostic-launch-log', 'shutdown'])
        report = json.loads((self.output / 'iphone-release-launch.json').read_text())
        self.assertFalse(report['loginScreenVerified'])
        self.assertEqual(report['error'], 'launch failed')

    def test_slow_capture_leaves_only_remaining_device_budget_for_ocr(self):
        now = [100.0]
        self.check.deadline = 170.0
        screenshot = self.output / 'current.png'
        def execute(args, **kwargs):
            if args[0] == 'xcrun':
                self.assertEqual(kwargs['timeout'], 60)
                now[0] += 55
                screenshot.write_bytes(b'synthetic current capture')
            else:
                self.assertEqual(kwargs['timeout'], 15)
            return Mock(returncode=0, stdout='synthetic check')
        with patch('time.monotonic', side_effect=lambda: now[0]), patch('subprocess.run', side_effect=execute):
            self.check.wait_for_screen('synthetic-device', screenshot, Path('synthetic-checker'))
        self.assertEqual(self.check.deadline, 170)
        self.assertEqual([r['timeoutSeconds'] for r in self.check.records], [60, 15])

    def test_diagnostic_failures_preserve_first_error_and_shutdown(self):
        stale = self.output / 'iphone-failure-diagnostic.png'
        stale.write_bytes(b'stale diagnostic')
        with patch.object(self.check, 'run', side_effect=[
                0, 0, 0, ValueError('original launch timeout'), ValueError('capture timeout'),
                OSError('status unavailable'), ValueError('log unavailable'), 0]) as command:
            with self.assertRaisesRegex(ValueError, 'original launch timeout'):
                self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        self.assertFalse(stale.exists())
        self.assertEqual(command.call_args_list[-1].args[0], 'shutdown')
        report = json.loads((self.output / 'iphone-release-launch.json').read_text())
        self.assertFalse(report['loginScreenVerified'])
        self.assertEqual(report['error'], 'original launch timeout')
        self.assertEqual([phase['diagnosticError'] for phase in report['phases'] if 'diagnosticError' in phase],
                         ['capture timeout', 'status unavailable', 'log unavailable'])

    def test_diagnostics_share_25_seconds_and_never_extend_device_budget(self):
        for device_deadline, expected_deadline in ((1000, 125), (110, 110)):
            with self.subTest(device_deadline=device_deadline):
                self.check.deadline = device_deadline
                with patch('time.monotonic', return_value=100), \
                        patch.object(self.check, 'run', return_value=0) as command, \
                        patch.object(self.check, 'capture_crash_summaries') as crashes:
                    self.check.capture_failure_diagnostics('synthetic-device')
                self.assertEqual([call.args[2] for call in command.call_args_list], [20, 5, 5])
                self.assertEqual([call.kwargs['deadline'] for call in command.call_args_list],
                                 [expected_deadline] * 3)
                self.assertEqual(command.call_args_list[-1].kwargs['output_limit'], 32_768)
                crashes.assert_called_once_with('synthetic-device', expected_deadline)

    def test_exhausted_budget_skips_diagnostics_and_still_shuts_down(self):
        self.check.deadline = 0
        with patch.object(self.check, 'run', side_effect=[ValueError('boot budget exhausted'), 0]) as command:
            with self.assertRaisesRegex(ValueError, 'boot budget exhausted'):
                self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        self.assertEqual([call.args[0] for call in command.call_args_list], ['boot', 'shutdown'])
        report = json.loads((self.output / 'iphone-release-launch.json').read_text())
        self.assertFalse(report['loginScreenVerified'])
        self.assertEqual(len([phase for phase in report['phases'] if 'skipped' in phase]), 4)

    def test_success_still_requires_native_ocr_and_shutdown(self):
        with patch.object(self.check, 'run', return_value=0) as command, \
                patch.object(self.check, 'wait_for_screen') as screen:
            self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        screen.assert_called_once()
        self.assertEqual([call.args[0] for call in command.call_args_list],
                         ['boot', 'prepare-simulator-gui', 'install-release', 'launch-release', 'shutdown'])
        self.assertEqual(command.call_args_list[1].args,
                         ('prepare-simulator-gui', ['open', '-g', '-a', str(self.simulator_app),
                                                   '--args', '-CurrentDeviceUDID', 'synthetic-device'], 60))
        self.assertEqual(command.call_args_list[3].args[2], 360)
        self.assertAlmostEqual(self.check.deadline - self.check.started, 510)
        report = json.loads((self.output / 'iphone-release-launch.json').read_text())
        self.assertTrue(report['loginScreenVerified'])

    def test_gui_startup_allowance_cannot_extend_remaining_device_budget(self):
        self.check.deadline = 117
        with patch('time.monotonic', return_value=100), \
                patch('subprocess.run', return_value=Mock(returncode=0, stdout='')) as command:
            self.check.run('prepare-simulator-gui', ['synthetic-open'], 60)
        self.assertEqual(command.call_args.kwargs['timeout'], 17)
        self.assertEqual(self.check.deadline, 117)
        self.assertEqual(self.check.records[-1]['timeoutSeconds'], 17)

    def test_gui_timeout_cannot_fall_through_to_install_or_accept_screen(self):
        def run(label, *args, **kwargs):
            if label == 'prepare-simulator-gui':
                raise ValueError('Simulator GUI timed out')
            return 0
        with patch.object(self.check, 'run', side_effect=run) as command, \
                patch.object(self.check, 'wait_for_screen') as screen:
            with self.assertRaisesRegex(ValueError, 'Simulator GUI timed out'):
                self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        self.assertEqual(command.call_args_list[0].args[0], 'boot')
        self.assertNotIn('install-release', [call.args[0] for call in command.call_args_list])
        screen.assert_not_called()
        self.assertEqual(command.call_args_list[-1].args[0], 'shutdown')

    def test_diagnostic_launch_log_is_filtered_and_stored_with_size_limit(self):
        with patch.object(self.check, 'run', return_value=0) as command:
            self.check.capture_failure_diagnostics('synthetic-device')
        log_call = command.call_args_list[-1]
        predicate = log_call.args[1][-1]
        self.assertIn('app.newaveflow.mobile', predicate)
        self.assertIn('process == "runningboardd"', predicate)
        self.assertIn('process == "SpringBoard"', predicate)
        self.assertIn('process == "App"', predicate)
        self.assertEqual(log_call.args[2], 5)
        captured_files = []
        def verbose_command(args, **kwargs):
            captured_files.append(kwargs['stdout'])
            self.assertNotEqual(kwargs['stdout'], subprocess.PIPE)
            kwargs['stdout'].write(b'old ' * 30_000 + b'latest event')
            return Mock(returncode=0)
        with patch('subprocess.run', side_effect=verbose_command):
            self.check.run('diagnostic-log', ['synthetic'], 5, output_limit=32_768)
        self.assertTrue(captured_files[0].closed)
        self.assertTrue(self.check.records[-1]['outputTruncated'])
        self.assertLess(self.check.log.stat().st_size, 33_100)
        self.assertIn('latest event', self.check.log.read_text())

    def test_limited_diagnostic_timeout_preserves_tail_and_closes_temporary_file(self):
        captured_files = []
        def timeout(args, **kwargs):
            captured_files.append(kwargs['stdout'])
            kwargs['stdout'].write(b'pending launch event')
            raise subprocess.TimeoutExpired(args, kwargs['timeout'])
        with patch('subprocess.run', side_effect=timeout):
            with self.assertRaisesRegex(ValueError, 'timed out'):
                self.check.run('diagnostic-log', ['synthetic'], 5, output_limit=32_768)
        self.assertTrue(captured_files[0].closed)
        self.assertTrue(self.check.records[-1]['timedOut'])
        self.assertIn('pending launch event', self.check.log.read_text())

    def test_crash_summary_only_includes_new_own_app_whitelisted_fields(self):
        directory = self.output / 'Library/Logs/DiagnosticReports'
        directory.mkdir(parents=True)
        header = {'app_name': 'App', 'bundleID': 'app.newaveflow.mobile'}
        body = {'procName': 'App', 'pid': 456, 'captureTime': 'synthetic time',
                'bundleInfo': {'CFBundleIdentifier': 'app.newaveflow.mobile'},
                'termination': {'namespace': 'FRONTBOARD', 'code': 123, 'indicator': 'watchdog'},
                'exception': {'type': 'EXC_CRASH', 'signal': 'SIGKILL'},
                'environment': {'PRIVATE_TOKEN': 'never copy'}, 'threads': ['private payload']}
        content = json.dumps(header) + '\n' + json.dumps(body)
        (directory / 'App-new.ips').write_text(content)
        old = directory / 'App-old.ips'
        old.write_text(content)
        os.utime(old, (0, 0))
        other = {**body, 'bundleInfo': {'CFBundleIdentifier': 'another.app'}}
        (directory / 'App-other.ips').write_text(json.dumps(other))
        (directory / 'App-invalid.ips').write_text('not JSON')
        (directory / 'App-deep.ips').write_text('[' * 2000 + '0' + ']' * 2000)
        (directory / 'App-oversized.ips').write_text('x' * 1_048_577)
        self.check.capture_crash_summaries('synthetic-device', self.check.deadline)
        raw = (self.output / 'iphone-failure-crash-summaries.json').read_text()
        reports = json.loads(raw)['reports']
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]['file'], 'App-new.ips')
        self.assertEqual(reports[0]['termination']['namespace'], 'FRONTBOARD')
        self.assertNotIn('PRIVATE_TOKEN', raw)
        self.assertNotIn('private payload', raw)
        self.assertNotIn('threads', raw)


if __name__ == '__main__':
    unittest.main()
