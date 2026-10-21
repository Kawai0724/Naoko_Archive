// Use only with a fresh disposable database at localhost:3416 and the test password below.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:3416',password='optional-reason-test-password';
async function request(url,{method='GET',body,cookie='',expected=200,raw=false}={}){
 const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(r.status,expected,method+' '+url);return raw?r:r.json();
}
const login=await request('/api/contributor/auth/login',{method:'POST',body:{username:'fly-me-to-1980',password},raw:true}),cookie=login.headers.get('set-cookie').split(';')[0];
let album=(await request('/api/contributor/albums',{method:'POST',cookie,body:{action:'submit',album:{title:'Optional reason approval test',artist:'Test artist'}},expected:201})).album;
let queue=await request('/api/contributor/requests',{cookie}),message=queue.albumRequests.find(r=>r.album_id===album.id);assert.equal(message.reason,'');assert.equal(message.status,'pending');
assert.ok((await (await request('/contributor/submissions',{cookie,raw:true})).text()).replace(/<!--[\s\S]*?-->/g,'').includes('理由：无'));
album=(await request('/api/contributor/requests',{method:'POST',cookie,body:{action:'review-album-change',id:message.id,decision:'approved',expectedRevision:1}})).album;
await request('/api/contributor/albums/'+album.id,{method:'DELETE',cookie,body:{confirm:true,expectedRevision:album.revision,reason:'  \n  '},expected:202});
queue=await request('/api/contributor/requests',{cookie});message=queue.albumRequests.find(r=>r.album_id===album.id&&r.status==='pending');assert.equal(message.reason,'');assert.equal(message.kind,'delete');
await request('/api/contributor/requests',{method:'POST',cookie,body:{action:'review-album-change',id:message.id,decision:'approved',expectedRevision:1}});
await request('/api/contributor/albums',{method:'POST',cookie,body:{action:'submit',album:{title:'Invalid long reason',artist:'Test artist'},reason:'x'.repeat(2001)},expected:400});
await request('/api/contributor/requests',{method:'POST',cookie,body:{action:'site-change',field:'aboutIntro',value:'Disposable test introduction',expectedRevision:queue.content.aboutIntro.revision},expected:201});
// Leave one pending example and one editable example for browser checks, only in this disposable database.
const preview=(await request('/api/contributor/albums',{method:'POST',cookie,body:{action:'submit',album:{title:'Optional reason preview',artist:'Test artist'},reason:' \n '},expected:201})).album;
const editable=(await request('/api/contributor/albums',{method:'POST',cookie,body:{action:'draft',album:{title:'Optional reason form',artist:'Test artist'}},expected:201})).album;
const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks:['omitted content reason persists empty and renders 理由：无','administrator manually approves empty-reason content','whitespace deletion reason persists empty and administrator may approve','2001 characters rejected','site-change omitted reason accepted'],previewId:preview.id,editableId:editable.id};
await writeFile(new URL('../docs/optional-reasons-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
await request('/api/contributor/auth/logout',{method:'POST',cookie});
