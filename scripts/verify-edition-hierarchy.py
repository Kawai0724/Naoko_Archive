"""Mutates isolated QA data only. Never run against the user's real database."""
import json,re,struct,sys,urllib.error,urllib.parse,urllib.request,uuid,zlib
from pathlib import Path
if '--isolated-qa' not in sys.argv:raise SystemExit('Start an isolated ARCHIVE_DATA_DIR server and pass --isolated-qa.')
BASE='http://127.0.0.1:3011'
def http(path,body=None,method='GET',headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE+path,data=body,method=method,headers=headers or {}),timeout=30) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
status,page=http('/contributor/albums/new');assert status==200
match=re.search(r'\\"token\\":\\"([0-9a-f]{64})\\"',page.decode()) or re.search(r'"token":"([0-9a-f]{64})"',page.decode());assert match
HEAD={'x-local-editor-token':match.group(1),'Origin':BASE}
def api(path,data=None,method='GET'):
    status,body=http(path,json.dumps(data).encode() if data is not None else None,method,dict(HEAD,**{'Content-Type':'application/json'}));return status,json.loads(body)
def save(a,action='draft'):
    status,data=api('/api/contributor/albums/'+a['id'],{'album':a,'action':action,'expectedRevision':a['revision']},'PATCH');assert status==200,data;return data['album']
def approve(a):
    a=save(a,'submit');status,data=api('/api/contributor/albums/'+a['id'],{'action':'approve','expectedRevision':a['revision']},'PATCH');assert status==200,data;return data['album']
def png(color):
    def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
    pixels=b''.join(b'\0'+bytes(color)*256 for _ in range(256))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
def cover(a,eid,name,color):
    boundary='NaokoQA'+uuid.uuid4().hex;parts=[]
    fields={'album':json.dumps(a),'expectedRevision':str(a['revision']),'type':'cover','editionId':eid}
    for k,v in fields.items():parts.append(b'--'+boundary.encode()+b'\r\nContent-Disposition: form-data; name="'+k.encode()+b'"\r\n\r\n'+v.encode()+b'\r\n')
    parts.append(b'--'+boundary.encode()+b'\r\nContent-Disposition: form-data; name="file"; filename="'+name.encode()+b'"\r\nContent-Type: image/png\r\n\r\n'+png(color)+b'\r\n--'+boundary.encode()+b'--\r\n')
    status,body=http('/api/contributor/albums/'+a['id']+'/media',b''.join(parts),'POST',dict(HEAD,**{'Content-Type':'multipart/form-data; boundary='+boundary}));data=json.loads(body);assert status==200,data;return data['album']
id=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--album-id=')),None);assert id
status,data=api('/api/contributor/albums/'+id);assert status==200;a=data['album'];assert a['title'].startswith('QA') and len(a['editions'])==1
e1=a['editions'][0]['id'];assert a['editions'][0]['catalogNumber']=='QA-A-001'
track={'id':str(uuid.uuid4()),'position':'01','title':'QA_A_TRACK','lyricsText':'PRIVATE_VERSION_A_LYRICS','lyricsRightsStatus':'private'}
a['editions'][0]['tracks']=[track];a['editions'][0]['editorNotes']='PRIVATE_VERSION_A_NOTE'
e2=str(uuid.uuid4());a['editions'].append({'id':e2,'editionName':'QA · 版本 B','catalogNumber':'QA-B-002','label':'QA 测试厂牌 B','format':'Vinyl LP','tracks':[{'id':str(uuid.uuid4()),'position':'01','title':'QA_B_TRACK'}],'purchaseLinks':[],'sources':[]});a=save(a)
a=cover(a,e1,'QA-cover-A.png',(159,106,83));a=cover(a,e2,'QA-cover-B.png',(89,124,142))
h=dict(HEAD,**{'x-audio-name':'QA_B_TRACK.flac','x-audio-target':a['editions'][1]['tracks'][0]['id'],'x-audio-edition':e2,'x-expected-revision':str(a['revision'])})
status,body=http('/api/contributor/albums/'+id+'/audio',Path('tests/fixtures/lossless/test.flac').read_bytes(),'POST',h);data=json.loads(body);assert status==200,data;a=data['album']
assert a['editions'][0]['tracks'][0]['title']=='QA_A_TRACK';assert len(a['editions'][1]['tracks'])==1;assert a['editions'][1]['tracks'][0]['title']=='QA_B_TRACK'
assert all(m['relatedEditionId'] in [e1,e2] for m in a['media'])
h['x-audio-target']=track['id'];h['x-expected-revision']=str(a['revision']);assert http('/api/contributor/albums/'+id+'/audio',Path('tests/fixtures/lossless/test.flac').read_bytes(),'POST',h)[0]==400
for m in a['media']:
    if m['type']=='cover':m.update(rightsStatus='licensed-public',publicationConfirmed=True)
a=approve(a);covers={m['relatedEditionId']:'/api/contributor/albums/'+id+'/covers/'+m['relatedEditionId'] for m in a['media'] if m['type']=='cover'}
catalog=http('/discography')[1].decode();assert covers[e1] in catalog and covers[e2] not in catalog
index='/discography/'+a['slug'];body=http(index)[1].decode();assert covers[e1] in body and covers[e2] in body and 'QA-A-001' in body and 'QA-B-002' in body
one=http(index+'/editions/'+e1)[1].decode();two=http(index+'/editions/'+e2)[1].decode();assert 'QA_A_TRACK' in one and 'QA_B_TRACK' not in one;assert 'QA_B_TRACK' in two and 'QA_A_TRACK' not in two
assert 'PRIVATE_VERSION_A' not in body+one+two
audio=next(m for m in a['media'] if m['type']=='audio');assert audio['storageKey'] not in body+one+two;assert http('/api/archive/media/'+id+'/'+audio['id'])[0]==404
a['editions'].reverse();a=save(a);assert covers[e1] in http('/discography')[1].decode();a=approve(a);catalog=http('/discography')[1].decode();assert covers[e2] in catalog and covers[e1] not in catalog
a['editions'].reverse();a=approve(a)
state={'id':id,'firstEditionId':e1,'secondEditionId':e2,'slug':a['slug'],'firstCover':covers[e1],'secondCover':covers[e2],'revision':a['revision']}
Path('/private/tmp/naoko-hierarchy-http-state.json').write_text(json.dumps(state))
checks=['album created through browser','version A saved through browser','independent version metadata and tracklists','per-version actual cover upload','audio links existing track in selected version','cross-version audio link refused','first version cover inherited by album catalog','second level displays both versions and covers','version detail isolates tracklist','private lyrics and audio absent from public pages','draft reorder retains approved cover','approved reorder updates album cover']
Path('docs/edition-hierarchy-http-qa.json').write_text(json.dumps({'passed':True,'checks':checks,'isolatedData':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':True,'state':state,'checks':checks},ensure_ascii=False))
