"""Independent ZIP/CRC/CSV checks against synthetic expected attachment bytes."""
import base64
import csv
import io
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

expected = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names))
    assert all(not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts and '\\' not in name for name in names)
    rows = list(csv.DictReader(io.StringIO(archive.read('综测活动记录.csv').decode('utf-8-sig'))))
    assert [row['活动名称'] for row in rows] == expected['titles']
    references = [name for row in rows for name in row['附件（包内路径）'].splitlines()]
    assert len(references) == len(set(references))
    assert set(references) == {name for name in names if name.startswith('附件/')}
    actual = sorted(base64.b64encode(archive.read(name)).decode('ascii') for name in references)
    assert actual == sorted(expected['contents'])
    missing = '\n'.join(row['缺失附件'] for row in rows)
    assert all(name in missing for name in expected.get('missingNames', []))
    assert ('缺失附件清单.txt' in names) == bool(expected.get('missingNames'))
print('Independent ZIP reader verified CSV, safe relative references, CRCs and exact attachment bytes.')
