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
  const bytes=readFileSync(new URL('../tests/fixtures/lossless/test.flac',import.meta.url)),prepared=await receiveAudio(dir,new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),'test.flac',bytes.length);a=store.attachAudio(a.id,a.revision,prepared,t.id,undefined,e.id);
  if(review){a=owner.save(a,'submit',a.id,a.revision);a=new ContributorStore(store,admin).transition(a.id,'approve',a.revision);}
  published.push(a);
 }
 writeFileSync(path.join(dir,'sharing-fixtures.json'),JSON.stringify(published),{mode:0o600});store.close();console.log('Isolated image and FLAC fixtures created');
}else if(mode==='verify'){
 const [published,draft]=JSON.parse(readFileSync(path.join(dir,'sharing-fixtures.json'))),media=(a,type)=>a.media.find(m=>m.type===type),url=(a,m)=>`/api/archive/media/${a.id}/${m.id}`;
 async function request(route,{cookie='',headers={},expected=200}={}){const r=await fetch(base+route,{headers:{...headers,...(cookie?{Cookie:cookie}:{})},redirect:'manual'});assert.equal(r.status,expected,route);return r;}
 async function login(username){const r=await fetch(base+'/api/contributor/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 await request(url(published,media(published,'cover')));const sound=media(published,'audio'),bytes=readFileSync(new URL('../tests/fixtures/lossless/test.flac',import.meta.url));
 const partial=await request(url(published,sound),{headers:{Range:'bytes=0-15'},expected:206});assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(0,16));
 const download=await request(url(published,sound)+'?download=1');assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
 await request(url(published,sound),{headers:{Range:'bytes=999999999-'},expected:416});await request(url(draft,media(draft,'audio')),{expected:404});await request(url(published,media(draft,'audio')),{expected:404});
 const owner=await login('media_owner'),other=await login('media_other'),key=media(draft,'audio').storageKey,preview='/api/contributor/audio/'+key;
 await request(preview,{cookie:owner});await request(preview,{cookie:other,expected:404});await request(preview,{expected:401});
 const html=await (await request(`/discography/${published.slug}/editions/${published.editions[0].id}`)).text();assert.ok(html.includes('<audio'));assert.ok(html.includes('下载音源'));assert.ok(!html.includes(sound.storageKey));
 const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks:['legacy private media needs no per-file approval flags','approved image reads successfully','FLAC playback range 206 matches bytes','download disposition and bytes correct','invalid range 416','draft and cross-album media 404','author draft preview 200; other author 404; anonymous 401','version page contains player and download without storage keys'],publishedId:published.id,draftId:draft.id,editionId:draft.editions[0].id,publicUrl:`/discography/${published.slug}/editions/${published.editions[0].id}`};writeFileSync(new URL('../docs/site-media-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 for(const cookie of [owner,other])await fetch(base+'/api/contributor/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base}});
}else throw new Error('Use seed or verify');
