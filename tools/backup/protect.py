"""Binary-safe Windows CurrentUser DPAPI provider, compatible with protect.ps1."""
import ctypes
from ctypes import wintypes
import sys


def main():
    if sys.platform != "win32" or len(sys.argv) != 2 or sys.argv[1] not in ("Protect", "Unprotect"):
        print("Requires Windows and Protect or Unprotect mode", file=sys.stderr)
        return 2

    class Blob(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]

    def blob(data):
        buffer = ctypes.create_string_buffer(data)
        return Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))), buffer

    # Keep the buffers alive until the native call completes.
    payload, payload_buffer = blob(sys.stdin.buffer.read())
    entropy, entropy_buffer = blob(b"NewaveFlow/DatabaseBackup/v1")
    output = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    protect = sys.argv[1] == "Protect"
    function = crypt.CryptProtectData if protect else crypt.CryptUnprotectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.POINTER(Blob),
                         ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    description = ctypes.create_unicode_buffer("NewaveFlow database backup") if protect else None
    # CRYPTPROTECT_UI_FORBIDDEN, CurrentUser scope (no LOCAL_MACHINE flag).
    if not function(ctypes.byref(payload), description, ctypes.byref(entropy),
                    None, None, 1, ctypes.byref(output)):
        print("Windows DPAPI failed: " + str(ctypes.get_last_error()), file=sys.stderr)
        return 1
    try:
        sys.stdout.buffer.write(ctypes.string_at(output.pbData, output.cbData))
        sys.stdout.buffer.flush()
    finally:
        kernel.LocalFree(output.pbData)
    return 0


if __name__ == "__main__":
    sys.exit(main())
