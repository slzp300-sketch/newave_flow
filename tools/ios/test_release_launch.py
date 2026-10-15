"""Synthetic process failures must never turn a missing native screen into a pass."""
import json
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

    def test_command_timeout_keeps_phase_and_partial_output(self):
        with patch('subprocess.run', side_effect=subprocess.TimeoutExpired('simctl', 12, output=b'boot pending')):
            with self.assertRaisesRegex(ValueError, 'timed out'):
                self.check.run('boot', ['synthetic'], 12)
        self.assertTrue(self.check.records[0]['timedOut'])
        self.assertIn('boot pending', self.check.log.read_text())

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
        with patch.object(self.check, 'run', side_effect=[0, 0, ValueError('launch failed'), 0]) as command:
            with self.assertRaisesRegex(ValueError, 'launch failed'):
                self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        self.assertEqual(command.call_args_list[-1].args[0], 'shutdown')
        report = json.loads((self.output / 'iphone-release-launch.json').read_text())
        self.assertFalse(report['loginScreenVerified'])
        self.assertEqual(report['error'], 'launch failed')

    def test_success_still_requires_native_ocr_and_shutdown(self):
        with patch.object(self.check, 'run', return_value=0) as command, \
                patch.object(self.check, 'wait_for_screen') as screen:
            self.check.check('synthetic-device', Path('App.app'), Path('checker'))
        screen.assert_called_once()
        self.assertEqual([call.args[0] for call in command.call_args_list],
                         ['boot', 'install-release', 'launch-release', 'shutdown'])
        report = json.loads((self.output / 'iphone-release-launch.json').read_text())
        self.assertTrue(report['loginScreenVerified'])


if __name__ == '__main__':
    unittest.main()
