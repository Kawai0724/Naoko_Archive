import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlbumStore,StoreError } from '../src/lib/album-store';
import { IdentityStore,hashPassword } from '../src/lib/identity-store';
import { ContributorStore } from '../src/lib/contributor-store';
import { ChangeRequestStore } from '../src/lib/change-request-store';
import { emptyAlbum } from '../src/lib/albums';
const password='test-only-approval-password';
function setup(t:TestContext){const directory=mkdtempSync(path.join(tmpdir(),'naoko-registration-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});return {directory,store,identity,admin};}
test('registration is pending, password-hashed and persists; no account can self-approve or create drafts before approval',t=>{
  const {store,identity,admin,directory}=setup(t),result=identity.register('new_fan',password,'希望整理唱片资料');
  assert.equal(result.user.role,'contributor');assert.equal(result.user.accountStatus,'pending');assert.equal(identity.session(result.token)?.accountStatus,'pending');
  assert.throws(()=>new ContributorStore(store,result.user),e=>e instanceof StoreError&&e.status===401);
  assert.throws(()=>identity.reviewRegistration(result.user,result.user.id,'approved',1,''),/仅管理员/);
  assert.throws(()=>identity.registrationQueue(result.user),/仅管理员/);
  assert.equal(identity.registrationQueue(admin)[0].reason,'希望整理唱片资料');assert.ok(!JSON.stringify(identity.registrationQueue(admin)).includes(password));
  const second=new AlbumStore(directory),other=new IdentityStore(second.db);assert.equal(other.session(result.token)?.accountStatus,'pending');assert.equal(other.application(result.user)?.status,'pending');second.close();
  identity.reviewRegistration(admin,result.user.id,'approved',1,'欢迎加入');
  const approved=identity.session(result.token)!;assert.equal(approved.accountStatus,'approved');const album=new ContributorStore(store,approved).save({...emptyAlbum(),title:'New fan album'},'draft');assert.equal(album.contributor,'new_fan');
  assert.throws(()=>identity.reviewRegistration(admin,result.user.id,'rejected',1,''),e=>e instanceof StoreError&&e.status===409);
});
test('rejected accounts can sign in only to check their own application and resubmit with an optimistic revision',t=>{
  const {store,identity,admin}=setup(t),a=identity.register('rejected_fan',password,'initial'),b=identity.register('other_fan',password,'private request');
  identity.reviewRegistration(admin,a.user.id,'rejected',1,'请补充资料范围');
  assert.equal(identity.session(a.token)?.accountStatus,'rejected');assert.equal(identity.login('rejected_fan',password).user.accountStatus,'rejected');assert.throws(()=>new ContributorStore(store,a.user));
  assert.equal(identity.application(a.user)?.admin_note,'请补充资料范围');assert.equal(identity.application(b.user)?.reason,'private request');
  identity.resubmitRegistration(a.user,'我希望补充 Scarlet 版本',2);assert.equal(identity.session(a.token)?.accountStatus,'pending');assert.equal(identity.application(a.user)?.revision,3);assert.throws(()=>identity.resubmitRegistration(a.user,'stale',2));
  assert.throws(()=>identity.reviewRegistration(admin,a.user.id,'approved',1,''),e=>e instanceof StoreError&&e.status===409);identity.reviewRegistration(admin,a.user.id,'approved',3,'');assert.equal(identity.session(a.token)?.accountStatus,'approved');
});
test('invited accounts also require approval; duplicate usernames and weak or malformed registration are rejected',t=>{
  const {store,identity,admin}=setup(t),inv=identity.invite(admin),u=identity.accept(inv.token,'invited_fan',password);
  assert.equal(u.user.accountStatus,'pending');assert.throws(()=>new ContributorStore(store,u.user));assert.equal(identity.application(u.user)?.status,'pending');
  assert.throws(()=>identity.register('INVITED_FAN',password,''),e=>e instanceof StoreError&&e.status===409);assert.throws(()=>identity.register('bad username',password,''));assert.throws(()=>identity.register('weak_password','short',''));assert.throws(()=>identity.register('fly-me-to-1980',password,''));
  identity.reviewRegistration(admin,u.user.id,'approved',1,'');identity.disable(admin,u.user.id,true);assert.equal(identity.session(u.token),null);assert.throws(()=>identity.login('invited_fan',password));
});
test('migrating existing accounts preserves approval, credentials and all album snapshots',t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'naoko-legacy-user-')),store=new AlbumStore(directory);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  store.db.exec('CREATE TABLE contributor_users(id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)');
  store.db.prepare('INSERT INTO contributor_users VALUES(?,?,?,?,?,?)').run('old-admin','fly-me-to-1980',hashPassword(password),'admin',0,Date.now());store.db.prepare('INSERT INTO contributor_users VALUES(?,?,?,?,?,?)').run('old-user','established_fan',hashPassword(password),'contributor',0,Date.now());
  const before=store.db.prepare('SELECT working_json,published_json FROM albums ORDER BY id').all();
  const identity=new IdentityStore(store.db);identity.bootstrap(password);assert.equal(identity.login('established_fan',password).user.accountStatus,'approved');assert.equal(identity.login('fly-me-to-1980',password).user.role,'admin');
  assert.deepEqual(store.db.prepare('SELECT working_json,published_json FROM albums ORDER BY id').all(),before);assert.equal(identity.registrationQueue(identity.login('fly-me-to-1980',password).user).length,0);
});
test('website changes require administrator approval, isolate authors, restrict editable fields and reject stale approvals',t=>{
  const {store,identity,admin}=setup(t),a=identity.register('site_editor',password,''),b=identity.register('second_editor',password,'');identity.reviewRegistration(admin,a.user.id,'approved',1,'');identity.reviewRegistration(admin,b.user.id,'approved',1,'');
  const changes=new ChangeRequestStore(store),before=changes.content();
  const first=changes.submit(a.user,'aboutIntro','Proposed about text','fact correction',0),second=changes.submit(b.user,'aboutIntro','Another proposed text','',0);
  assert.equal(changes.content().aboutIntro.value,before.aboutIntro.value);assert.equal(changes.list(a.user).length,1);assert.equal(changes.list(b.user).length,1);assert.equal(changes.list(admin).length,2);
  assert.throws(()=>changes.review(a.user,first,'approved',1,''),/仅管理员/);assert.throws(()=>changes.submit(a.user,'COS_SECRET_KEY' as 'aboutIntro','bad','',0));
  changes.review(admin,first,'approved',1,'通过');assert.equal(changes.content().aboutIntro.value,'Proposed about text');assert.equal(changes.content().aboutIntro.revision,1);
  assert.throws(()=>changes.review(admin,first,'approved',1,''),e=>e instanceof StoreError&&e.status===409);
  assert.throws(()=>changes.review(admin,second,'approved',1,''),e=>e instanceof StoreError&&e.status===409);assert.equal(changes.content().aboutIntro.value,'Proposed about text');changes.review(admin,second,'rejected',1,'请基于新版本重提');
  const third=changes.submit(b.user,'contributionGuidelines','Proposed guidelines','',0);changes.review(admin,third,'rejected',1,'保留原规则');assert.equal(changes.content().contributionGuidelines.value,before.contributionGuidelines.value);
  const pending=identity.register('not_yet_approved',password,'');assert.throws(()=>changes.submit(pending.user,'aboutIntro','not allowed','',1),e=>e instanceof StoreError&&e.status===403);
});
