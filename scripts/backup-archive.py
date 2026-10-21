"""Create a consistent SQLite backup, including WAL contents; never overwrite."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
if not args.source.is_file():
    raise SystemExit('Source database does not exist')
fd = os.open(args.destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
os.close(fd)
with sqlite3.connect('file:' + str(args.source.resolve()) + '?mode=ro', uri=True) as source:
    with sqlite3.connect(args.destination) as destination:
        source.backup(destination)
        assert destination.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        rows = destination.execute('SELECT id,working_json,published_json,revision FROM albums ORDER BY id').fetchall()
        fingerprint = hashlib.sha256(json.dumps(rows, ensure_ascii=False).encode()).hexdigest()
print(json.dumps({'backup': str(args.destination), 'albums': len(rows), 'albumFingerprint': fingerprint}))
