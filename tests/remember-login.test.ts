import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AlbumStore} from '../src/lib/album-store';
import {IdentityStore,SESSION_SECONDS,REMEMBER_SESSION_SECONDS} from '../src/lib/identity-store';
import {sessionCookie} from '../src/lib/contributor-auth';
import {ContributorStore} from '../src/lib/contributor-store';
const password='remember-login-test-password';
function setup(t:TestContext){
 const directory=mkdtempSync(path.join(tmpdir(),'naoko-remember-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);identity.bootstrap(password);
 t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});
 return {directory,store,identity};
}
test('remembered login persists for 30 days across database reopen; ordinary login still expires after eight hours',t=>{
 const {directory,store,identity}=setup(t);let now=Date.now();t.mock.method(Date,'now',()=>now);
 const short=identity.login('fly-me-to-1980',password),long=identity.login('fly-me-to-1980',password,true);
 assert.equal(short.maxAge,SESSION_SECONDS);assert.equal(long.maxAge,REMEMBER_SESSION_SECONDS);
 const rows=store.db.prepare('SELECT token_hash,expires_at FROM contributor_sessions ORDER BY expires_at').all() as {token_hash:string;expires_at:number}[];
 assert.deepEqual(rows.map(r=>r.expires_at),[now+8*3600*1000,now+30*86400*1000]);
 assert.ok(!JSON.stringify(rows).includes(short.token)&&!JSON.stringify(rows).includes(long.token));
 now+=9*3600*1000;assert.equal(identity.session(short.token),null);assert.equal(identity.session(long.token)?.role,'admin');
 store.close();const reopened=new AlbumStore(directory);t.after(()=>reopened.close());const next=new IdentityStore(reopened.db);
 assert.equal(next.session(long.token)?.username,'fly-me-to-1980');now=rows[1].expires_at;assert.equal(next.session(long.token),null);
});
test('persistent Cookie lifetime matches server expiry, retains security flags and is cleared on logout',t=>{
 const {identity}=setup(t),result=identity.login('fly-me-to-1980',password,true),req=new Request('https://archive.example/contributor',{headers:{Host:'archive.example'}});
 const previous=process.env.CONTRIBUTOR_SECURE_COOKIES;delete process.env.CONTRIBUTOR_SECURE_COOKIES;t.after(()=>{if(previous===undefined)delete process.env.CONTRIBUTOR_SECURE_COOKIES;else process.env.CONTRIBUTOR_SECURE_COOKIES=previous;});
 const cookie=sessionCookie(req,result.token,result.maxAge);assert.ok(cookie.includes('Max-Age=2592000'));assert.ok(cookie.includes('HttpOnly; SameSite=Strict'));assert.ok(cookie.includes('; Secure'));assert.ok(cookie.includes('Path=/'));
 assert.ok(sessionCookie(req,'',0).includes('Max-Age=0'));identity.logout(result.token);assert.equal(identity.session(result.token),null);
});
test('remembered sessions cannot bypass approval and are revoked by disablement and self closure',t=>{
 const {identity,store}=setup(t),admin=identity.login('fly-me-to-1980',password).user,registered=identity.register('remember_fan',password,'');
 const pending=identity.login('remember_fan',password,true);assert.equal(identity.session(pending.token)?.accountStatus,'pending');assert.throws(()=>new ContributorStore(store,identity.session(pending.token)!));
 identity.reviewRegistration(admin,registered.user.id,'approved',1,'');assert.equal(identity.session(pending.token)?.accountStatus,'approved');
 identity.disable(admin,registered.user.id,true);assert.equal(identity.session(pending.token),null);identity.disable(admin,registered.user.id,false);
 const first=identity.login('remember_fan',password,true),second=identity.login('remember_fan',password,true);identity.logout(first.token);assert.equal(identity.session(first.token),null);assert.ok(identity.session(second.token));
 identity.closeOwnAccount(second.user,password,second.user.username);assert.equal(identity.session(second.token),null);
});
