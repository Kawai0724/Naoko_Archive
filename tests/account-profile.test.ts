import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AlbumStore,StoreError} from '../src/lib/album-store';
import {IdentityStore,hashPassword} from '../src/lib/identity-store';
const password='account-profile-test-password',nextPassword='account-profile-new-password';
function setup(t:TestContext){
 const directory=mkdtempSync(path.join(tmpdir(),'naoko-profile-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);identity.bootstrap(password);
 const admin=identity.login('fly-me-to-1980',password).user,registered=identity.register('profile_owner',password,'');identity.reviewRegistration(admin,registered.user.id,'approved',1,'');
 const owner=identity.session(registered.token)!;t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});
 return {directory,store,identity,owner,token:registered.token,admin};
}
test('profile fields migrate additively without changing existing account credentials, role or album data',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'naoko-profile-legacy-')),store=new AlbumStore(directory),hash=hashPassword(password);
 t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 store.db.exec('CREATE TABLE contributor_users(id TEXT PRIMARY KEY,username TEXT UNIQUE,password_hash TEXT,role TEXT,disabled INTEGER,created_at INTEGER)');
 store.db.prepare('INSERT INTO contributor_users VALUES(?,?,?,?,?,?)').run('old-admin','fly-me-to-1980',hash,'admin',0,123);
 const before=store.db.prepare('SELECT * FROM albums ORDER BY id').all(),identity=new IdentityStore(store.db),user=identity.login('fly-me-to-1980',password).user;
 assert.deepEqual(identity.profile(user),{username:'fly-me-to-1980',nickname:'',bio:'',role:'admin',accountStatus:'approved'});
 assert.equal((store.db.prepare('SELECT password_hash FROM contributor_users').get() as {password_hash:string}).password_hash,hash);assert.deepEqual(store.db.prepare('SELECT * FROM albums ORDER BY id').all(),before);
 new IdentityStore(store.db);assert.equal(identity.profile(user).nickname,'');
});
test('nickname and short biography persist without changing identity or sessions; approved biography appears in directory',t=>{
 const {directory,store,identity,owner,token}=setup(t),profile=identity.updateProfile(owner,'  唱片收藏者  ','喜欢收藏唱片，记录音乐与回忆。');
 assert.equal(profile.nickname,'唱片收藏者');assert.equal(profile.username,'profile_owner');assert.equal(identity.session(token)?.username,'profile_owner');assert.equal(identity.login('profile_owner',password).user.id,owner.id);
 assert.deepEqual(Object.keys(profile).sort(),['accountStatus','bio','nickname','role','username']);assert.equal(identity.publicMembers().find(m=>m.username===owner.username)?.bio,profile.bio);assert.ok(!JSON.stringify(identity.publicMembers()).includes(profile.nickname));
 const reopened=new AlbumStore(directory);try{assert.deepEqual(new IdentityStore(reopened.db).profile(owner),profile);}finally{reopened.close();}
 identity.updateProfile(owner,'','');assert.equal(identity.profile(owner).nickname,'');assert.equal((store.db.prepare('SELECT username FROM contributor_users WHERE id=?').get(owner.id) as {username:string}).username,'profile_owner');
});
test('profile validation rejects oversize, non-string and control-character input without changing stored data',t=>{
 const {identity,owner}=setup(t),before=identity.profile(owner);
 for(const [nickname,bio] of [['x'.repeat(31),''],['','x'.repeat(81)],['name\nadmin',''],['','text\0'],[null,''],['',{}]])assert.throws(()=>identity.updateProfile(owner,nickname as string,bio as string),e=>e instanceof StoreError&&e.status===400);
 assert.deepEqual(identity.profile(owner),before);assert.equal(identity.updateProfile(owner,'名'.repeat(30),'字'.repeat(80)).bio.length,80);
});
test('changing password revokes all own short and remembered sessions, preserves other accounts and survives database reopen',t=>{
 const {directory,store,identity,owner,token,admin}=setup(t),long=identity.login(owner.username,password,true),other=identity.login(admin.username,password,true);
 identity.updateProfile(owner,'My nickname','My biography');identity.changePassword(owner,password,nextPassword);
 for(const old of [token,long.token])assert.equal(identity.session(old),null);assert.equal(identity.session(other.token)?.role,'admin');assert.throws(()=>identity.login(owner.username,password),e=>e instanceof StoreError&&e.status===401);
 const fresh=identity.login(owner.username,nextPassword);assert.equal(fresh.user.id,owner.id);assert.equal(identity.profile(fresh.user).nickname,'My nickname');
 const rows=JSON.stringify(store.db.prepare('SELECT * FROM contributor_users').all())+JSON.stringify(store.db.prepare('SELECT * FROM contributor_audit').all());assert.ok(!rows.includes(password)&&!rows.includes(nextPassword));
 const reopened=new AlbumStore(directory);try{assert.equal(new IdentityStore(reopened.db).login(owner.username,nextPassword).user.role,'contributor');}finally{reopened.close();}
});
test('wrong current password, weak or reused password does not revoke sessions or change credentials',t=>{
 const {identity,owner,token}=setup(t);
 for(const [current,next] of [['incorrect-password',nextPassword],[password,'short'],[password,password]])assert.throws(()=>identity.changePassword(owner,current,next));
 assert.equal(identity.session(token)?.id,owner.id);assert.equal(identity.login(owner.username,password).user.id,owner.id);
});
test('failed password attempts are rate limited and cannot clear the rate limit through rollback',t=>{
 const {identity,owner,token}=setup(t);for(let i=0;i<10;i++)assert.throws(()=>identity.changePassword(owner,'wrong-password',nextPassword),e=>e instanceof StoreError&&e.status===401);
 assert.throws(()=>identity.changePassword(owner,password,nextPassword),e=>e instanceof StoreError&&e.status===429);assert.ok(identity.session(token));
});
test('failed password audit write rolls back credentials and session revocation atomically',t=>{
 const {store,identity,owner,token}=setup(t);store.db.exec("CREATE TRIGGER fail_password_audit BEFORE INSERT ON contributor_audit WHEN NEW.action='change-own-password' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
 assert.throws(()=>identity.changePassword(owner,password,nextPassword));assert.ok(identity.session(token));assert.equal(identity.login(owner.username,password).user.id,owner.id);assert.throws(()=>identity.login(owner.username,nextPassword));
});

test('biography counts Unicode characters and bounds legacy directory text without rewriting the account',t=>{
 const {identity,store,owner}=setup(t),emoji='🎵'.repeat(80);
 assert.equal(identity.updateProfile(owner,'',emoji).bio,emoji);
 assert.throws(()=>identity.updateProfile(owner,'',emoji+'字'),e=>e instanceof StoreError&&e.status===400);
 const legacy='字'.repeat(85);store.db.prepare('UPDATE contributor_users SET bio=? WHERE id=?').run(legacy,owner.id);
 assert.equal(identity.publicMembers().find(m=>m.username===owner.username)?.bio,'字'.repeat(80));
 assert.equal(identity.profile(owner).bio,legacy);
});
