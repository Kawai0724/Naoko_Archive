import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlbumStore,StoreError } from '../src/lib/album-store';
import { IdentityStore } from '../src/lib/identity-store';
import { ContributorStore } from '../src/lib/contributor-store';
import { AlbumRequestStore } from '../src/lib/album-request-store';
import { ContributorUploads } from '../src/lib/contributor-uploads';
import { albumDifferences } from '../src/lib/album-diff';
import { emptyAlbum,emptyEdition,emptyTrack,emptyMedia } from '../src/lib/albums';
const password='request-review-test-password';
function setup(t:TestContext){const dir=mkdtempSync(path.join(tmpdir(),'naoko-album-messages-')),store=new AlbumStore(dir),identity=new IdentityStore(store.db);identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
 const first=identity.register('first_editor',password,''),second=identity.register('second_editor',password,'');identity.reviewRegistration(admin,first.user.id,'approved',1,'');identity.reviewRegistration(admin,second.user.id,'approved',1,'');
 const a=new ContributorStore(store,identity.session(first.token)!),b=new ContributorStore(store,identity.session(second.token)!),s=new ContributorStore(store,admin);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return {dir,store,identity,a,b,s,admin};}
function input(){const album=emptyAlbum(),edition=emptyEdition(),track=emptyTrack(1);album.title='Review album';edition.editionName='First';edition.label='Old label';track.title='Original song';edition.tracks=[track];album.editions=[edition];return album;}
test('content messages persist immutable field changes, actual submitting user and provided reason; private records isolate authors',t=>{
 const {dir,store,identity,a,b,s,admin}=setup(t);let album=a.save(input(),'draft');assert.throws(()=>a.save(album,'submit',album.id,album.revision,'x'.repeat(2001)),/2000/);album=a.save(album,'submit',album.id,album.revision,'核对首版曲目');
 const request=a.requests.list(a.user)[0];assert.equal(request.username,'first_editor');assert.equal(request.reason,'核对首版曲目');assert.ok(request.changes.some(c=>c.label.includes('厂牌')&&c.after==='Old label'));assert.equal(b.requests.list(b.user).length,0);assert.throws(()=>a.requests.review(a.user,request.id,'approved',1),/管理员/);
 assert.throws(()=>s.save(album,'draft',album.id,album.revision),/正在审核/);assert.throws(()=>new ContributorUploads(s).create({albumId:album.id,editionId:album.editions[0].id,expectedRevision:album.revision,name:'a.png',mimeType:'image/png',size:100,kind:'cover'}),/正在审核/);
 const second=new AlbumStore(dir),other=new AlbumRequestStore(second);assert.equal(other.list(admin)[0].reason,'核对首版曲目');second.close();
 album=s.requests.review(admin,request.id,'approved',1,'来源清楚').album;assert.equal(store.publishedRaw(album.id)?.title,'Review album');assert.equal(a.requests.list(a.user)[0].status,'approved');assert.equal(a.requests.list(a.user)[0].reviewer_username,'fly-me-to-1980');assert.throws(()=>s.requests.review(admin,request.id,'approved',1),e=>e instanceof StoreError&&e.status===409);
 identity.requestAdmin(b.user,'参与审核',0);identity.reviewAdminApplication(admin,b.user.id,'approved',1,'');const editor=new ContributorStore(store,identity.login('second_editor',password).user);
 const next=structuredClone(album);next.title='Corrected album';next.editions[0].label='Verified label';next.editions[0].tracks[0].composers=[{id:'composer',name:'Named composer'}];album=editor.save(next,'submit',album.id,album.revision,'核对原版唱片内页');
 const change=editor.requests.pending(album.id)!;assert.equal(change.username,'second_editor');assert.equal(album.contributor,'first_editor');assert.ok(change.changes.some(c=>c.label==='名称'&&c.before==='Review album'&&c.after==='Corrected album'));assert.ok(change.changes.some(c=>c.label.includes('作曲')&&c.after.includes('Named composer')));assert.equal(store.publishedRaw(album.id)?.title,'Review album');
 s.requests.review(admin,change.id,'rejected',1,'请补充出处');assert.equal(editor.requests.list(editor.user).find(r=>r.id===change.id)?.admin_note,'请补充出处');assert.equal(store.publishedRaw(album.id)?.title,'Review album');
});
test('delete requests allow empty reasons and require ownership and exact revisions; neither admin nor contributor can bypass review or duplicate requests',t=>{
 const {a,b,s,store,admin}=setup(t);let album=a.save(input(),'submit',undefined,0,'新增唱片');album=s.transition(album.id,'approve',album.revision);
 assert.throws(()=>a.requests.requestDelete(a.user,album.id,album.revision,'x'.repeat(2001)),/2000/);assert.throws(()=>b.requests.requestDelete(b.user,album.id,album.revision,'他人的资料'),e=>e instanceof StoreError&&e.status===404);assert.throws(()=>s.transition(album.id,'delete',album.revision),/提交审核/);
 const request=a.requests.requestDelete(a.user,album.id,album.revision,'');assert.equal(request.reason,'');assert.equal(store.get(album.id)?.deletedAt,null);assert.ok(store.publishedRaw(album.id));assert.equal(a.requests.pending(album.id)?.kind,'delete');assert.throws(()=>s.requests.requestDelete(admin,album.id,album.revision,'重复申请'),e=>e instanceof StoreError&&e.status===409);assert.throws(()=>s.save(album,'draft',album.id,album.revision),/正在审核/);
 const denied=s.requests.review(admin,request.id,'rejected',1,'这是不同发行版本');assert.equal(denied.album.deletedAt,null);assert.ok(store.publishedRaw(album.id));assert.equal(a.requests.pending(album.id),null);
 const another=s.requests.requestDelete(admin,album.id,album.revision,'管理员确认重复收录');assert.ok(store.publishedRaw(album.id));album=s.requests.review(admin,another.id,'approved',1).album;assert.ok(album.deletedAt);assert.equal(store.publishedRaw(album.id),null);assert.equal(s.requests.list(admin).filter(r=>r.kind==='delete').length,2);
});
test('approval rejects stale content and deletion snapshots; rejection releases requests without publishing newer drafts',t=>{
 const {a,s,admin,store}=setup(t);let album=a.save(input(),'submit',undefined,0,'新增');let request=a.requests.pending(album.id)!;
 const newer=store.save({...album,title:'Concurrent maintenance'},'draft',album.id,album.revision);assert.throws(()=>s.requests.review(admin,request.id,'approved',1),e=>e instanceof StoreError&&e.status===409);assert.equal(store.publishedRaw(album.id),null);s.requests.review(admin,request.id,'rejected',1,'资料已有更新');assert.equal(store.get(album.id)?.title,newer.title);
 album=a.save(newer,'submit',newer.id,newer.revision,'基于最新资料重提');request=a.requests.pending(album.id)!;album=s.requests.review(admin,request.id,'approved',1).album;
 const deletion=a.requests.requestDelete(a.user,album.id,album.revision,'重复');store.save({...album,description:'New metadata'},'draft',album.id,album.revision);assert.throws(()=>s.requests.review(admin,deletion.id,'approved',1),e=>e instanceof StoreError&&e.status===409);s.requests.review(admin,deletion.id,'rejected',1,'重新核对');assert.ok(store.publishedRaw(album.id));assert.equal(store.get(album.id)?.deletedAt,null);
});
test('request review, album mutation and audit roll back together on a failed review write',t=>{
 const {a,s,store,admin}=setup(t);let album=a.save(input(),'submit',undefined,0,'新增');album=s.transition(album.id,'approve',album.revision);const request=a.requests.requestDelete(a.user,album.id,album.revision,'重复');const before=store.db.prepare('SELECT * FROM albums WHERE id=?').get(album.id),count=store.revisions(album.id).length;
 store.db.exec("CREATE TRIGGER fail_album_request_review BEFORE UPDATE ON album_change_requests BEGIN SELECT RAISE(ABORT,'test failure'); END;");assert.throws(()=>s.requests.review(admin,request.id,'approved',1),/test failure/);assert.deepEqual(store.db.prepare('SELECT * FROM albums WHERE id=?').get(album.id),before);assert.equal(store.revisions(album.id).length,count);assert.equal(a.requests.pending(album.id)?.status,'pending');assert.ok(store.publishedRaw(album.id));
});
test('legacy pending submissions migrate once without changing album data or inventing a reason; empty reasons remain reviewable',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'naoko-legacy-review-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
 const old=store.get('legacy-scarlet')!,pending=store.save({...old,title:'Legacy pending change'},'submit',old.id,old.revision);identity.audit(admin,'submit',pending.id);const before=store.db.prepare('SELECT * FROM albums ORDER BY id').all();
 const requests=new AlbumRequestStore(store),message=requests.pending(pending.id)!;assert.equal(message.legacy,1);assert.equal(message.reason,'');assert.equal(message.username,admin.username);assert.deepEqual(store.db.prepare('SELECT * FROM albums ORDER BY id').all(),before);requests.review(admin,message.id,'approved',1);assert.equal(requests.list(admin)[0].status,'approved');new AlbumRequestStore(store);assert.equal(requests.list(admin).length,1);store.close();rmSync(directory,{recursive:true,force:true});
});
test('detailed diff covers version and track additions, removals, ordering, credits, lyrics and same-name file replacement',()=>{
 const before=input(),after=structuredClone(before);after.description='Corrected introduction';after.editions[0].tracks[0].lyricsText='Updated lyrics';after.editions[0].tracks[0].arrangers=[{id:'person',name:'Arranger'}];const second=emptyEdition();second.editionName='Second';after.editions.unshift(second);
 const media={...emptyMedia(''),id:'media',albumId:'',type:'cover' as const,displayName:'same.png',relatedEditionId:before.editions[0].id,relatedTrackId:null,storageKey:'old',rightsStatus:'private' as const,publicationConfirmed:false,source:null};before.media=[media];after.media=[{...media,storageKey:'new'}];
 const changes=albumDifferences(before,after);assert.ok(changes.some(c=>c.label.includes('介绍')));assert.ok(changes.some(c=>c.label.includes('歌词')&&c.after==='Updated lyrics'));assert.ok(changes.some(c=>c.label.includes('编曲')&&c.after.includes('Arranger')));assert.ok(changes.some(c=>c.label.includes('Second')));assert.ok(changes.some(c=>c.label.includes('文件替换')));assert.ok(!JSON.stringify(changes).includes('storageKey'));
});

test('omitted or whitespace-only reasons persist as empty strings and remain manually approvable',t=>{
 const {dir,store,a,s,admin}=setup(t);
 for(const reason of [undefined,' \n  ']){
  const album=a.save(input(),'submit',undefined,0,reason),request=a.requests.pending(album.id)!;
  assert.equal(request.reason,'');assert.equal(request.status,'pending');assert.equal(store.publishedRaw(album.id),null);
  const reopened=new AlbumStore(dir),requests=new AlbumRequestStore(reopened);assert.equal(requests.pending(album.id)?.reason,'');reopened.close();
  assert.equal(s.requests.review(admin,request.id,'approved',1).request.status,'approved');assert.ok(store.publishedRaw(album.id));
 }
 assert.throws(()=>s.requests.validateReason({reason:'invalid'}),/2000/);
});
