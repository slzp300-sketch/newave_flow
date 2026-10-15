"""Use invented certificates and temporary directories only; never read Apple keys."""
from contextlib import redirect_stderr, redirect_stdout
import datetime as dt
import io
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parent
module = runpy.run_path(str(HERE / 'signing-materials.py'))
GLOBALS = module['main'].__globals__
try:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
    CRYPTO_AVAILABLE = hasattr(x509.Certificate, 'not_valid_after_utc')
except ImportError:
    CRYPTO_AVAILABLE = False


def fake_protect(data):
    # A reversible stub for synthetic unit tests, never production encryption.
    return b'SYNTHETIC-DPAPI:' + bytes(value ^ 0xA5 for value in data)


def fake_unprotect(data):
    if not data.startswith(b'SYNTHETIC-DPAPI:'):
        raise ValueError('synthetic DPAPI failure')
    return bytes(value ^ 0xA5 for value in data[len(b'SYNTHETIC-DPAPI:'):])


class LocalStorageGuards(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.local = Path(self.temporary.name)
        self.directory = self.local / 'NewaveFlow/iOS/synthetic'
        self.environment = patch.dict(os.environ, {'LOCALAPPDATA': str(self.local), 'OneDrive': '',
                                                   'OneDriveConsumer': '', 'OneDriveCommercial': ''})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_only_a_descendant_of_the_local_material_root_is_allowed(self):
        self.assertEqual(module['storage_directory'](self.directory), self.directory.resolve())
        for invalid in (self.local, self.local / 'NewaveFlow/iOS', self.local / 'outside', Path('relative')):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                module['storage_directory'](invalid)

    def test_onedrive_name_and_configured_sync_root_are_rejected(self):
        with self.assertRaises(ValueError):
            module['storage_directory'](self.directory / 'OneDrive - Synthetic')
        with patch.dict(os.environ, {'OneDriveCommercial': str(self.local)}), self.assertRaises(ValueError):
            module['storage_directory'](self.directory)

    def test_reparse_ancestor_is_rejected_before_material_access(self):
        with patch.dict(GLOBALS, {'_has_reparse_ancestor': lambda _: True}), self.assertRaises(ValueError):
            module['storage_directory'](self.directory)

    def test_file_writer_preserves_existing_files(self):
        self.directory.mkdir(parents=True)
        existing = self.directory / 'existing'
        existing.write_bytes(b'synthetic existing data')
        with self.assertRaises(ValueError):
            module['write_new_files'](self.directory, {'new': b'new', 'existing': b'replacement'})
        self.assertEqual(existing.read_bytes(), b'synthetic existing data')
        self.assertFalse((self.directory / 'new').exists())

    def test_partial_write_failure_removes_only_new_outputs(self):
        self.directory.mkdir(parents=True)
        original_open = Path.open

        def fail_second(path, *args, **kwargs):
            if path.name == 'second':
                raise OSError('synthetic private failure')
            return original_open(path, *args, **kwargs)

        with patch.object(Path, 'open', fail_second), self.assertRaises(OSError):
            module['write_new_files'](self.directory, {'first': b'encrypted synthetic', 'second': b'encrypted synthetic'})
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_cli_never_echoes_sensitive_argument_or_underlying_exception(self):
        stderr, stdout = io.StringIO(), io.StringIO()
        with redirect_stderr(stderr), redirect_stdout(stdout):
            result = module['main'](['export-p12', '--password', 'SYNTHETIC_SECRET'])
        self.assertEqual(result, 1)
        self.assertNotIn('SYNTHETIC_SECRET', stderr.getvalue() + stdout.getvalue())
        stderr = io.StringIO()
        with patch.dict(GLOBALS, {'export_p12': lambda *_: (_ for _ in ()).throw(OSError('SYNTHETIC_PRIVATE_OWNER'))}), redirect_stderr(stderr):
            result = module['main'](['export-p12', '--directory', 'unused', '--certificate', 'unused', '--team-id', 'SYNTHETIC1'])
        self.assertEqual(result, 1)
        self.assertNotIn('SYNTHETIC_PRIVATE_OWNER', stderr.getvalue())

    def test_dpapi_wrapper_uses_encrypt_and_decrypt_modes(self):
        with patch.dict(GLOBALS, {'_windows_dpapi': lambda data, encrypt: (data, encrypt)}):
            self.assertEqual(module['protect'](b'public synthetic'), (b'public synthetic', True))
            self.assertEqual(module['unprotect'](b'public synthetic'), (b'public synthetic', False))

    def test_native_dpapi_flags_require_current_user_without_ui_and_free_output(self):
        native = module['ctypes']
        blob_type = module['DataBlob']
        output_buffer = native.create_string_buffer(b'synthetic protected')
        observed_flags = []

        def encrypt(source, description, entropy, reserved, prompt, flags, output):
            observed_flags.append(flags)
            blob = native.cast(output, native.POINTER(blob_type)).contents
            blob.cbData = len(output_buffer.raw)
            blob.pbData = native.cast(output_buffer, native.POINTER(native.c_ubyte))
            return True

        crypt32 = Mock(CryptProtectData=Mock(side_effect=encrypt))
        kernel32 = Mock(LocalFree=Mock(return_value=None))
        with patch.object(native, 'WinDLL', side_effect=lambda name, **_: crypt32 if name == 'crypt32' else kernel32,
                          create=True), patch.object(sys, 'platform', 'win32'):
            result = module['_windows_dpapi'](b'public synthetic data', True)
        self.assertEqual(result, b'synthetic protected\x00')
        self.assertEqual(observed_flags, [0x1])
        kernel32.LocalFree.assert_called_once()
        self.assertEqual(output_buffer.raw, b'\x00' * len(output_buffer.raw))

    @unittest.skipUnless(sys.platform == 'win32', 'A real DPAPI round-trip requires Windows.')
    def test_real_dpapi_round_trip_uses_only_nonsecret_synthetic_data(self):
        original = b'Public synthetic DPAPI test data; this is not a credential.'
        protected = module['protect'](original)
        self.assertNotIn(original, protected)
        self.assertEqual(module['unprotect'](protected), original)
        with self.assertRaises(ValueError):
            module['unprotect'](protected[:-1] + bytes([protected[-1] ^ 1]))


@unittest.skipUnless(CRYPTO_AVAILABLE, 'Synthetic crypto tests require cryptography >= 42 (local preparation runtime).')
class SyntheticSigningMaterials(unittest.TestCase):
    def setUp(self):
        LocalStorageGuards.setUp(self)
        self.dpapi = patch.dict(GLOBALS, {'protect': fake_protect, 'unprotect': fake_unprotect})
        self.dpapi.start()
        self.addCleanup(self.dpapi.stop)
        self.identity = {'commonName': 'Synthetic Signing Test', 'email': 'synthetic@example.invalid'}
        module['init_csr'](self.directory, self.identity)
        private = fake_unprotect((self.directory / module['KEY_FILE']).read_bytes())
        self.key = serialization.load_der_private_key(private, password=None)
        self.now = dt.datetime.now(dt.timezone.utc)
        self.team = 'SYNTHETIC1'

    def certificate(self, *, key=None, team=None, before=None, after=None,
                    name='Apple Distribution: Synthetic Owner', code_signing=True, ca=False,
                    digital_signature=True, include_usage=True):
        issuer = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name),
                             x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, team or self.team)])
        builder = (x509.CertificateBuilder().subject_name(subject)
                   .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Synthetic issuer, not Apple')]))
                   .public_key((key or self.key).public_key()).serial_number(x509.random_serial_number())
                   .not_valid_before(before or self.now - dt.timedelta(days=1))
                   .not_valid_after(after or self.now + dt.timedelta(days=30))
                   .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True))
        if include_usage:
            builder = (builder.add_extension(x509.KeyUsage(digital_signature=digital_signature,
                       content_commitment=False, key_encipherment=False, data_encipherment=False,
                       key_agreement=False, key_cert_sign=ca, crl_sign=ca, encipher_only=None, decipher_only=None), critical=True)
                       .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CODE_SIGNING if code_signing
                                                           else ExtendedKeyUsageOID.SERVER_AUTH]), critical=False))
        return builder.sign(issuer, hashes.SHA256())

    def test_init_keeps_key_protected_and_csr_public_and_valid(self):
        self.assertEqual({item.name for item in self.directory.iterdir()}, {module['KEY_FILE'], module['CSR_FILE']})
        csr = x509.load_pem_x509_csr((self.directory / module['CSR_FILE']).read_bytes())
        self.assertTrue(csr.is_signature_valid)
        self.assertEqual(csr.public_key().public_numbers(), self.key.public_key().public_numbers())
        self.assertNotIn(b'PRIVATE KEY', (self.directory / module['KEY_FILE']).read_bytes())

    def test_init_refuses_existing_material_without_changing_it(self):
        before = {item.name: item.read_bytes() for item in self.directory.iterdir()}
        with self.assertRaises(ValueError):
            module['init_csr'](self.directory, self.identity)
        self.assertEqual(before, {item.name: item.read_bytes() for item in self.directory.iterdir()})

    def test_dpapi_failure_prevents_key_generation_and_directory_creation(self):
        new_directory = self.directory.parent / 'failed'
        with patch.dict(GLOBALS, {'protect': lambda _: (_ for _ in ()).throw(ValueError('synthetic failure'))}), \
             patch.object(rsa, 'generate_private_key') as generate, self.assertRaises(ValueError):
            module['init_csr'](new_directory, self.identity)
        generate.assert_not_called()
        self.assertFalse(new_directory.exists())

    def test_certificate_rejects_key_team_usage_or_validity_mismatches(self):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cases = [{'key': other_key}, {'team': 'DIFFERENT1'}, {'name': 'Apple Development: Synthetic Owner'},
                 {'code_signing': False}, {'ca': True}, {'digital_signature': False}, {'include_usage': False},
                 {'before': self.now + dt.timedelta(days=1)}, {'after': self.now + dt.timedelta(hours=2)}]
        for options in cases:
            with self.subTest(options=list(options)), self.assertRaises(ValueError):
                module['validate_certificate'](self.certificate(**options), self.key, self.team, self.now)

    def test_pem_and_der_leaf_inputs_round_trip(self):
        certificate = self.certificate()
        for encoding in (serialization.Encoding.PEM, serialization.Encoding.DER):
            self.assertEqual(module['load_certificate'](certificate.public_bytes(encoding)), certificate)
        pem = certificate.public_bytes(serialization.Encoding.PEM)
        self.assertEqual(module['load_certificate'](pem.replace(b'\n', b'\r\n')), certificate)
        for invalid in (pem + pem, pem + b'extra material', certificate.public_bytes(serialization.Encoding.DER) + b'extra'):
            with self.assertRaises(ValueError):
                module['load_certificate'](invalid)

    def test_export_has_password_protection_and_does_not_claim_apple_trust(self):
        certificate = self.certificate()
        certificate_path = self.local / 'synthetic.cer'
        certificate_path.write_bytes(certificate.public_bytes(serialization.Encoding.DER))
        receipt = module['export_p12'](self.directory, certificate_path, self.team)
        p12 = (self.directory / module['P12_FILE']).read_bytes()
        protected_password = (self.directory / module['PASSWORD_FILE']).read_bytes()
        password = fake_unprotect(protected_password)
        self.assertNotIn(password, protected_password)
        with self.assertRaises(ValueError):
            pkcs12.load_key_and_certificates(p12, None)
        recovered_key, recovered_certificate, _ = pkcs12.load_key_and_certificates(p12, password)
        self.assertEqual(recovered_key.private_numbers(), self.key.private_numbers())
        self.assertEqual(recovered_certificate, certificate)
        self.assertFalse(receipt['appleTrustChainVerified'])
        self.assertFalse(receipt['revocationVerified'])
        self.assertFalse(receipt['uploaded'])
        rendered = json.dumps(receipt)
        for private in ('Synthetic Owner', self.team, password.decode()):
            self.assertNotIn(private, rendered)
        before = {item.name: item.read_bytes() for item in self.directory.iterdir()}
        with self.assertRaises(ValueError):
            module['export_p12'](self.directory, certificate_path, self.team)
        self.assertEqual(before, {item.name: item.read_bytes() for item in self.directory.iterdir()})

    def test_invalid_certificate_creates_no_export_outputs(self):
        certificate_path = self.local / 'wrong.cer'
        certificate_path.write_bytes(self.certificate(team='DIFFERENT1').public_bytes(serialization.Encoding.PEM))
        with self.assertRaises(ValueError):
            module['export_p12'](self.directory, certificate_path, self.team)
        self.assertEqual({item.name for item in self.directory.iterdir()}, {module['KEY_FILE'], module['CSR_FILE']})


if __name__ == '__main__':
    unittest.main()
