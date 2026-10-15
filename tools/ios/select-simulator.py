"""Choose a requested iOS device family without contacting Apple services."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess


def select_device(devices, family):
    prefixes = {'iphone': 'iPhone ', 'ipad': 'iPad '}
    if family not in prefixes:
        raise ValueError('Choose the iphone or ipad simulator family.')
    choices = []
    for runtime, entries in devices.items():
        match = re.fullmatch(r'com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+(?:-\d+)*)', runtime)
        if not match:
            continue
        version = tuple(int(part) for part in match[1].split('-'))
        for device in entries:
            name, udid = device.get('name', ''), device.get('udid', '')
            if (device.get('isAvailable') is not True or not name.startswith(prefixes[family])
                    or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', udid)):
                continue
            selection = {'family': family, 'runtime': runtime, 'runtimeVersion': list(version),
                         'name': name, 'udid': udid}
            # Device names break ties deterministically; only runtime versions imply recency.
            choices.append((version + (0,) * max(0, 3 - len(version)), name.casefold(), udid, selection))
    if not choices:
        raise ValueError(f'No available {prefixes[family].strip()} simulator was found on this runner.')
    return max(choices, key=lambda choice: choice[:3])[3]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--family', choices=('iphone', 'ipad'), default='iphone')
    parser.add_argument('--env-var', help='GITHUB_ENV variable receiving the selected device ID')
    parser.add_argument('--report', type=Path, help='Save selected device/runtime metadata as JSON')
    args = parser.parse_args(argv)
    env_var = args.env_var or ('IOS_SIMULATOR_ID' if args.family == 'iphone' else 'IOS_IPAD_SIMULATOR_ID')
    if not re.fullmatch(r'[A-Z][A-Z0-9_]*', env_var):
        parser.error('--env-var must be an uppercase environment variable name')
    env_file = os.environ.get('GITHUB_ENV')
    if not env_file:
        parser.error('GITHUB_ENV must point to the runner environment file')
    devices = json.loads(subprocess.check_output(
        ['xcrun', 'simctl', 'list', 'devices', 'available', '--json'], text=True,
    ))['devices']
    selected = select_device(devices, args.family)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(selected, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    with open(env_file, 'a', encoding='utf8') as output:
        output.write(f'{env_var}={selected["udid"]}\n')
    print(f'Selected {selected["name"]}, {selected["runtime"]} ({env_var})')


if __name__ == '__main__':
    main()
