"""Verify and smoke-run a fresh extraction of the portable release."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
(ROOT/'tmp').mkdir(exist_ok=True)
destination = Path(tempfile.mkdtemp(prefix='release-', dir=ROOT/'tmp')).resolve()


def extract_checked(archive_path, target_directory):
    target_directory = target_directory.resolve()
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        for member in archive.infolist():
            target = (target_directory/member.filename).resolve()
            if not target.is_relative_to(target_directory):
                raise ValueError('Archive path escapes the extraction directory.')
        archive.extractall(target_directory)


def verify_manifest(project):
    manifest = json.loads((project/'文件校验清单.json').read_text(encoding='utf-8'))
    assert manifest['personalBrowserDataIncluded'] is False
    for name, expected in manifest['files'].items():
        target = (project/name).resolve()
        assert target.is_relative_to(project), name
        assert hashlib.sha256(target.read_bytes()).hexdigest() == expected, name
    return manifest


extract_checked(ROOT/'output/邮研-离线学习工作台.zip', destination)
project = destination/'邮研-离线学习工作台'
manifest = verify_manifest(project)
assert (project/'output/邮研-Python实训包.zip').is_file()
for command in [[sys.executable, '-S', 'practice/test_math_lab.py'], ['node', 'tests/core.test.js'], ['node', 'tests/digits.test.cjs'], ['node', 'tests/metrics.test.cjs'], ['node', 'tests/cards.test.cjs'], ['node', 'tests/state-integrity.test.cjs'], ['node', 'tests/backup-size.test.cjs']]:
    subprocess.run(command, cwd=project, check=True)

# The smaller ZIP must work without files from the main project or site-packages.
standalone_directory = destination/'standalone'
extract_checked(project/'output/邮研-Python实训包.zip', standalone_directory)
standalone = standalone_directory/'邮研-Python实训包'
practice_manifest = verify_manifest(standalone)
for script in ['practice/test_math_lab.py', 'practice/run_lab.py']:
    subprocess.run([sys.executable, '-S', script], cwd=standalone, check=True)
report = json.loads((standalone/'practice/output/实验报告.json').read_text(encoding='utf-8'))
assert report['split'] == {'train': 240, 'validation': 80, 'test': 80}
for name in ['linear', 'relu8']:
    result = report['classification'][name]
    assert result['gradientCheck']['maxAbsoluteError'] < 1e-6
    assert sum(sum(row) for row in result['test']['confusion']) == 80
    assert (standalone/f'practice/output/{name}.svg').read_text(encoding='utf-8').startswith('<svg')
(ROOT/'tmp/release-folder.json').write_text(json.dumps({'directory': str(project), 'standalone': str(standalone)}, ensure_ascii=False)+'\n', encoding='utf-8')
print(f'Both archives verified; source smoke checks passed ({len(manifest["files"])} main / {len(practice_manifest["files"])} practice files). Standalone Python tests and full training ran with site-packages disabled.')
