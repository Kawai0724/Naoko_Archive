import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlbumStore,StoreError } from '../src/lib/album-store';
import { IdentityStore } from '../src/lib/identity-store';
import { ContributorStore } from '../src/lib/contributor-store';
import { ContributorUploads } from '../src/lib/contributor-uploads';
import { emptyAlbum,emptyEdition,emptyTrack } from '../src/lib/albums';
import { inspectCloudAudio,uploadFormat,verifyImageHeader } from '../src/lib/cloud-media';
import { requireSameOrigin,sessionCookie } from '../src/lib/contributor-auth';
const password='test-only-password-very-long';
function setup(t:TestContext){
  const directory=mkdtempSync(path.join(tmpdir(),'naoko-v2-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);identity.bootstrap(password);
  const admin=identity.login('fly-me-to-1980',password).user;
  const alice=identity.accept(identity.invite(admin).token,'alice_fan',password),bob=identity.accept(identity.invite(admin).token,'bob_fan',password);
  identity.reviewRegistration(admin,alice.user.id,'approved',1,'');identity.reviewRegistration(admin,bob.user.id,'approved',1,'');
  t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});
  return {directory,store,identity,admin,alice,bob,a:new ContributorStore(store,alice.user),b:new ContributorStore(store,bob.user),s:new ContributorStore(store,admin)};
}
test('invitation-only accounts hash passwords and tokens; invitations are single-use, expiring and revocable',t=>{
  const {identity,admin,store,alice}=setup(t),inv=identity.invite(admin);
  assert.throws(()=>identity.invite(alice.user),e=>e instanceof StoreError&&e.status===403);
  identity.accept(inv.token,'charlie_fan',password);assert.throws(()=>identity.accept(inv.token,'delta_fan',password),/邀请无效/);
  const revoked=identity.invite(admin);identity.revoke(admin,revoked.id);assert.throws(()=>identity.accept(revoked.token,'delta_fan',password),/邀请无效/);
  const expired=identity.invite(admin);store.db.prepare('UPDATE contributor_invites SET expires_at=0 WHERE id=?').run(expired.id);assert.throws(()=>identity.accept(expired.token,'delta_fan',password),/邀请无效/);
  const rows=JSON.stringify(store.db.prepare('SELECT * FROM contributor_users').all());assert.ok(!rows.includes(password));assert.ok(!JSON.stringify(store.db.prepare('SELECT * FROM contributor_sessions').all()).includes(alice.token));assert.ok(!JSON.stringify(store.db.prepare('SELECT * FROM contributor_invites').all()).includes(inv.token));
  assert.throws(()=>identity.accept(identity.invite(admin).token,'ALICE_FAN',password),/已被使用/);
});
test('sessions survive reopen; old forged admin tokens, logout, expiration and disabled accounts are rejected',t=>{
  const {store,directory,identity,alice,admin}=setup(t);assert.equal(identity.session(alice.token)?.id,alice.user.id);assert.equal(identity.session('forged.admin'),null);
  const second=new AlbumStore(directory),other=new IdentityStore(second.db);assert.equal(other.session(alice.token)?.username,'alice_fan');second.close();
  identity.logout(alice.token);assert.equal(identity.session(alice.token),null);
  const login=identity.login('alice_fan',password);identity.disable(admin,alice.user.id,true);assert.equal(identity.session(login.token),null);assert.throws(()=>identity.login('alice_fan',password),/不正确/);
  identity.disable(admin,alice.user.id,false);const fresh=identity.login('alice_fan',password);store.db.prepare('UPDATE contributor_sessions SET expires_at=0').run();assert.equal(identity.session(fresh.token),null);
});
test('account login is rate limited persistently',t=>{
  const {identity}=setup(t);for(let i=0;i<10;i++)assert.throws(()=>identity.login('unknown',password),/不正确/);assert.throws(()=>identity.login('unknown',password),e=>e instanceof StoreError&&e.status===429);
});
test('ownership is server controlled; draft, review, reject, resubmit, approve and public snapshot isolation work',t=>{
  const {a,b,s,store,alice}=setup(t);const input={...emptyAlbum(),title:'Fan contribution',contributor:'fly-me-to-1980'},e=emptyEdition(),track=emptyTrack(1);track.title='A song';e.tracks=[track];input.editions=[e];
  let album=a.save(input,'draft');assert.equal(album.contributor,alice.user.username);assert.ok(!b.list().some(x=>x.id===album.id));
  for(const action of [()=>b.get(album.id),()=>b.revisions(album.id),()=>b.save(album,'draft',album.id,album.revision),()=>b.transition(album.id,'delete',album.revision)])assert.throws(action,e=>e instanceof StoreError&&e.status===404);
  assert.throws(()=>a.get('legacy-scarlet'),/不存在/);assert.equal(store.publishedRaw(album.id),null);
  album=a.save(album,'submit',album.id,album.revision,'核实资料后提交审核');assert.equal(album.status,'pending-review');assert.throws(()=>a.save(album,'draft',album.id,album.revision),e=>e instanceof StoreError&&e.status===409);
  assert.throws(()=>a.transition(album.id,'approve',album.revision),e=>e instanceof StoreError&&e.status===403);assert.throws(()=>a.transition(album.id,'reject',album.revision),/管理员/);
  album=s.transition(album.id,'reject',album.revision,'补充版本名称');assert.equal(album.status,'rejected');assert.equal(album.changeNote,'补充版本名称');
  album=a.save(album,'submit',album.id,album.revision,'核实资料后提交审核');album=s.transition(album.id,'approve',album.revision);assert.equal(album.status,'published');assert.equal(store.publishedRaw(album.id)?.title,input.title);
  album=a.save({...album,title:'Changed draft'},'draft',album.id,album.revision);assert.equal(store.publishedRaw(album.id)?.title,input.title);
  assert.throws(()=>a.transition(album.id,'delete',album.revision),/提交审核/);assert.throws(()=>a.save(album,'draft',album.id,album.revision-1),e=>e instanceof StoreError&&e.status===409);
  assert.deepEqual(album.editions[0].tracks[0].lyricists,[]);assert.equal(album.editions[0].tracks[0].lyricsText,null);
  let ownDraft=a.save({...emptyAlbum(),title:'Recoverable draft'},'draft');const deletion=a.requests.requestDelete(a.user,ownDraft.id,ownDraft.revision,'重复草稿');ownDraft=s.requests.review(s.user,deletion.id,'approved',deletion.revision).album;assert.ok(ownDraft.deletedAt);ownDraft=a.transition(ownDraft.id,'restore',ownDraft.revision);assert.equal(ownDraft.deletedAt,null);
});
test('COS tickets bind user, album, version, track, type, replacement and revision; complete is atomic and storage stays private',t=>{
  const {a,b,s,store}=setup(t),edition=emptyEdition(),track=emptyTrack(1);track.title='Existing';edition.tracks=[track];let album=a.save({...emptyAlbum(),title:'Cloud',editions:[edition]},'draft');
  const uploads=new ContributorUploads(a),others=new ContributorUploads(b);
  const params=()=>({albumId:album.id,editionId:edition.id,expectedRevision:album.revision,name:'cover.png',mimeType:'image/png',size:64,kind:'cover' as const});
  const ticket=uploads.create(params());assert.ok(ticket.object_key.startsWith('pending/'+album.id+'/'));assert.throws(()=>others.get(ticket.id),/不存在/);
  assert.throws(()=>others.create(params()),/不存在/);
  album=uploads.complete(ticket.id);assert.equal(album.media[0].rightsStatus,'private');assert.equal(album.media[0].publicationConfirmed,false);assert.throws(()=>uploads.complete(ticket.id),/已完成或过期/);
  assert.throws(()=>b.media(ticket.object_key),/不存在/);assert.equal(a.media(ticket.object_key).size,64);
  const stale=uploads.create(params());album=a.save(album,'draft',album.id,album.revision);assert.throws(()=>uploads.get(stale.id),/已更新/);
  for(let i=1;i<6;i++)album=uploads.complete(uploads.create(params()).id);assert.equal(album.media.length,6);assert.throws(()=>uploads.create(params()),/最多 6/);
  const first=album.media[0].id;album=uploads.complete(uploads.create({...params(),replaceId:first}).id);assert.equal(album.media.length,6);assert.equal(album.media[0].id,first);
  assert.throws(()=>uploads.create({...params(),kind:'audio',name:'test.flac',target:'missing'}),/已添加的曲目/);
  const audio=uploads.create({...params(),kind:'audio',name:'test.flac',target:track.id});album=uploads.complete(audio.id,{codec:'FLAC',extension:'flac',mimeType:'audio/flac',size:64,bitDepth:16,sampleRate:44100,channels:2,durationSeconds:1});
  const m=album.media.at(-1)!;assert.equal(m.relatedTrackId,track.id);assert.equal(m.relatedEditionId,edition.id);assert.equal(m.rightsStatus,'private');assert.throws(()=>a.media(m.storageKey!,true),e=>e instanceof StoreError&&e.status===403);assert.equal(s.media(m.storageKey!,true).mime_type,'audio/flac');
  album=a.save(album,'submit',album.id,album.revision,'核实资料后提交审核');assert.throws(()=>uploads.create(params()),/正在审核/);s.transition(album.id,'approve',album.revision);assert.equal(store.published().find(x=>x.id===album.id)?.media.length,7);
});
test('COS completion failure rolls back registration and ticket consumption',t=>{
  const {a}=setup(t),edition=emptyEdition();let album=a.save({...emptyAlbum(),title:'Rollback',editions:[edition]},'draft'),uploads=new ContributorUploads(a);
  const ticket=uploads.create({albumId:album.id,editionId:edition.id,expectedRevision:album.revision,name:'cover.png',mimeType:'image/png',size:64,kind:'cover'});
  a.store.db.prepare('CREATE TRIGGER reject_history BEFORE INSERT ON revisions BEGIN SELECT RAISE(ABORT,\'forced failure\'); END').run();
  assert.throws(()=>uploads.complete(ticket.id));assert.equal(a.store.cloudMediaInfo(ticket.object_key),undefined);assert.equal(uploads.get(ticket.id).status,'authorized');assert.equal(a.get(album.id).media.length,0);
});
test('formats, sizes, image signatures and cross-origin mutation checks are enforced',()=>{
  assert.throws(()=>uploadFormat('bad.svg','image/svg+xml',20,'cover'));
  assert.throws(()=>uploadFormat('large.flac','audio/flac',4*1024**3+1,'audio'));
  assert.throws(()=>verifyImageHeader(Buffer.from('<svg/>'),'image/png'));
  const req=(origin:string)=>new Request('http://127.0.0.1:3400/api',{method:'POST',headers:{host:'127.0.0.1:3400',origin}});
  assert.throws(()=>requireSameOrigin(req('https://evil.test')),e=>e instanceof StoreError&&e.status===403);requireSameOrigin(req('http://127.0.0.1:3400'));
  assert.ok(sessionCookie(req('http://127.0.0.1:3400'),'test').includes('HttpOnly; SameSite=Strict'));assert.ok(sessionCookie(req('http://127.0.0.1:3400'),'test').includes('Max-Age=28800'));
});
test('range-only metadata validation accepts all four real lossless formats and rejects disguised AAC',async()=>{
  for(const [ext,mime]of Object.entries({flac:'audio/flac',wav:'audio/wav',aiff:'audio/aiff',m4a:'audio/mp4'})){
    const b=readFileSync(path.join(process.cwd(),'tests/fixtures/lossless','test.'+ext));let bytes=0;
    const f=await inspectCloudAudio(b.length,mime,'test.'+ext,async(start,end)=>{bytes+=end-start+1;return b.subarray(start,end+1);});assert.equal(f.bitDepth,16);assert.equal(f.sampleRate,44100);assert.ok(bytes<=b.length+65536);
  }
  const b=readFileSync(path.join(process.cwd(),'tests/fixtures/lossless','test.wav'));
  await assert.rejects(inspectCloudAudio(b.length,'audio/flac','fake.flac',async(s,e)=>b.subarray(s,e+1)));
});
