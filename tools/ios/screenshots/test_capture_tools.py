"""Synthetic preparation/image checks; no simulator, production API or private files."""
import json
import runpy
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
prepare = runpy.run_path(str(HERE / 'prepare.py'))
capture = runpy.run_path(str(HERE / 'capture.py'))


def png(width, height, color=2):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    channels = 3 if color == 2 else 4
    data = (b'\0' + b'\xff' * width * channels) * height
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, color, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(data)) + chunk(b'IEND', b''))


class ScreenshotPreparation(unittest.TestCase):
    def test_native_template_contains_only_embedded_invented_fixtures(self):
        fixture, javascript, swift = prepare['sources']()
        self.assertEqual(len(fixture['scenes']), 5)
        self.assertNotIn('__NEWAVE_FIXTURE__', javascript)
        self.assertNotIn('__FIXTURE_BASE64__', swift)
        self.assertNotIn('__SCRIPT_BASE64__', swift)
        self.assertNotIn('__AUTH_BASE64__', swift)
        self.assertIn('compileContentRuleList', swift)
        self.assertIn('NewaveStoreScreenshotTests', swift)
        self.assertNotIn('rosterData', javascript)
        self.assertNotIn('roster_data', javascript)

    def test_prepare_refuses_local_or_production_config_before_any_native_command(self):
        for env in ({}, {'GITHUB_ACTIONS': 'true', 'RUNNER_OS': 'macOS', 'VITE_API_URL': 'https://example.com/api'}):
            with self.subTest(env=env), patch.dict('os.environ', env, clear=True), patch('subprocess.check_output') as command:
                with self.assertRaises(SystemExit):
                    prepare['main']()
                command.assert_not_called()

    def test_png_keeps_native_required_resolution_and_rejects_alpha_or_wrong_size(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.png'
            path.write_bytes(png(1206, 2622))
            self.assertEqual(capture['inspect_png'](path)['width'], 1206)
            for width, height, color in [(1206, 2622, 6), (390, 844, 2), (2622, 1206, 2)]:
                path.write_bytes(png(width, height, color))
                with self.subTest(width=width, color=color), self.assertRaises(ValueError):
                    capture['inspect_png'](path)


if __name__ == '__main__':
    unittest.main()
