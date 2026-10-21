import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlbumStore,StoreError } from '../src/lib/album-store';
import { IdentityStore } from '../src/lib/identity-store';
import { ContributorStore } from '../src/lib/contributor-store';
import { emptyAlbum } from '../src/lib/albums';
const password='member-governance-test-password';
function setup(t:TestContext){
  const directory=mkdtempSync(path.join(tmpdir(),'naoko-members-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
  function approved(name:string){const result=identity.register(name,password,'');identity.reviewRegistration(admin,result.user.id,'approved',1,'');return {...result,user:identity.session(result.token)!};}
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});return {directory,store,identity,admin,approved};
}
test('member directory exposes only approved active names, roles and join dates, with no account internals',t=>{
  const {identity,admin,approved}=setup(t);approved('visible_member');identity.register('pending_private',password,'secret application');const blocked=approved('disabled_member');identity.disable(admin,blocked.user.id,true);const closed=approved('closed_member');identity.closeAccount(admin,closed.user.id,'closed_member');
  const members=identity.publicMembers();assert.deepEqual(members.map(m=>m.username),['fly-me-to-1980','visible_member']);
  for(const row of members)assert.deepEqual(Object.keys(row).sort(),['created_at','role','username']);assert.equal(members[0].role,'admin');assert.equal(Object.getPrototypeOf(members[0]),Object.prototype);
});
test('admin applications require active approved membership and cannot be forged, duplicated or self-approved',t=>{
  const {identity,admin,approved}=setup(t),a=approved('applicant_one'),pending=identity.register('pending_fan',password,'');
  assert.throws(()=>identity.requestAdmin(pending.user,'申请',0),/无权/);assert.throws(()=>identity.requestAdmin(admin,'申请',0),/已经是管理员/);
  assert.throws(()=>identity.requestAdmin(a.user,'',0));assert.throws(()=>identity.requestAdmin(a.user,'x'.repeat(2001),0));
  identity.requestAdmin(a.user,'希望帮助核实资料',0);assert.equal(identity.adminApplication(a.user)?.status,'pending');assert.equal(identity.session(a.token)?.role,'contributor');
  assert.throws(()=>identity.requestAdmin(a.user,'重复',1),e=>e instanceof StoreError&&e.status===409);
  assert.throws(()=>identity.reviewAdminApplication(a.user,a.user.id,'approved',1,''),/仅管理员/);
  assert.throws(()=>identity.reviewAdminApplication({...a.user,role:'admin'},a.user.id,'approved',1,''),/仅管理员/);
  assert.throws(()=>identity.adminApplications(a.user),/仅管理员/);
  assert.equal(identity.adminApplication(admin),null);assert.equal(identity.adminApplications(admin).length,1);assert.equal(Object.getPrototypeOf(identity.adminApplication(a.user)),Object.prototype);assert.equal(Object.getPrototypeOf(identity.adminApplications(admin)[0]),Object.prototype);
});
test('reject and resubmit use revisions; approval atomically updates role, audit and existing sessions and persists',t=>{
  const {identity,store,directory,admin,approved}=setup(t),a=approved('future_admin');identity.requestAdmin(a.user,'First',0);
  identity.reviewAdminApplication(admin,a.user.id,'rejected',1,'请补充');assert.equal(identity.session(a.token)?.role,'contributor');assert.equal(identity.adminApplication(a.user)?.admin_note,'请补充');
  assert.throws(()=>identity.requestAdmin(a.user,'stale',1),e=>e instanceof StoreError&&e.status===409);identity.requestAdmin(a.user,'Second',2);
  assert.throws(()=>identity.reviewAdminApplication(admin,a.user.id,'approved',1,''),e=>e instanceof StoreError&&e.status===409);
  identity.reviewAdminApplication(admin,a.user.id,'approved',3,'欢迎参与管理');const promoted=identity.session(a.token)!;assert.equal(promoted.role,'admin');identity.requireAdmin(promoted);
  assert.equal(identity.adminApplication(promoted)?.revision,4);assert.equal(identity.adminApplication(promoted)?.status,'approved');
  assert.throws(()=>identity.reviewAdminApplication(admin,a.user.id,'approved',3,''),e=>e instanceof StoreError&&e.status===409);assert.throws(()=>identity.requestAdmin(promoted,'再申请',4),/已经是管理员/);
  const reopened=new AlbumStore(directory),other=new IdentityStore(reopened.db);assert.equal(other.session(a.token)?.role,'admin');assert.equal(other.adminApplication(promoted)?.status,'approved');reopened.close();
  assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM contributor_audit WHERE action='admin-application-approved' AND target=?").get(a.user.id) as {count:number}).count,1);
});
test('closing account invalidates every session, keeps albums and ownership and prevents reactivation or username reuse',t=>{
  const {identity,store,admin,approved}=setup(t),a=approved('archived_author'),second=identity.login('archived_author',password);
  const album=new ContributorStore(store,a.user).save({...emptyAlbum(),title:'Preserve historical contribution'},'draft');const before=store.db.prepare('SELECT working_json,published_json FROM albums WHERE id=?').get(album.id);
  identity.requestAdmin(a.user,'申请管理',0);identity.closeAccount(admin,a.user.id,'archived_author');
  assert.equal(identity.session(a.token),null);assert.equal(identity.session(second.token),null);assert.throws(()=>identity.login('archived_author',password),/不正确/);
  assert.throws(()=>new ContributorStore(store,a.user));assert.throws(()=>identity.disable(admin,a.user.id,false),/已注销/);assert.throws(()=>identity.register('archived_author',password,''),/已被使用/);
  assert.throws(()=>identity.closeAccount(admin,a.user.id,'archived_author'),e=>e instanceof StoreError&&e.status===409);
  assert.deepEqual(store.db.prepare('SELECT working_json,published_json FROM albums WHERE id=?').get(album.id),before);assert.equal(identity.owner(album.id),a.user.id);
  assert.equal(identity.adminApplications(admin).find(r=>r.user_id===a.user.id)?.status,'rejected');assert.throws(()=>identity.reviewAdminApplication(admin,a.user.id,'approved',1,''));
  assert.ok(!identity.publicMembers().some(m=>m.username==='archived_author'));assert.ok(identity.adminData(admin).users.find(u=>u.id===a.user.id)?.closed_at);
});
test('only real administrators may close accounts; typed confirmation, self and last-admin safeguards leave data unchanged',t=>{
  const {identity,store,admin,approved}=setup(t),a=approved('ordinary_member');
  assert.throws(()=>identity.closeAccount(a.user,admin.id,'fly-me-to-1980'),/仅管理员/);assert.throws(()=>identity.closeAccount({...a.user,role:'admin'},admin.id,'fly-me-to-1980'),/仅管理员/);
  assert.throws(()=>identity.closeAccount(admin,a.user.id,'wrong-user'),/正确的用户名/);assert.equal(identity.session(a.token)?.username,'ordinary_member');
  assert.throws(()=>identity.closeAccount(admin,admin.id,admin.username),/最后一位管理员/);
  identity.requestAdmin(a.user,'help',0);identity.reviewAdminApplication(admin,a.user.id,'approved',1,'');const second=identity.session(a.token)!;
  assert.throws(()=>identity.closeAccount(second,second.id,second.username),/自己的账号/);
  const unused=identity.invite(second);identity.closeAccount(admin,second.id,second.username);
  assert.throws(()=>identity.accept(unused.token,'revoked_invitee',password),/邀请无效/);assert.throws(()=>identity.requireAdmin(second),/仅管理员/);
  assert.equal(identity.publicMembers().filter(m=>m.role==='admin').length,1);
  assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM contributor_audit WHERE action='close-account'").get() as {count:number}).count,1);
});
test('disabled applicants cannot gain admin rights and closed registration applications cannot be revived',t=>{
  const {identity,admin,approved}=setup(t),a=approved('paused_applicant');identity.requestAdmin(a.user,'help',0);identity.disable(admin,a.user.id,true);
  assert.throws(()=>identity.reviewAdminApplication(admin,a.user.id,'approved',1,''),/不允许升级/);identity.disable(admin,a.user.id,false);identity.reviewAdminApplication(admin,a.user.id,'approved',1,'');
  const pending=identity.register('closed_pending',password,'');identity.closeAccount(admin,pending.user.id,'closed_pending');assert.throws(()=>identity.reviewRegistration(admin,pending.user.id,'approved',1,''),/已停用或注销/);assert.equal(identity.application(pending.user)?.status,'rejected');
});
