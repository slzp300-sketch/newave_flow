"""Choose an available iPhone runtime for hosted native tests."""
import json
import os
import subprocess

devices = json.loads(subprocess.check_output(
    ['xcrun', 'simctl', 'list', 'devices', 'available', '--json'], text=True,
))['devices']
choices = [
    (runtime, device['name'], device['udid'])
    for runtime, entries in devices.items()
    if '.iOS-' in runtime
    for device in entries
    if device.get('isAvailable') and device['name'].startswith('iPhone')
]
if not choices:
    raise SystemExit('No available iPhone simulator was found on this runner.')
runtime, name, simulator = sorted(choices)[-1]
with open(os.environ['GITHUB_ENV'], 'a', encoding='utf8') as output:
    output.write(f'IOS_SIMULATOR_ID={simulator}\n')
print(f'Selected {name}, {runtime}')
