"""Audit tracked publication files without printing credential values.

This is a high-confidence pattern check, not a complete privacy/security audit.
"""
from pathlib import Path, PurePosixPath
import io
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = {
    'GitHub credential': re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
    'service credential': re.compile(r'\bsk-[A-Za-z0-9_-]{24,}'),
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'local publication path': re.compile(r'(?:[A-Z]:[/\\]+Users[/\\]+[^/\\\s]+[/\\]|E:[/\\]+user[/\\]+Desktop[/\\])'),
}
PRIVATE_PARTS = {'.aws', '.codex', '.agents', 'tmp', 'uploads', 'evidence', 'user-data', 'llm-output', '__pycache__', 'node_modules'}
findings = []


def inspect(name, data):
    parts = PurePosixPath(name).parts
    if any(part in PRIVATE_PARTS for part in parts) or 'docs/plans/' in name or name.endswith(('验收说明.md', '.pt', '.pth', '.pem', '.key')) or PurePosixPath(name).name.startswith('.env'):
        findings.append((name, 'excluded/private file'))
    text = data.decode('utf-8', errors='ignore')
    for label, pattern in PATTERNS.items():
        if pattern.search(text):
            findings.append((name, label))
    if name.endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for member in archive.infolist():
                path = PurePosixPath(member.filename)
                if path.is_absolute() or '..' in path.parts or member.file_size > 50*1024*1024:
                    findings.append((name, 'unsafe archive member'))
                elif not member.is_dir():
                    inspect(name+'!'+member.filename, archive.read(member))


if __name__ == '__main__':
    result = subprocess.run(['git', 'ls-files', '-z', '--cached'], cwd=ROOT, capture_output=True, check=True)
    names = [s for s in result.stdout.decode('utf-8').split('\0') if s]
    if not names:
        raise SystemExit('No tracked files to audit; stage the publication set first.')
    for name in names:
        # Audit index bytes, including staged changes, rather than ignored local files.
        blob = subprocess.run(['git', 'show', ':'+name], cwd=ROOT, capture_output=True, check=True).stdout
        inspect(name, blob)
    for name, label in findings:
        print(f'{name}: {label} detected (value withheld)')
    if findings:
        sys.exit(1)
    print(f'Publication pattern audit passed: {len(names)} tracked files; ZIP members included. Manual review remains required.')
