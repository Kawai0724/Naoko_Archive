// Run only against an isolated localhost server, never against production data.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile,writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url),{emptyAlbum,emptyEdition,emptyTrack}=require('../.test-build/src/lib/albums.js');
const base=process.env.CONTRIBUTOR_TEST_BASE_URL||'http://127.0.0.1:3412';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('This test must use an isolated localhost database');
const results=[];
async function request(path,{cookie='',method='GET',body,origin=base,expected=200,raw=false}={}){
  const headers={};if(cookie)headers.Cookie=cookie;if(method!=='GET')headers.Origin=origin;
  if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  assert.equal(r.status,expected,`${method} ${path}: expected ${expected}, got ${r.status}`);
  if(raw)return r;return r.json();
}
const password=process.env.CONTRIBUTOR_TEST_PASSWORD||'test-only-password-very-long';
await request('/api/contributor/albums',{expected:401});await request('/api/contributor/admin',{expected:401});
const anon=await request('/contributor',{raw:true,expected:307});assert.equal(anon.headers.get('location'),'/contributor/login');
const login=await request('/api/contributor/auth/login',{method:'POST',body:{username:'fly-me-to-1980',password},raw:true});
const admin=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));results.push('anonymous access rejected; administrator login and HttpOnly cookie');
await request('/contributor/members',{cookie:admin,raw:true});
async function inviteUser(prefix){
  const {invite}=await request('/api/contributor/admin',{cookie:admin,method:'POST',body:{action:'invite'},expected:201});
  const username=prefix+'_'+randomUUID().slice(0,8),r=await request('/api/contributor/auth/accept',{method:'POST',body:{token:invite.token,username,password},expected:201,raw:true});
  await request('/api/contributor/auth/accept',{method:'POST',body:{token:invite.token,username:username+'2',password},expected:400});return {cookie:r.headers.get('set-cookie').split(';')[0],user:(await r.json()).user};
}
const alice=await inviteUser('alice'),bob=await inviteUser('bob');results.push('two invited accounts; invite replay rejected');
await request('/api/contributor/admin',{cookie:alice.cookie,expected:403});await request('/api/contributor/admin',{cookie:alice.cookie,method:'POST',body:{action:'invite'},expected:403});
await request('/contributor/members',{cookie:alice.cookie,expected:404,raw:true});
const input=emptyAlbum(),edition=emptyEdition(),track=emptyTrack(1);input.title='V2 isolated HTTP test';track.title='Test track';edition.tracks=[track];edition.trackIds=[track.id];input.editions=[edition];
let data=await request('/api/contributor/albums',{cookie:alice.cookie,method:'POST',body:{action:'draft',album:input},expected:201}),album=data.album;
assert.equal(album.contributor,alice.user.username);
for(const path of ['/api/contributor/albums/'+album.id,'/contributor/albums/'+album.id,'/contributor/albums/'+album.id+'/preview'])await request(path,{cookie:bob.cookie,expected:404,raw:true});
await request('/api/contributor/albums/'+album.id,{cookie:bob.cookie,method:'PATCH',body:{action:'delete',expectedRevision:album.revision,confirm:true},expected:404});
await request('/api/contributor/albums/'+album.id,{cookie:alice.cookie,method:'PATCH',body:{action:'approve',expectedRevision:album.revision},expected:403});
await request('/api/contributor/albums/'+album.id,{cookie:alice.cookie,method:'PATCH',origin:'https://evil.test',body:{action:'draft',album,expectedRevision:album.revision},expected:403});
const others=await request('/api/contributor/albums',{cookie:bob.cookie});assert.ok(!others.albums.some(x=>x.id===album.id));results.push('server-side album, page, history, admin and CSRF access isolation');
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
async function upload(name,mime,kind,bytes,target='album'){
  const grant=await request('/api/contributor/uploads',{cookie:alice.cookie,method:'POST',body:{albumId:album.id,editionId:edition.id,expectedRevision:album.revision,name,mimeType:mime,kind,size:bytes.length,target}});
  assert.ok(new URL(grant.uploadUrl).searchParams.get('q-header-list').includes('x-cos-forbid-overwrite'));
  const r=await fetch(grant.uploadUrl,{method:'PUT',headers:grant.headers,body:bytes});assert.equal(r.status,200,`COS upload ${kind}`);
  const tamperedHeaders={...grant.headers};delete tamperedHeaders['x-cos-forbid-overwrite'];
  const tampered=await fetch(grant.uploadUrl,{method:'PUT',headers:tamperedHeaders,body:bytes});assert.equal(tampered.status,403,'removing the signed overwrite protection must invalidate the signature');
  const replay=await fetch(grant.uploadUrl,{method:'PUT',headers:grant.headers,body:bytes});assert.equal(replay.status,409,'COS overwrite must be forbidden');
  await request('/api/contributor/uploads/'+grant.uploadId+'/complete',{cookie:bob.cookie,method:'POST',body:{},expected:404});
  const result=await request('/api/contributor/uploads/'+grant.uploadId+'/complete',{cookie:alice.cookie,method:'POST',body:{}});album=result.album;
  await request('/api/contributor/uploads/'+grant.uploadId+'/complete',{cookie:alice.cookie,method:'POST',body:{},expected:409});
  return album.media.at(-1);
}
if(process.env.CONTRIBUTOR_TEST_COS==='1'){
  const m=await upload('v2-test-pixel.png','image/png','cover',image);assert.equal(m.rightsStatus,'private');
  const path='/api/contributor/media/'+m.storageKey;
  await request(path,{expected:401});await request(path,{cookie:bob.cookie,expected:404});
  const response=await request(path,{cookie:alice.cookie,raw:true,expected:302});const loaded=await fetch(response.headers.get('location'));assert.equal(loaded.status,200);assert.equal(createHash('sha256').update(Buffer.from(await loaded.arrayBuffer())).digest('hex'),createHash('sha256').update(image).digest('hex'));
  const reload=await request('/api/contributor/albums/'+album.id,{cookie:alice.cookie});assert.equal(reload.album.media.at(-1).storageKey,m.storageKey);results.push('real image: COS PUT, overwrite rejection, verify, SQLite association, owner preview, reload');
  const bytes=await readFile(new URL('../tests/fixtures/lossless/test.flac',import.meta.url)),audio=await upload('v2-test-audio.flac','audio/flac','audio',bytes,track.id);
  assert.equal(audio.codec,'FLAC');assert.equal(audio.relatedTrackId,track.id);assert.equal(audio.rightsStatus,'private');
  const audioPath='/api/contributor/audio/'+audio.storageKey;await request(audioPath,{cookie:alice.cookie,expected:403});await request(audioPath,{cookie:admin,expected:302,raw:true});results.push('real FLAC: direct COS upload, metadata validation, track association, admin-only access');
}
async function action(cookie,action,expected=200,note=''){const d=await request('/api/contributor/albums/'+album.id,{cookie,method:'PATCH',body:{action,album,expectedRevision:album.revision,note},expected});if(expected===200)album=d.album;}
await action(alice.cookie,'submit');assert.equal(album.status,'pending-review');await action(alice.cookie,'draft',409);await action(admin,'reject',200,'测试退回');assert.equal(album.status,'rejected');await action(alice.cookie,'submit');await action(admin,'approve');assert.equal(album.status,'published');
const publicPage=await request('/discography/'+album.slug,{raw:true});assert.ok((await publicPage.text()).includes(input.title));results.push('draft → pending → rejected → resubmitted → approved; public page refresh');
await request('/api/contributor/auth/logout',{cookie:alice.cookie,method:'POST'});await request('/api/contributor/albums',{cookie:alice.cookie,expected:401});results.push('logout invalidates database session');
const report={date:new Date().toISOString(),isolatedDatabase:true,cosTest:process.env.CONTRIBUTOR_TEST_COS==='1',checks:results};await writeFile(new URL('../docs/contributor-v2-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
