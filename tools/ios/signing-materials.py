"""Create local Windows signing material without writing a plaintext private key.

Requires cryptography >= 42. Keep each operation in a new, non-synced directory
under %LOCALAPPDATA%/NewaveFlow/iOS. init-csr reads commonName/email JSON from
stdin; neither subject values nor keys/passwords are command-line arguments.
Only the CSR is uploaded to Apple. export-p12 checks local certificate properties,
NOT Apple's trust chain, revocation, or a provisioning profile; the macOS signing
workflow must still verify a trusted signing identity and the actual profile.

Python cannot guarantee erasure of all copies of key material in process memory.
DPAPI uses CurrentUser scope, without UI or machine-wide access. PKCS#12 uses
the macOS-compatible legacy cipher with a random password, stored separately in
DPAPI; PKCS#12 encryption is not a replacement for the local DPAPI protection.
"""
import argparse
import ctypes
from ctypes import wintypes
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import sys

KEY_FILE = 'signing-key.dpapi'
CSR_FILE = 'request.certSigningRequest'
P12_FILE = 'distribution.p12'
PASSWORD_FILE = 'p12-password.dpapi'
CERT_FILE = 'distribution.cer'
RECEIPT_FILE = 'export-receipt.json'
MAX_FILE_BYTES = 1024 * 1024
ENTROPY = b'NewaveFlow/iOS/signing-materials/v1'


class SafeError(ValueError):
    """Only fixed, non-sensitive messages may be supplied to this exception."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def crypto_modules():
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives.serialization import pkcs12
        from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
        return x509, hashes, serialization, rsa, pkcs12, ExtendedKeyUsageOID, NameOID
    except ImportError:
        raise SafeError('Use the prepared Python runtime with cryptography >= 42.') from None


class DataBlob(ctypes.Structure):
    _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_ubyte))]


def _windows_dpapi(data, encrypt):
    require(sys.platform == 'win32', 'DPAPI material operations require Windows.')
    require(isinstance(data, bytes) and 0 < len(data) <= MAX_FILE_BYTES, 'Invalid DPAPI input.')
    crypt32 = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    source = ctypes.create_string_buffer(data, len(data))
    entropy_buffer = ctypes.create_string_buffer(ENTROPY, len(ENTROPY))
    source_blob = DataBlob(len(data), ctypes.cast(source, ctypes.POINTER(ctypes.c_ubyte)))
    entropy_blob = DataBlob(len(ENTROPY), ctypes.cast(entropy_buffer, ctypes.POINTER(ctypes.c_ubyte)))
    output = DataBlob()
    try:
        if encrypt:
            operation = crypt32.CryptProtectData
            operation.argtypes = [ctypes.POINTER(DataBlob), wintypes.LPCWSTR,
                                  ctypes.POINTER(DataBlob), ctypes.c_void_p,
                                  ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
            description = 'NewaveFlow iOS signing material'
        else:
            operation = crypt32.CryptUnprotectData
            operation.argtypes = [ctypes.POINTER(DataBlob), ctypes.c_void_p,
                                  ctypes.POINTER(DataBlob), ctypes.c_void_p,
                                  ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
            description = None
        operation.restype = wintypes.BOOL
        # CRYPTPROTECT_UI_FORBIDDEN only: do not set CRYPTPROTECT_LOCAL_MACHINE.
        succeeded = operation(ctypes.byref(source_blob), description, ctypes.byref(entropy_blob),
                              None, None, 0x1, ctypes.byref(output))
        require(bool(succeeded), 'DPAPI protection or recovery failed for this Windows user.')
        require(0 < output.cbData <= MAX_FILE_BYTES, 'Invalid DPAPI result.')
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        ctypes.memset(source, 0, len(data))
        if output.pbData:
            ctypes.memset(output.pbData, 0, output.cbData)
            kernel32.LocalFree(output.pbData)


def protect(data):
    return _windows_dpapi(data, True)


def unprotect(data):
    return _windows_dpapi(data, False)


def _has_reparse_ancestor(path):
    for component in (path, *path.parents):
        try:
            metadata = component.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(metadata.st_mode) or getattr(metadata, 'st_file_attributes', 0) & 0x400:
            return True
    return False


def storage_directory(raw_path):
    """Reject cloud locations, network shares and redirects before touching keys."""
    path = Path(raw_path)
    local_app_data = os.environ.get('LOCALAPPDATA', '')
    require(bool(local_app_data) and Path(local_app_data).is_absolute(), 'LOCALAPPDATA is unavailable.')
    require(path.is_absolute(), 'Use an absolute local material directory.')
    require(not str(path).startswith(('\\\\', '//')), 'Network material directories are not allowed.')
    require(not _has_reparse_ancestor(path), 'Redirected material directories are not allowed.')
    require(not _has_reparse_ancestor(Path(local_app_data)), 'Redirected LOCALAPPDATA is not allowed.')
    path = path.resolve()
    root = (Path(local_app_data) / 'NewaveFlow' / 'iOS').resolve()
    require(path != root and path.is_relative_to(root), 'Use a new directory under LOCALAPPDATA/NewaveFlow/iOS.')
    require(not any(part.casefold().startswith('onedrive') for part in path.parts),
            'OneDrive material directories are not allowed.')
    for name in ('OneDrive', 'OneDriveConsumer', 'OneDriveCommercial'):
        value = os.environ.get(name)
        if value:
            require(not path.is_relative_to(Path(value).resolve()), 'OneDrive material directories are not allowed.')
    return path


def read_limited(path):
    with Path(path).open('rb') as source:
        result = source.read(MAX_FILE_BYTES + 1)
    require(0 < len(result) <= MAX_FILE_BYTES, 'Material input is empty or exceeds the size limit.')
    return result


def write_new_files(directory, files):
    require(all(not (directory / name).exists() for name in files), 'Refusing to overwrite existing material.')
    created = []
    try:
        for name, value in files.items():
            destination = directory / name
            with destination.open('xb') as output:
                created.append(destination)
                output.write(value)
                output.flush()
                os.fsync(output.fileno())
    except Exception:
        for destination in reversed(created):
            try:
                destination.unlink()
            except OSError:
                pass  # Only encrypted/public files were written; never remove unrelated files.
        raise


def validated_subject(identity):
    require(isinstance(identity, dict) and set(identity) == {'commonName', 'email'}, 'Expected commonName and email identity fields.')
    name, email = identity['commonName'], identity['email']
    require(isinstance(name, str) and 1 <= len(name.strip()) <= 128
            and all(ord(character) >= 32 and ord(character) != 127 for character in name), 'Invalid CSR common name.')
    require(isinstance(email, str) and len(email) <= 254
            and re.fullmatch(r'[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', email) is not None,
            'Invalid CSR email address.')
    x509, _, _, _, _, _, NameOID = crypto_modules()
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name.strip()),
                      x509.NameAttribute(NameOID.EMAIL_ADDRESS, email)])


def init_csr(directory, identity):
    path = storage_directory(directory)
    require(not path.exists(), 'The material directory must not already exist.')
    subject = validated_subject(identity)
    x509, hashes, serialization, rsa, _, _, _ = crypto_modules()
    # Test DPAPI before key generation. It must fail closed on unsupported hosts.
    require(unprotect(protect(b'NewaveFlow DPAPI self-check')) == b'NewaveFlow DPAPI self-check', 'DPAPI self-check failed.')
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_der = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8,
                                   serialization.NoEncryption())
    protected_key = protect(private_der)
    require(unprotect(protected_key) == private_der, 'Private key protection verification failed.')
    del private_der
    csr = x509.CertificateSigningRequestBuilder().subject_name(subject).sign(key, hashes.SHA256())
    require(csr.is_signature_valid, 'CSR signature verification failed.')
    path.mkdir(parents=True, exist_ok=False)
    try:
        write_new_files(path, {KEY_FILE: protected_key, CSR_FILE: csr.public_bytes(serialization.Encoding.PEM)})
    except Exception:
        try:
            path.rmdir()
        except OSError:
            pass
        raise
    return {'operation': 'init-csr', 'privateKeyProtection': 'DPAPI-CurrentUser',
            'csrSignatureVerified': True, 'appleCertificateIssued': False}


def load_certificate(data):
    x509, _, serialization, _, _, _, _ = crypto_modules()
    if data.lstrip().startswith(b'-----BEGIN CERTIFICATE-----'):
        require(data.count(b'-----BEGIN CERTIFICATE-----') == 1 and data.count(b'-----END CERTIFICATE-----') == 1,
                'Supply exactly one leaf certificate.')
        certificate = x509.load_pem_x509_certificate(data)
        require(re.sub(rb'\s+', b'', data) == re.sub(rb'\s+', b'', certificate.public_bytes(serialization.Encoding.PEM)),
                'Unexpected PEM certificate content.')
    else:
        certificate = x509.load_der_x509_certificate(data)
        require(data == certificate.public_bytes(serialization.Encoding.DER), 'Unexpected DER certificate content.')
    return certificate


def validate_certificate(certificate, key, team_id, now=None):
    x509, _, serialization, rsa, _, ExtendedKeyUsageOID, NameOID = crypto_modules()
    require(re.fullmatch(r'[A-Z0-9]{10}', team_id) is not None, 'Expected a 10-character Apple Team ID.')
    require(isinstance(key, rsa.RSAPrivateKey) and key.key_size == 2048, 'Expected the generated RSA signing key.')
    public_encoding = (serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    require(key.public_key().public_bytes(*public_encoding) == certificate.public_key().public_bytes(*public_encoding),
            'Certificate does not match the protected private key.')
    units = certificate.subject.get_attributes_for_oid(NameOID.ORGANIZATIONAL_UNIT_NAME)
    require([unit.value for unit in units] == [team_id], 'Certificate Team ID does not match.')
    names = certificate.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
    require(len(names) == 1 and names[0].value.startswith('Apple Distribution: '), 'Expected an Apple Distribution certificate.')
    current = now or dt.datetime.now(dt.timezone.utc)
    require(current.tzinfo is not None, 'Certificate verification requires a timezone-aware date.')
    require(certificate.not_valid_before_utc <= current, 'Certificate is not yet valid.')
    require(certificate.not_valid_after_utc > current + dt.timedelta(days=1), 'Certificate expires within 24 hours.')
    try:
        basic = certificate.extensions.get_extension_for_class(x509.BasicConstraints).value
        usage = certificate.extensions.get_extension_for_class(x509.KeyUsage).value
        extended = certificate.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
    except x509.ExtensionNotFound:
        raise SafeError('Required code-signing certificate extensions are missing.') from None
    require(not basic.ca and usage.digital_signature and not usage.key_cert_sign,
            'Certificate is not a leaf signing identity.')
    require(ExtendedKeyUsageOID.CODE_SIGNING in extended, 'Certificate does not permit code signing.')


def export_p12(directory, certificate_path, team_id):
    path = storage_directory(directory)
    require(path.is_dir(), 'Initialize a new material directory before importing a certificate.')
    output_names = (P12_FILE, PASSWORD_FILE, CERT_FILE, RECEIPT_FILE)
    require(all(not (path / name).exists() for name in output_names), 'Refusing to overwrite existing material.')
    require(not _has_reparse_ancestor(path / KEY_FILE), 'Redirected private key files are not allowed.')
    _, hashes, serialization, _, pkcs12, _, _ = crypto_modules()
    private_der = unprotect(read_limited(path / KEY_FILE))
    key = serialization.load_der_private_key(private_der, password=None)
    del private_der
    certificate = load_certificate(read_limited(certificate_path))
    validate_certificate(certificate, key, team_id)
    password = secrets.token_urlsafe(48).encode('ascii')
    # Apple Keychain compatibility. The random password stays in DPAPI, never argv.
    # https://cryptography.io/en/latest/hazmat/primitives/asymmetric/serialization/#pkcs12
    encryption = (serialization.PrivateFormat.PKCS12.encryption_builder().kdf_rounds(50000)
                  .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
                  .hmac_hash(hashes.SHA1()).build(password))
    p12 = pkcs12.serialize_key_and_certificates(b'NewaveFlow distribution', key, certificate, None, encryption)
    restored_key, restored_certificate, _ = pkcs12.load_key_and_certificates(p12, password)
    validate_certificate(restored_certificate, restored_key, team_id)
    protected_password = protect(password)
    require(unprotect(protected_password) == password, 'P12 password protection verification failed.')
    del password
    certificate_der = certificate.public_bytes(serialization.Encoding.DER)
    receipt = {'operation': 'export-p12', 'certificateKeyMatchVerified': True,
               'teamAndCodeSigningUsageVerified': True, 'validForMoreThan24Hours': True,
               'p12RoundTripVerified': True, 'passwordProtection': 'DPAPI-CurrentUser',
               'certificateSha256': hashlib.sha256(certificate_der).hexdigest(),
               'appleTrustChainVerified': False, 'revocationVerified': False,
               'provisioningProfileVerified': False, 'uploaded': False}
    write_new_files(path, {P12_FILE: p12, PASSWORD_FILE: protected_password, CERT_FILE: certificate_der,
                           RECEIPT_FILE: (json.dumps(receipt, indent=2) + '\n').encode('utf8')})
    return receipt


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise SafeError('Invalid command arguments. Use --help; do not pass passwords in arguments.')


def main(argv=None):
    parser = SafeArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='action', required=True, parser_class=SafeArgumentParser)
    init = commands.add_parser('init-csr', help='Create a new DPAPI key and public CSR; identity JSON comes from stdin.')
    init.add_argument('--directory', required=True)
    init.add_argument('--identity-stdin', required=True, action='store_true')
    export = commands.add_parser('export-p12', help='Import an Apple Distribution leaf certificate and create an encrypted p12.')
    export.add_argument('--directory', required=True)
    export.add_argument('--certificate', required=True)
    export.add_argument('--team-id', required=True)
    try:
        args = parser.parse_args(argv)
        if args.action == 'init-csr':
            identity_text = sys.stdin.read(8193)
            require(len(identity_text) <= 8192, 'Identity input exceeds the size limit.')
            result = init_csr(args.directory, json.loads(identity_text))
        else:
            result = export_p12(args.directory, args.certificate, args.team_id)
        print(json.dumps(result, sort_keys=True))
        return 0
    except SafeError as error:
        print(str(error), file=sys.stderr)
    except Exception:
        # Never include OS paths, certificate subjects, arguments or library errors.
        print('Signing material operation failed; no private details were printed.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
