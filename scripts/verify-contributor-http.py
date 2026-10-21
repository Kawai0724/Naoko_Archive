"""Run against an isolated local dev:admin server, never the user's real data directory."""
import base64,copy,json,re,sys,urllib.request,urllib.error,uuid
from pathlib import Path
if '--isolated-qa' not in sys.argv:
    raise SystemExit('This script changes records. Start an isolated ARCHIVE_DATA_DIR server and pass --isolated-qa.')
BASE=next((arg for arg in sys.argv[1:] if not arg.startswith('--')), 'http://127.0.0.1:3011')
STATE=Path('/private/tmp/naoko-contributor-http-state.json')
def http(url,body=None,method='GET',headers=None):
    req=urllib.request.Request(BASE+url,data=body,method=method,headers=headers or {})
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
status,page=http('/contributor/albums/new');assert status==200
match=re.search(r'\\"token\\":\\"([0-9a-f]{64})\\"',page.decode()) or re.search(r'"token":"([0-9a-f]{64})"',page.decode());assert match
TOKEN=match.group(1)
HEAD={'Content-Type':'application/json','x-local-editor-token':TOKEN,'Origin':BASE}
def api(url,data=None,method='GET',headers=None):
    status,body=http(url,json.dumps(data).encode() if data is not None else None,method,headers or HEAD)
    return status,json.loads(body)
def save(a,action='draft'):
    status,data=api('/api/contributor/albums'+('/'+a['id'] if a.get('id') else ''),{'album':a,'action':action,'expectedRevision':a.get('revision',0)},'PATCH' if a.get('id') else 'POST')
    assert status in [200,201],(status,data)
    return data['album']
def review(a,action='approve'):
    status,data=api('/api/contributor/albums/'+a['id'],{'action':action,'expectedRevision':a['revision'],'confirm':True},'PATCH');assert status==200,(status,data)
    return data['album']
def key():return str(uuid.uuid4())
assert http('/api/contributor/albums')[0]==403
status,data=api('/api/contributor/albums',{'action':'draft','album':{}},'POST',dict(HEAD,Origin='https://untrusted.invalid'));assert status==403
# Blank draft, then minimal submission, including partial date (no invented day).
a=save({'title':'','artist':''});assert a['title']==''
a.update(title='QA HTTP · 持久化验收',artist='河合奈保子',firstReleaseDate={'value':'1987','precision':'year'})
a=save(a,'submit');assert a['status']=='pending-review'
assert 'QA HTTP · 持久化验收' not in http('/discography')[1].decode()
t1={'id':key(),'position':'A1','title':'QA HTTP 曲目一'}
t2={'id':key(),'position':'B1','title':'QA HTTP 曲目二','composers':[{'id':key(),'name':'QA 作曲甲'},{'id':key(),'name':'QA 作曲乙'}],'lyricists':[{'id':key(),'name':'QA 作词甲'},{'id':key(),'name':'QA 作词乙'}],'lyricsText':'QA_ONLY_PRIVATE_LYRICS\n\nQA_ONLY_PRIVATE_LAST_LINE','lyricsRightsStatus':'private'}
e1={'id':key(),'editionName':'QA 版本一','catalogNumber':'QA-HTTP-01','label':'QA 厂牌甲','releaseDate':{'value':'1987','precision':'year'}}
e2={'id':key(),'editionName':'QA 版本二','catalogNumber':'QA-HTTP-02','label':'QA 厂牌乙','releaseDate':{'value':'1987-06','precision':'month'}}
a.update(tracks=[t1,t2],editions=[e1,e2],editorNotes='QA_ONLY_PRIVATE_EDITOR_NOTES')
a=save(a)
assert a['tracks'][1]['lyricsText']==t2['lyricsText'] and len(a['tracks'][1]['composers'])==2
# Actual private image bytes persisted outside public; SVG/audio upload is not accepted.
image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
boundary='NaokoQA'+uuid.uuid4().hex
fields=b''.join(b'--'+boundary.encode()+b'\r\nContent-Disposition: form-data; name="'+name.encode()+b'"\r\n\r\n'+value.encode()+b'\r\n' for name,value in [('album',json.dumps(a)),('expectedRevision',str(a['revision'])),('type','cover')])
multipart=fields+b'--'+boundary.encode()+b'\r\nContent-Disposition: form-data; name="file"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n'+image+b'\r\n--'+boundary.encode()+b'--\r\n'
status,body=http('/api/contributor/albums/'+a['id']+'/media',multipart,'POST',dict(HEAD,**{'Content-Type':'multipart/form-data; boundary='+boundary}));assert status==200,body
a=json.loads(body)['album'];m=a['media'][0];file={'storageKey':m['storageKey']};a=save(a,'submit')
preview=http('/contributor/albums/'+a['id']+'/preview')[1].decode();assert a['title'] in preview and 'QA_ONLY_PRIVATE_LYRICS' not in preview and 'QA_ONLY_PRIVATE_EDITOR_NOTES' not in preview
assert http('/api/contributor/media/'+file['storageKey'])[0]==403
status,body=http('/api/contributor/media/'+file['storageKey'],headers=HEAD);assert status==200 and body==image
publicpath='/discography/'+a['slug'];assert http(publicpath)[0]==404
# Approval changes public snapshot; editing does not.
a=review(a);body=http(publicpath)[1].decode();assert a['title'] in body and 'QA 厂牌甲' in body and 'QA 厂牌乙' in body
assert 'QA_ONLY_PRIVATE_LYRICS' not in body and 'QA_ONLY_PRIVATE_EDITOR_NOTES' not in body and file['storageKey'] not in body
assert http('/api/archive/media/'+a['id']+'/'+m['id'])[0]==404
oldtitle=a['title'];a['title']='QA HTTP · 审核后的新版';a=save(a);body=http(publicpath)[1].decode();assert oldtitle in body and a['title'] not in body
a=save(a,'submit');assert a['title'] not in http(publicpath)[1].decode()
a=review(a);assert a['title'] in http(publicpath)[1].decode()
# Licensed flag alone is insufficient; confirmation and approval are both necessary.
a['tracks'][1]['lyricsRightsStatus']='licensed-public';a['tracks'][1]['lyricsPublicationConfirmed']=False;a=review(save(a,'submit'));assert 'QA_ONLY_PRIVATE_LYRICS' not in http(publicpath)[1].decode()
a['media'][0].update(rightsStatus='licensed-public',publicationConfirmed=True);a=review(save(a,'submit'))
status,body=http('/api/archive/media/'+a['id']+'/'+m['id']);assert status==200 and body==image
stale=copy.deepcopy(a);a=save(a)
status,_=api('/api/contributor/albums/'+a['id'],{'action':'draft','album':stale,'expectedRevision':stale['revision']},'PATCH');assert status==409
bad=copy.deepcopy(a);bad['tracks'][0]['title']='';status,_=api('/api/contributor/albums/'+a['id'],{'action':'submit','album':bad,'expectedRevision':a['revision']},'PATCH');assert status==400
status,data=api('/api/contributor/albums/'+a['id']);assert status==200 and len(data['history'])>=8
assert data['album']['tracks'][1]['lyricsText']==t2['lyricsText']
a=review(a,'delete');assert http(publicpath)[0]==404
a=review(a,'restore');assert http(publicpath)[0]==200
STATE.write_text(json.dumps({'id':a['id'],'title':a['title'],'publicpath':publicpath,'revision':a['revision']},ensure_ascii=False))
checks=['blank draft','minimal submission','two tracks and multi-person credits','two editions and partial dates','private image persistence','draft preview isolation','private lyric and editor-note protection','reviewed public snapshot','edits isolated until approval','image authorization gate','optimistic concurrency','submit validation','recoverable deletion','API token and origin guard']
Path('docs/contributor-http-qa.json').write_text(json.dumps({'checks':checks,'passed':True,'database':'/private/tmp/naoko-contributor-qa (isolated QA only)','restartCheckPending':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':True,'checks':checks,'testAlbumId':a['id']},ensure_ascii=False))
