import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AlbumStore,StoreError} from '../src/lib/album-store';
import {emptyAlbum,emptyEdition,emptyTrack} from '../src/lib/albums';
import {IdentityStore} from '../src/lib/identity-store';
import {ContributorStore} from '../src/lib/contributor-store';
import {receiveAudio} from '../src/lib/lossless-audio';
import {mediaDisposition,mediaResponse} from '../src/lib/media-delivery';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
function setup(t:TestContext){const dir=mkdtempSync(path.join(tmpdir(),'naoko-sharing-')),store=new AlbumStore(dir);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return {dir,store};}
async function audio(dir:string){const bytes=readFileSync(path.join(process.cwd(),'tests/fixtures/lossless/test.flac'));return receiveAudio(dir,new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),'test.flac',bytes.length);}
test('media sharing needs no licence flags and only exposes reviewed snapshots, retaining replacement and deletion boundaries',async t=>{
 const {dir,store}=setup(t),edition=emptyEdition(),track=emptyTrack(1);track.title='Song';edition.tracks=[track];let album=store.save({...emptyAlbum(),title:'Shared album',editions:[edition]},'draft');
 album=store.attachImages(album,[{name:'cover.png',bytes:png}],album.id,album.revision,undefined,'cover',edition.id);
 album=store.attachAudio(album.id,album.revision,await audio(dir),track.id,undefined,edition.id);
 const cover=album.media[0],recording=album.media[1];assert.ok(album.media.every(m=>m.rightsStatus==='private'&&!m.publicationConfirmed));
 assert.throws(()=>store.publishedMedia(album.id,cover.id),e=>e instanceof StoreError&&e.status===404);
 album=store.save(album,'submit',album.id,album.revision);album=store.transition(album.id,'approve',album.revision,true);
 const view=store.published().find(a=>a.id===album.id)!;assert.equal(view.media.length,2);assert.equal(view.media[1].relatedTrackId,track.id);assert.ok(!JSON.stringify(view).includes(recording.storageKey!));assert.equal(store.publishedMedia(album.id,recording.id).storageKey,recording.storageKey);
 album=store.attachImages(album,[{name:'replacement.png',bytes:png}],album.id,album.revision,cover.id,'cover',edition.id);assert.equal(store.publishedMedia(album.id,cover.id).storageKey,cover.storageKey);
 album=store.transition(album.id,'delete',album.revision,true);assert.throws(()=>store.publishedMedia(album.id,recording.id),e=>e instanceof StoreError&&e.status===404);
});
test('audio delivery supports playback ranges, safe downloads and private COS signed redirects',async t=>{
 const {dir,store}=setup(t);let album=store.save({...emptyAlbum(),title:'Playback'},'draft');album=store.attachAudio(album.id,album.revision,await audio(dir),'album');const media=album.media[0],bytes=readFileSync(path.join(dir,'private-media',media.storageKey!));
 const ranged=mediaResponse(new Request('http://localhost/media',{headers:{Range:'bytes=1-7'}}),store,media.storageKey!,'曲目.flac');assert.equal(ranged.status,206);assert.equal(ranged.headers.get('content-range'),`bytes 1-7/${bytes.length}`);assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),bytes.subarray(1,8));assert.ok(ranged.headers.get('content-disposition')?.startsWith('inline;'));
 const download=mediaResponse(new Request('http://localhost/media?download=1'),store,media.storageKey!,'曲目.flac');assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);assert.ok(download.headers.get('content-disposition')?.startsWith('attachment;'));assert.equal(download.headers.get('cache-control'),'no-store');
 for(const range of ['bytes=999999999-','bytes=-0','bytes=0-1,3-4','invalid'])assert.equal(mediaResponse(new Request('http://localhost/media',{headers:{Range:range}}),store,media.storageKey!,'x').status,416);
 assert.ok(!mediaDisposition('x\r\nInjected: true.flac',true).includes('\r'));
 const oldId=process.env.COS_SECRET_ID,oldKey=process.env.COS_SECRET_KEY;process.env.COS_SECRET_ID='test-only-id';process.env.COS_SECRET_KEY='test-only-key';
 try{const redirect=mediaResponse(new Request('http://localhost/media?download=1'),store,'pending/test/unique.flac','曲目.flac'),url=new URL(redirect.headers.get('location')!);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('cache-control'),'no-store');assert.ok(url.searchParams.get('response-content-disposition')?.startsWith('attachment;'));assert.ok(url.searchParams.get('q-signature'));const [start,end]=url.searchParams.get('q-key-time')!.split(';').map(Number);assert.equal(end-start,120);}finally{if(oldId===undefined)delete process.env.COS_SECRET_ID;else process.env.COS_SECRET_ID=oldId;if(oldKey===undefined)delete process.env.COS_SECRET_KEY;else process.env.COS_SECRET_KEY=oldKey;}
});
test('contributors may preview their own uploaded audio but cannot access another author draft or forge cross-album references',async t=>{
 const {dir,store}=setup(t),identity=new IdentityStore(store.db),password='sharing-test-password';identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
 const one=identity.register('sharing_one',password,''),two=identity.register('sharing_two',password,'');for(const u of [one,two])identity.reviewRegistration(admin,u.user.id,'approved',1,'');
 const a=new ContributorStore(store,identity.session(one.token)!),b=new ContributorStore(store,identity.session(two.token)!);let album=a.save({...emptyAlbum(),title:'Own audio'},'draft');album=store.attachAudio(album.id,album.revision,await audio(dir),'album');const key=album.media[0].storageKey!;assert.equal(a.media(key,true).mime_type,'audio/flac');assert.throws(()=>b.media(key,true),e=>e instanceof StoreError&&e.status===404);
 const other=b.save({...emptyAlbum(),title:'Other'},'draft');assert.throws(()=>b.save({...other,media:album.media},'draft',other.id,other.revision),/引用无效/);
});
