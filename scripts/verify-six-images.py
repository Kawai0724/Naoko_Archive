"""Mutating integration test: only run against an isolated ARCHIVE_DATA_DIR server."""
import copy,json,re,struct,sys,urllib.error,urllib.request,uuid,zlib
from pathlib import Path
if '--isolated-qa' not in sys.argv:
    raise SystemExit('Start an isolated ARCHIVE_DATA_DIR server, then pass --isolated-qa.')
BASE=next((x for x in sys.argv[1:] if not x.startswith('--')),'http://127.0.0.1:3011')
def http(path,body=None,method='GET',headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE+path,data=body,method=method,headers=headers or {}),timeout=30) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
status,page=http('/contributor/albums/new');assert status==200
match=re.search(r'\\"token\\":\\"([0-9a-f]{64})\\"',page.decode()) or re.search(r'"token":"([0-9a-f]{64})"',page.decode());assert match
HEAD={'x-local-editor-token':match.group(1),'Origin':BASE}
def png(color):
    def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
    pixels=b''.join(b'\0'+bytes(color if y%30>2 else (180,174,160))*240 for y in range(240))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',240,240,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
cover=png((159,178,187));paper=png((240,235,221))
def upload(a,files,kind='scan',replace=None):
    boundary='NaokoQA'+uuid.uuid4().hex;parts=[]
    fields={'album':json.dumps(a),'expectedRevision':str(a.get('revision',0)),'type':kind}
    if replace:fields['replaceId']=replace
    for name,value in fields.items():parts.append(b'--'+boundary.encode()+b'\r\nContent-Disposition: form-data; name="'+name.encode()+b'"\r\n\r\n'+value.encode()+b'\r\n')
    for name,body in files:parts.append(b'--'+boundary.encode()+b'\r\nContent-Disposition: form-data; name="file"; filename="'+name.encode()+b'"\r\nContent-Type: image/png\r\n\r\n'+body+b'\r\n')
    parts.append(b'--'+boundary.encode()+b'--\r\n')
    status,body=http('/api/contributor/albums/'+a.get('id','new')+'/media',b''.join(parts),'POST',dict(HEAD,**{'Content-Type':'multipart/form-data; boundary='+boundary}))
    return status,json.loads(body)
def get(a):
    status,body=http('/api/contributor/albums/'+a['id'],headers=HEAD);assert status==200;return json.loads(body)['album']
a={'title':'QA · 六张图片验收','artist':'河合奈保子'}
status,data=upload(a,[('cover-QA.png',cover)],'cover');assert status==201,data
a=data['album'];assert len(a['media'])==1 and a['revision']==1
status,data=upload(a,[(f'lyrics-paper-QA-{i}.png',paper) for i in range(1,6)]);assert status==200,data
a=data['album'];assert len(a['media'])==6 and a['media'][0]['type']=='cover' and all(m['type']=='scan' for m in a['media'][1:])
assert all(m['rightsStatus']=='private' and not m['publicationConfirmed'] for m in a['media'])
for m in a['media']:
    path='/api/contributor/media/'+m['storageKey'];assert http(path)[0]==403
    status,body=http(path,headers=HEAD);assert status==200 and body== (cover if m['type']=='cover' else paper)
status,error=upload(a,[('seventh.png',paper)]);assert status==400 and '6' in error['error']
assert get(a)['revision']==a['revision'] and len(get(a)['media'])==6
bad=copy.deepcopy(a);bad['media'].append(dict(bad['media'][0],id=str(uuid.uuid4())))
status,body=http('/api/contributor/albums/'+a['id'],json.dumps({'album':bad,'action':'draft','expectedRevision':a['revision']}).encode(),'PATCH',dict(HEAD,**{'Content-Type':'application/json'}));assert status==400
oldkey=a['media'][0]['storageKey'];oldid=a['media'][0]['id']
status,data=upload(a,[('replacement-cover-QA.png',cover)],'cover',oldid);assert status==200,data
a=data['album'];assert len(a['media'])==6 and a['media'][0]['id']==oldid and a['media'][0]['storageKey']!=oldkey
stale=copy.deepcopy(a);stale['revision']-=1
status,_=upload(stale,[('stale.png',paper)],'cover',oldid);assert status==409
bad=copy.deepcopy(a);bad['media']=bad['media'][:4]
status,_=upload(bad,[('valid.png',paper),('bad.png',b'not an image')]);assert status==400 and get(a)['revision']==a['revision']
status,_=upload(a,[('too-big.png',b'\x89PNG\r\n\x1a\n'+b'x'*(10*1024*1024))],'cover',oldid);assert status==413
assert http('/discography/'+a['slug'])[0]==404
state={'id':a['id'],'revision':a['revision'],'mediaKeys':[m['storageKey'] for m in a['media']]}
Path('/private/tmp/naoko-six-images-state.json').write_text(json.dumps(state))
checks=['new draft uploads without a prior save','one cover plus five lyric-sheet images','private image bytes persist','seventh image rejected without partial save','JSON-save bypass rejected','replacement at capacity','stale upload conflict','invalid batch rollback','10 MB per-image cap','unpublished images stay private']
Path('docs/contributor-six-images-qa.json').write_text(json.dumps({'checks':checks,'passed':True,'localOnly':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':True,'checks':checks,'testAlbumId':a['id']},ensure_ascii=False))
