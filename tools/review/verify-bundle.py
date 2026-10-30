import sys
from pathlib import Path
from zipfile import ZipFile

bundle = Path(sys.argv[1])
with ZipFile(bundle) as archive:
    entries = archive.namelist()
    forbidden = [name for name in entries if name.endswith("roster_data.json") or
                 name.endswith((".p12", ".keystore", ".dpapi")) or name.endswith("review-access.txt")]
    assert not forbidden, "Private data or secrets are present in the review bundle"
    assert "BOOT-INF/classes/com/newaveflow/config/ReviewFixtures.class" in entries
    guard_path = "BOOT-INF/classes/META-INF/spring.factories" if "BOOT-INF/classes/META-INF/spring.factories" in entries else "META-INF/spring.factories"
    guard = archive.read(guard_path).decode()
    assert "com.newaveflow.config.ReviewEnvironmentGuard" in guard
    for resource in ("report-fonts/NanumGothic-Regular.ttf", "report-fonts/OFL.txt",
                     "report-templates/church-250622-v1.hwpx", "report-templates/church-250622-v1.json"):
        assert len(archive.read("BOOT-INF/classes/" + resource)) > 0, "Missing report resource: " + resource
print("Review bundle verified: synthetic fixtures and early guard present; real roster and private keys absent")
