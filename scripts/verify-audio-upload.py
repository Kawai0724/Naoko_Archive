"""Only run against a local server with isolated ARCHIVE_DATA_DIR; this writes QA records."""
import copy,json,re,sys,urllib.error,urllib.request,uuid
from pathlib import Path
if '--isolated-qa' not in sys.argv:
    raise SystemExit('Use an isolated ARCHIVE_DATA_DIR server and pass --isolated-qa.')
BASE=next((x for x in sys.argv[1:] if not x.startswith('--')),'http://127.0.0.1:3011')
def http(path,body=None,method='GET',headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE+path,data=body,method=method,headers=headers or {}),timeout=30) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
status,page=http('/contributor/albums/new');assert status==200
assert 'label="原文标题"' not in page.decode() and 'label="别名' not in page.decode()
match=re.search(r'\\"token\\":\\"([0-9a-f]{64})\\"',page.decode()) or re.search(r'"token":"([0-9a-f]{64})"',page.decode());assert match
HEAD={'x-local-editor-token':match.group(1),'Origin':BASE}
def api(path,data,method='PATCH'):
    status,body=http(path,json.dumps(data).encode(),method,dict(HEAD,**{'Content-Type':'application/json'}));return status,json.loads(body)
def save(a,action='draft'):
    status,data=api('/api/contributor/albums'+('/'+a['id'] if a.get('id') else ''),{'album':a,'action':action,'expectedRevision':a.get('revision',0)},'PATCH' if a.get('id') else 'POST');assert status in [200,201],data;return data['album']
def upload(a,name,target='album',replace=None,expected=None):
    h=dict(HEAD,**{'x-audio-name':urllib.parse.quote(name),'x-audio-target':target,'x-expected-revision':str(expected if expected is not None else a['revision'])})
    if replace:h['x-audio-replace']=replace
    status,body=http('/api/contributor/albums/'+a['id']+'/audio',Path('tests/fixtures/lossless/'+name).read_bytes(),'POST',h);return status,json.loads(body)
a=save({'title':'QA · 无损音源与曲目关联','artist':'河合奈保子'})
for name in ['test.flac','test.wav','test.aiff','test.m4a']:
    status,data=upload(a,name);assert status==200,data;a=data['album']
assert [m['codec'] for m in a['media']]==['FLAC','PCM','PCM','ALAC']
assert all(m['audioScope']=='album' and m['rightsStatus']=='private' for m in a['media'])
oldrevision=a['revision'];status,data=upload(a,'lossy.m4a');assert status==400 and 'ALAC' in data['error']
status,data=upload(a,'test.flac','new-track');assert status==400,data
a['tracks']=[{'id':str(uuid.uuid4()),'position':'01','title':'QA existing track'}];a=save(a);track=a['tracks'][0]
status,data=upload(a,'test.flac',track['id']);assert status==200,data;a=data['album']
assert track['title']=='QA existing track' and a['media'][-1]['relatedTrackId']==track['id']
status,data=upload(a,'test.wav',track['id']);assert status==200,data;a=data['album'];assert len(a['tracks'])==1
key=a['media'][0]['storageKey'];path='/api/contributor/audio/'+key
assert http(path)[0]==403
status,body=http(path,headers=dict(HEAD,Range='bytes=0-3'));assert status==206 and body==b'fLaC'
assert http('/api/contributor/media/'+key,headers=HEAD)[0]==403
status,_=http(path,headers=dict(HEAD,Range='bytes=999999999999-'));assert status==416
assert http('/discography/'+a['slug'])[0]==404
a=save(a,'submit');status,data=api('/api/contributor/albums/'+a['id'],{'action':'approve','expectedRevision':a['revision']});assert status==200,data;a=data['album']
public=http('/discography/'+a['slug'])[1].decode();assert key not in public and '/api/contributor/audio/' not in public and 'test.flac' not in public
assert http('/api/archive/media/'+a['id']+'/'+a['media'][0]['id'])[0]==404
oldkey=a['media'][0]['storageKey'];status,data=upload(a,'test.m4a','album',a['media'][0]['id']);assert status==200,data;a=data['album'];assert a['media'][0]['storageKey']!=oldkey
status,_=upload(a,'test.wav',track['id'],expected=a['revision']-1);assert status==409
status,_=upload(a,'test.wav','missing-track');assert status==400
status,_=http('/api/contributor/albums/'+a['id']+'/audio',b'not audio','POST',dict(HEAD,**{'x-audio-name':'fake.flac','x-audio-target':'album','x-expected-revision':str(a['revision'])}));assert status==400
state={'id':a['id'],'revision':a['revision'],'trackId':track['id'],'mediaCount':len(a['media']),'keys':[m['storageKey'] for m in a['media']]}
Path('/private/tmp/naoko-audio-http-state.json').write_text(json.dumps(state))
checks=['four actual lossless formats uploaded','AAC M4A rejected','automatic track creation rejected','existing stable track association','private protected range reads','image endpoint rejects audio','invalid range rejected','draft absent from public list','approved record excludes audio files and paths','replacement remains a draft','stale revision conflict','missing track rejected','invalid file removed']
Path('docs/contributor-audio-http-qa.json').write_text(json.dumps({'checks':checks,'passed':True,'localOnly':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':True,'checks':checks,'testAlbumId':a['id']},ensure_ascii=False))
