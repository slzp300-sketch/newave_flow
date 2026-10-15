"""Pick an installed Xcode >=26, without downloading tools or accepting licenses."""
import glob
import os
import re
import subprocess

available = []
for app in glob.glob('/Applications/Xcode*.app'):
    if re.search(r'beta|candidate|_rc', app, re.IGNORECASE):
        continue
    developer_dir = app + '/Contents/Developer'
    tool = developer_dir + '/usr/bin/xcodebuild'
    try:
        version = subprocess.check_output(
            [tool, '-version'], text=True, stderr=subprocess.STDOUT,
            env={**os.environ, 'DEVELOPER_DIR': developer_dir},
        )
    except (OSError, subprocess.CalledProcessError):
        continue
    match = re.search(r'Xcode (\d+)\.(\d+)', version)
    if match and int(match[1]) >= 26:
        available.append(((int(match[1]), int(match[2])), developer_dir))
if not available:
    raise SystemExit('This runner needs an installed Xcode 26 or later.')
_, selected = max(available)
with open(os.environ['GITHUB_ENV'], 'a', encoding='utf8') as output:
    output.write(f'DEVELOPER_DIR={selected}\n')
print('Selected ' + selected)
