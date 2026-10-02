"""Package explicitly scoped project files, verify contents and SHA-256 hashes."""
from pathlib import Path
import hashlib
import json
import runpy
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT/'output'
ROOT_FILES = ['index.html', 'style.css', 'app.js', 'core.js', 'content.js',
              'ai-lab.js', 'metrics-lab.js', 'digits-lab.js', 'digits-model.js', 'logic-practice.js',
              'logic-circuit.js', 'card-import.js', 'favicon.svg', 'server.js', 'package.json',
              '启动工作台.cmd', 'README.md', 'README.zh-CN.md', 'LICENSE', 'SECURITY.md', 'SECURITY.zh-CN.md',
              'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'training-run.js','training-lab.js','vault.js',
              'textbook-schema.js', 'textbook.js', 'deepseek-api.js', 'curriculum-content.js', 'curriculum.js', 'records.js']
EXTENSIONS = {'.html', '.css', '.js', '.cjs', '.svg', '.json', '.md', '.py', '.ipynb', '.pdf', '.png', '.txt'}


def collect(directory):
    return [p for p in (ROOT/directory).rglob('*') if p.is_file()
            and not any(part in {'__pycache__', 'llm-output', 'plans', 'screenshots'} for part in p.parts)
            and p.name != '验收说明.md'
            and ('screenshots-v2' not in p.parts or p.name.endswith('-clean.png'))
            and p.suffix in EXTENSIONS]


def package(filename, files, prefix):
    files = sorted(set(files))
    # Inspect actual package bytes, not browser storage. Never print matched values.
    audit = runpy.run_path(str(ROOT/'scripts/audit-public.py'))
    inspect, findings = audit['inspect'], audit['findings']
    for p in files:
        inspect(str(p.relative_to(ROOT)).replace('\\', '/'), p.read_bytes())
    if findings:
        raise ValueError('Publication audit rejected package files: '+', '.join(name+' ('+label+')' for name, label in findings))
    manifest = {'project': '邮研 · 学习工作台', 'personalBrowserDataIncluded': False,
                'files': {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in files}}
    destination = OUTPUT/filename
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for p in files:
            archive.write(p, prefix+'/'+str(p.relative_to(ROOT)).replace('\\', '/'))
        archive.writestr(prefix+'/文件校验清单.json', json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)+1
        for name, expected in manifest['files'].items():
            assert hashlib.sha256(archive.read(prefix+'/'+name)).hexdigest() == expected
    result = {'file': filename, 'files': len(files)+1, 'bytes': destination.stat().st_size,
              'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    return result


if __name__ == '__main__':
    OUTPUT.mkdir(exist_ok=True)
    practice_files = collect('practice')+[ROOT/'examples/AI实训复习卡.txt', ROOT/'docs/AI专业学习与训练实训.md',
                                         ROOT/'LICENSE', ROOT/'THIRD_PARTY_NOTICES.md']
    results = [package('邮研-Python实训包.zip', practice_files, '邮研-Python实训包')]
    complete = [ROOT/name for name in ROOT_FILES]
    complete.append(OUTPUT/'邮研-Python实训包.zip')
    complete.extend(p for p in (ROOT/'vendor').rglob('*') if p.is_file())
    for folder in ['docs', 'examples', 'output/pdf', 'practice', 'scripts', 'tests']:
        complete.extend(collect(folder))
    results.append(package('邮研-离线学习工作台.zip', complete, '邮研-离线学习工作台'))
    (OUTPUT/'交付包校验.json').write_text(json.dumps(results, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2))
