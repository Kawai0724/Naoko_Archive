// Seed/verify only a new disposable database, never a production data directory.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url),[mode,directory]=process.argv.slice(2),dir=realpathSync(directory);
if(!dir.startsWith('/private/tmp/naoko-sharing-qa.'))throw new Error('Expected a new /private/tmp/naoko-sharing-qa.* directory');
const password='site-media-test-password',base='http://127.0.0.1:3416';
if(mode==='seed'){
 if(existsSync(path.join(dir,'archive.sqlite')))throw new Error('Refusing to seed an existing database');
 const {AlbumStore}=require('../.test-build/src/lib/album-store.js'),{IdentityStore}=require('../.test-build/src/lib/identity-store.js'),{ContributorStore}=require('../.test-build/src/lib/contributor-store.js'),{emptyAlbum,emptyEdition,emptyTrack}=require('../.test-build/src/lib/albums.js'),{receiveAudio}=require('../.test-build/src/lib/lossless-audio.js');
 const store=new AlbumStore(dir),identity=new IdentityStore(store.db);identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
 const accounts={};for(const username of ['media_owner','media_other']){const a=identity.register(username,password,'');identity.reviewRegistration(admin,a.user.id,'approved',1,'');accounts[username]=identity.session(a.token);}
 const owner=new ContributorStore(store,accounts.media_owner),published=[];
 for(const review of [true,false]){const e=emptyEdition(),t=emptyTrack(1);e.editionName='Test edition';t.title='Test track';e.tracks=[t];let a=owner.save({...emptyAlbum(),title:review?'Shared media test':'Draft media test',editions:[e]},'draft');
  a=store.attachImages(a,[{name:'cover.png',bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}],a.id,a.revision,undefined,'cover',e.id);
  a=store.attachImages(a,[{name:'scan.png',bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}],a.id,a.revision,undefined,'scan',e.id);
  const bytes=readFileSync(new URL('../tests/fixtures/lossless/test.flac',import.meta.url)),prepared=await receiveAudio(dir,new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),'test.flac',bytes.length);a=store.attachAudio(a.id,a.revision,prepared,t.id,undefined,e.id);
  if(review){a=owner.save(a,'submit',a.id,a.revision);a=new ContributorStore(store,admin).transition(a.id,'approve',a.revision);}
  published.push(a);
 }
 writeFileSync(path.join(dir,'sharing-fixtures.json'),JSON.stringify(published),{mode:0o600});store.close();console.log('Isolated image and FLAC fixtures created');
}else if(mode==='verify'){
 const [published,draft]=JSON.parse(readFileSync(path.join(dir,'sharing-fixtures.json'))),media=(a,type)=>a.media.find(m=>m.type===type),url=(a,m)=>`/api/archive/media/${a.id}/${m.id}`;
 async function request(route,{cookie='',headers={},expected=200}={}){const r=await fetch(base+route,{headers:{...headers,...(cookie?{Cookie:cookie}:{})},redirect:'manual'});assert.equal(r.status,expected,route);return r;}
 async function login(username){const r=await fetch(base+'/api/contributor/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 const owner=await login('media_owner'),other=await login('media_other'),admin=await login('fly-me-to-1980');
 const cover=media(published,'cover'),scan=media(published,'scan'),sound=media(published,'audio'),bytes=readFileSync(new URL('../tests/fixtures/lossless/test.flac',import.meta.url));
 for(const cookie of ['',owner,other,'naoko_contributor_v2=forged-token']){
  const r=await request(url(published,cover),{cookie});assert.equal(r.headers.get('content-type'),'image/png');assert.ok((await r.arrayBuffer()).byteLength>0);
 }
 await request(url(published,scan),{expected:401});await request(url(published,scan),{cookie:other});
 for(const cookie of [owner,other])for(const headers of [{},{Range:'bytes=0-15'}]){
  const denied=await request(url(published,sound),{cookie,headers,expected:403});assert.equal(denied.headers.get('location'),null);
  await request(url(published,sound)+'?download=1',{cookie,headers,expected:403});
 }
 await request(url(published,sound),{expected:401});await request(url(published,sound),{cookie:'naoko_contributor_v2=forged-token',expected:401});
 const partial=await request(url(published,sound),{cookie:admin,headers:{Range:'bytes=0-15'},expected:206});assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(0,16));
 const download=await request(url(published,sound)+'?download=1',{cookie:admin});assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
 await request(url(published,sound),{cookie:admin,headers:{Range:'bytes=999999999-'},expected:416});
 for(const cookie of ['',owner,other,admin])await request(url(draft,media(draft,'cover')),{cookie,expected:404});
 await request(url(published,media(draft,'audio')),{cookie:admin,expected:404});
 const pending=await fetch(base+'/api/contributor/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'pending_media_'+Date.now().toString(36),password})});assert.equal(pending.status,201);const pendingCookie=pending.headers.get('set-cookie').split(';')[0];
 await request(url(published,cover),{cookie:pendingCookie});await request(url(published,sound),{cookie:pendingCookie,expected:403});
 const key=media(draft,'audio').storageKey,preview='/api/contributor/audio/'+key;
 await request(preview,{cookie:owner,expected:403});await request(preview,{cookie:other,expected:403});await request(preview,{expected:401});await request(preview,{cookie:admin});await request(preview+'?download=1',{cookie:owner,expected:403});
 for(const cookie of ['',owner,other,pendingCookie]){
  const html=await(await request(`/discography/${published.slug}/editions/${published.editions[0].id}`,{cookie})).text();
  assert.ok(html.includes(url(published,cover)));assert.ok(!html.includes('<audio'));assert.ok(!html.includes('下载音源'));assert.ok(!html.includes(url(published,sound)));assert.ok(!html.includes(sound.storageKey));assert.ok(!html.includes('登录查看图片与音源'));
  const catalogue=await(await request('/discography',{cookie})).text();assert.ok(catalogue.includes(url(published,cover)));
 }
 const adminHtml=await(await request(`/discography/${published.slug}/editions/${published.editions[0].id}`,{cookie:admin})).text();assert.ok(adminHtml.includes('<audio'));assert.ok(adminHtml.includes('下载音源'));
 const editorPath=`/contributor/albums/${draft.id}/editions/${draft.editions[0].id}`;
 for(const suffix of ['/edit?section=audio','/preview']){
  const authorHtml=await(await request(editorPath+suffix,{cookie:owner})).text();assert.ok(!authorHtml.includes('<audio'));assert.ok(!authorHtml.includes('下载音源'));assert.ok(!authorHtml.includes(preview));
  const html=await(await request(editorPath+suffix,{cookie:admin})).text();assert.ok(html.includes('<audio'));assert.ok(html.includes('下载音源'));
 }
 const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks:['published cover PNG bytes accessible anonymously, forged, pending and approved member','unpublished and cross-album files 404','scan image remains approved-member only','published audio, Range and download denied to contributor including owner; no redirect','anonymous/forged audio 401; pending audio 403','administrator FLAC Range 206, byte-exact download, invalid Range 416','draft audio author/other member 403; administrator 200','guest/member catalogue and version HTML contain cover but no audio URLs/player','contributor edit and preview omit audio controls; administrator retains them'],publishedId:published.id,draftId:draft.id,editionId:draft.editions[0].id,publicUrl:`/discography/${published.slug}/editions/${published.editions[0].id}`};writeFileSync(new URL('../docs/site-media-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 for(const cookie of [owner,other,admin,pendingCookie])await fetch(base+'/api/contributor/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base}});
}else throw new Error('Use seed or verify');
