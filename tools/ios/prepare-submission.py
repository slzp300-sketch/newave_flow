"""Validate public App Store copy and native screenshots; never read private contact/key files."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
from urllib.parse import urlparse
import zlib

ROOT = Path(__file__).resolve().parents[2]
METADATA = ROOT / 'docs/ios-store/metadata.ko-KR.json'
SCREENSHOTS = ['01-home.png', '02-tts.png', '03-calendar.png', '04-attendance.png', '05-event.png']
LIMITS = {'name': 30, 'subtitle': 30, 'promotionalText': 170, 'description': 4000}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_metadata(metadata):
    require(metadata.get('schemaVersion') == 1 and metadata.get('locale') == 'ko-KR', 'Unexpected metadata schema/locale')
    lengths = {}
    for key, limit in LIMITS.items():
        value = metadata.get(key)
        minimum = 0 if key == 'promotionalText' else 1
        require(isinstance(value, str) and minimum <= len(value) <= limit, f'{key}: invalid length or exceeds {limit} characters')
        lengths[key] = len(value)
    for key, limit in (('keywords', 100), ('reviewNotes', 4000)):
        value = metadata.get(key, '')
        require(isinstance(value, str) and 0 < len(value.encode('utf-8')) <= limit, f'{key}: empty or exceeds {limit} UTF-8 bytes')
        lengths[key + 'Utf8Bytes'] = len(value.encode('utf-8'))
    for key in ('supportUrl', 'privacyPolicyUrl', 'privacyChoicesUrl'):
        url = urlparse(metadata.get(key, ''))
        require(url.scheme == 'https' and url.netloc == 'newave-flow.vercel.app', f'{key}: unexpected public URL')
        require(not url.query and not url.fragment, f'{key}: remove query/fragment')
    require(metadata.get('distribution') == {
        'countries': ['KR'], 'price': 'FREE', 'method': 'PUBLIC', 'includeFutureCountries': False
    }, 'Distribution changed; obtain the operator decision before packaging')
    require(metadata.get('contactStorage') == 'private-local-intake', 'Keep review contacts outside this public package')
    require(metadata.get('screenshotFiles') == SCREENSHOTS, 'Unexpected screenshot inventory')
    forbidden = {'password', 'reviewPassword', 'reviewUsername', 'reviewContact', 'phone', 'apiKey', 'privateKey'}
    require(not forbidden.intersection(metadata), 'Private values do not belong in public metadata')
    return lengths


def check_png(path):
    require(path.stat().st_size <= 20_000_000, f'{path.name}: unexpectedly large PNG')
    data = path.read_bytes()
    require(data[:8] == b'\x89PNG\r\n\x1a\n', f'{path.name}: not PNG')
    cursor, width, height, ended = 8, None, None, False
    compressed = bytearray()
    while cursor < len(data):
        require(cursor + 12 <= len(data), f'{path.name}: truncated PNG')
        length = struct.unpack('>I', data[cursor:cursor + 4])[0]
        kind = data[cursor + 4:cursor + 8]
        end = cursor + 8 + length
        require(end + 4 <= len(data), f'{path.name}: truncated chunk')
        payload = data[cursor + 8:end]
        crc = struct.unpack('>I', data[end:end + 4])[0]
        require(zlib.crc32(kind + payload) & 0xffffffff == crc, f'{path.name}: PNG checksum mismatch')
        if kind == b'IHDR':
            require(cursor == 8 and length == 13, f'{path.name}: invalid header')
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
            require((width, height) == (1206, 2622), f'{path.name}: expected native 1206 x 2622')
            require(depth == 8 and color == 2, f'{path.name}: expected 8-bit RGB without alpha')
            require((compression, filtering, interlace) == (0, 0, 0), f'{path.name}: unsupported PNG encoding')
        if kind == b'IDAT':
            require(width is not None, f'{path.name}: image data before header')
            compressed.extend(payload)
        require(kind != b'tRNS', f'{path.name}: transparency is not allowed')
        cursor = end + 4
        if kind == b'IEND':
            require(length == 0 and cursor == len(data), f'{path.name}: invalid PNG ending')
            ended = True
            break
    require(width is not None and ended, f'{path.name}: incomplete PNG')
    require(bool(compressed), f'{path.name}: PNG has no image data')
    stride = width * 3 + 1
    expected = stride * height
    decoder = zlib.decompressobj()
    pixels = decoder.decompress(bytes(compressed), expected + 1)
    require(len(pixels) == expected and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail,
            f'{path.name}: invalid image data length or compression')
    require(all(pixels[row * stride] <= 4 for row in range(height)), f'{path.name}: invalid scanline filter')
    return {'file': path.name, 'width': width, 'height': height, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata', type=Path, default=METADATA)
    parser.add_argument('--screenshots', type=Path)
    parser.add_argument('--receipt', type=Path, help='capture-receipt.json from the same successful native screenshot run')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--metadata-only', action='store_true', help='Validate copy only; does not create an upload package')
    args = parser.parse_args()
    metadata = json.loads(args.metadata.read_text(encoding='utf-8-sig'))
    lengths = check_metadata(metadata)
    copyright_value = metadata.get('copyright', '')
    rights_ready = isinstance(copyright_value, str) and bool(copyright_value.strip()) and '<' not in copyright_value
    if args.metadata_only:
        print(json.dumps({'metadataValid': True, 'lengths': lengths, 'copyrightFieldPresent': rights_ready,
                          'submissionComplete': False}, ensure_ascii=False))
        return
    require(rights_ready, 'Actual copyright holder must be confirmed before packaging')
    require(args.screenshots is not None and args.output is not None and args.receipt is not None,
            'Provide --screenshots, --receipt and a new --output directory')
    require(not args.output.exists(), 'Output already exists; use a new directory to preserve prior evidence')
    images = [check_png(args.screenshots / filename) for filename in SCREENSHOTS]
    receipt = json.loads(args.receipt.read_text(encoding='utf-8-sig'))
    require(re.fullmatch(r'[0-9a-f]{40}', receipt.get('sourceCommit', '')) is not None, 'Missing capture commit')
    require(all(receipt.get(key) is True for key in ('nativeSimulator', 'syntheticData', 'externalNetworkBlocked')),
            'Capture must use the isolated native simulator workflow')
    require(receipt.get('screenshotFiles') == SCREENSHOTS, 'Capture receipt inventory differs')
    for item in images:
        recorded = receipt.get('files', {}).get(item['file'], {})
        require(all(recorded.get(key) == item[key] for key in ('width', 'height', 'sha256')),
                f'{item["file"]}: capture receipt does not match the image')
    public_receipt = {key: receipt.get(key) for key in ('sourceCommit', 'version', 'build', 'device', 'runtime',
        'nativeSimulator', 'syntheticData', 'externalNetworkBlocked', 'nativeConfiguration', 'fixtureKind', 'screenshotFiles', 'files')}
    args.output.mkdir(parents=True)
    shutil.copyfile(args.metadata, args.output / 'metadata.ko-KR.json')
    for filename in SCREENSHOTS:
        shutil.copyfile(args.screenshots / filename, args.output / filename)
    (args.output / 'capture-receipt.json').write_text(json.dumps(public_receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest = {'status': 'prepared-not-submitted', 'locale': 'ko-KR', 'lengths': lengths, 'images': images,
                'sourceCommit': receipt['sourceCommit'], 'privateContactsIncluded': False,
                'metadataSha256': hashlib.sha256(args.metadata.read_bytes()).hexdigest(),
                'appleAccountSetupAndFinalBuildComparisonRequired': True}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'prepared': str(args.output), 'screenshots': len(images), 'submitted': False}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, struct.error, zlib.error) as error:
        raise SystemExit(f'App Store package not prepared: {error}') from None
