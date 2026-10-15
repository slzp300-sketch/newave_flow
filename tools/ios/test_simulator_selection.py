"""Synthetic simulator inventories; these tests do not need macOS or Apple credentials."""
import json
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

selector = runpy.run_path(str(Path(__file__).with_name('select-simulator.py')))
select_device = selector['select_device']


def runtime(version):
    return f'com.apple.CoreSimulator.SimRuntime.iOS-{version}'


def device(name, number=1, available=True):
    return {'name': name, 'udid': f'00000000-0000-0000-0000-{number:012d}', 'isAvailable': available}


class SimulatorSelection(unittest.TestCase):
    def test_runtime_versions_use_numeric_major_minor_and_patch_order(self):
        for older, newer in [('9-3', '18-0'), ('18-9', '18-10'), ('26-0-9', '26-0-10')]:
            inventory = {runtime(older): [device('iPhone 99', 1)],
                         runtime(newer): [device('iPhone 1', 2)]}
            with self.subTest(older=older, newer=newer):
                self.assertEqual(select_device(inventory, 'iphone')['udid'], device('unused', 2)['udid'])

    def test_selects_requested_family_without_falling_back_to_iphone(self):
        inventory = {runtime('26-0'): [device('iPhone 17', 1), device('iPad Pro 13-inch (M4)', 2)],
                     runtime('26-1'): [device('iPhone 17', 3)]}
        self.assertEqual(select_device(inventory, 'iphone')['udid'], device('unused', 3)['udid'])
        self.assertEqual(select_device(inventory, 'ipad')['udid'], device('unused', 2)['udid'])

    def test_ignores_unavailable_devices_non_ios_runtimes_and_invalid_ids(self):
        inventory = {runtime('26-0'): [device('iPad Air 11-inch (M2)', 1)],
                     runtime('27-0'): [device('iPad Pro', 2, available=False),
                                      {**device('iPad Pro', 3), 'udid': 'bad\nINJECTED=value'}],
                     'com.apple.CoreSimulator.SimRuntime.tvOS-99-0': [device('iPad Pro', 4)],
                     runtime('99-0-beta'): [device('iPad Pro', 5)]}
        self.assertEqual(select_device(inventory, 'ipad')['udid'], device('unused', 1)['udid'])

    def test_no_matching_family_fails_instead_of_claiming_coverage(self):
        for inventory in ({}, {runtime('26-0'): [device('iPhone 17')]},
                          {runtime('26-0'): [device('iPad Pro', available=False)]}):
            with self.subTest(inventory=inventory), self.assertRaisesRegex(ValueError, 'No available iPad'):
                select_device(inventory, 'ipad')
        with self.assertRaises(ValueError):
            select_device({}, 'watch')

    def test_selection_is_stable_when_simctl_reorders_devices(self):
        entries = [device('iPhone 17', 1), device('iPhone 17 Pro', 3), device('iPhone 17 Pro', 2)]
        self.assertEqual(select_device({runtime('26-0'): entries}, 'iphone'),
                         select_device({runtime('26-0'): list(reversed(entries))}, 'iphone'))

    def test_cli_preserves_both_device_ids_and_saves_evidence(self):
        inventory = {runtime('26-0'): [device('iPhone 17', 1), device('iPad Pro 13-inch (M4)', 2)]}
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / 'github-env'
            report = Path(directory) / 'evidence' / 'ipad.json'
            with patch.dict('os.environ', {'GITHUB_ENV': str(env)}, clear=True), \
                    patch('subprocess.check_output', return_value=json.dumps({'devices': inventory})) as command:
                selector['main']([])
                selector['main'](['--family', 'ipad', '--report', str(report)])
            self.assertEqual(env.read_text().splitlines(), [f'IOS_SIMULATOR_ID={device("unused", 1)["udid"]}',
                                                           f'IOS_IPAD_SIMULATOR_ID={device("unused", 2)["udid"]}'])
            evidence = json.loads(report.read_text())
            self.assertEqual(evidence['family'], 'ipad')
            self.assertEqual(evidence['runtimeVersion'], [26, 0])
            self.assertEqual(evidence['name'], 'iPad Pro 13-inch (M4)')
            self.assertEqual(command.call_count, 2)
            command.assert_called_with(['xcrun', 'simctl', 'list', 'devices', 'available', '--json'], text=True)

    def test_explicit_environment_variable_is_respected(self):
        inventory = {runtime('26-0'): [device('iPad Pro', 1)]}
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / 'github-env'
            with patch.dict('os.environ', {'GITHUB_ENV': str(env)}, clear=True), \
                    patch('subprocess.check_output', return_value=json.dumps({'devices': inventory})):
                selector['main'](['--family', 'ipad', '--env-var', 'IPAD_UNDER_TEST'])
            self.assertEqual(env.read_text().strip(), f'IPAD_UNDER_TEST={device("unused", 1)["udid"]}')


if __name__ == '__main__':
    unittest.main()
