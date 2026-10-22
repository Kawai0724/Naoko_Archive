// Run only against the disposable test server on port 3416 with the test password below.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const base='http://127.0.0.1:3416',password='member-http-test-password',checks=[];
async function request(path,{method='GET',body,cookie='',expected=200,raw=false,origin=base}={}){
 const headers={};if(cookie)headers.Cookie=cookie;if(method!=='GET'){headers.Origin=origin;headers['Content-Type']='application/json';}
 const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});assert.equal(r.status,expected,method+' '+path);return raw?r:r.json();
}
async function login(username){const r=await request('/api/contributor/auth/login',{method:'POST',body:{username,password},raw:true});return r.headers.get('set-cookie').split(';')[0];}
const admin=await login('fly-me-to-1980');
async function member(name){const username=name+'_'+randomUUID().slice(0,6),r=await request('/api/contributor/auth/register',{method:'POST',body:{username,password},expected:201,raw:true}),cookie=r.headers.get('set-cookie').split(';')[0],user=(await r.json()).user;await request('/api/contributor/requests',{method:'POST',cookie:admin,body:{action:'registration',id:user.id,decision:'approved',expectedRevision:1}});return {username,cookie,id:user.id};}
await request('/api/contributor/members',{expected:401});let html=await (await request('/members',{raw:true})).text();assert.ok(html.includes('社区成员'));assert.ok(!html.includes('成员工作台')&&!html.includes('申请成为管理员'));await request('/contributor/members',{raw:true,expected:307});
const alice=await member('member'),other=await member('other');
let data=await request('/api/contributor/members',{cookie:alice.cookie});assert.ok(data.members.some(m=>m.username===alice.username));assert.ok(!data.users&&!data.invites);for(const m of data.members)assert.deepEqual(Object.keys(m).sort(),['bio','created_at','role','username']);
await request('/api/contributor/admin',{cookie:alice.cookie,expected:403});const oldMembers=await request('/contributor/members',{cookie:alice.cookie,raw:true,expected:307});assert.equal(oldMembers.headers.get('location'),'/members');html=await (await request('/contributor/account',{cookie:alice.cookie,raw:true})).text();assert.ok(html.includes('申请成为管理员'));assert.ok(!html.includes('注销用户'));checks.push('public directory is read-only; administrator application is on the personal account page');
await request('/api/contributor/members',{method:'POST',cookie:alice.cookie,body:{action:'apply-admin',reason:'希望参与审核',expectedRevision:0,role:'admin'},expected:201});
await request('/api/contributor/admin',{cookie:alice.cookie,expected:403});data=await request('/api/contributor/members',{cookie:alice.cookie});assert.equal(data.application.status,'pending');assert.equal((await request('/api/contributor/members',{cookie:other.cookie})).application,null);
await request('/api/contributor/members',{method:'POST',cookie:alice.cookie,body:{action:'apply-admin',reason:'重复申请',expectedRevision:1},expected:409});
await request('/api/contributor/requests',{method:'POST',cookie:alice.cookie,body:{action:'review-admin-application',id:alice.id,decision:'approved',expectedRevision:1},expected:403});
let queue=await request('/api/contributor/requests',{cookie:admin});assert.equal(queue.adminApplications.find(r=>r.user_id===alice.id).reason,'希望参与审核');checks.push('member application persists, is private to author, cannot self-approve or spoof role, and appears in administrator queue');
await request('/api/contributor/requests',{method:'POST',cookie:admin,body:{action:'review-admin-application',id:alice.id,decision:'rejected',expectedRevision:1,note:'补充说明'}});
await request('/api/contributor/members',{method:'POST',cookie:alice.cookie,body:{action:'apply-admin',reason:'我将核实版本与曲目来源',expectedRevision:2},expected:201});
await request('/api/contributor/requests',{method:'POST',cookie:admin,body:{action:'review-admin-application',id:alice.id,decision:'approved',expectedRevision:3}});
await request('/api/contributor/admin',{cookie:alice.cookie});html=await (await request('/contributor/admin',{cookie:alice.cookie,raw:true})).text();assert.ok(html.includes('管理员申请'));await request('/api/contributor/requests',{method:'POST',cookie:admin,body:{action:'review-admin-application',id:alice.id,decision:'approved',expectedRevision:3},expected:409});checks.push('reject, resubmit and approve update role immediately in existing session; duplicate review fails');
const draft=(await request('/api/contributor/albums',{method:'POST',cookie:other.cookie,body:{action:'draft',album:{title:'Preserved cancelled author',artist:'河合奈保子'}},expected:201})).album;
await request('/api/contributor/admin',{method:'POST',cookie:other.cookie,body:{action:'disable',id:alice.id,disabled:true},expected:403});
await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'close-user',id:other.id,confirmation:other.username},expected:400});
await request('/api/contributor/account',{method:'DELETE',body:{password,confirmation:other.username},expected:401});
await request('/api/contributor/account',{method:'DELETE',cookie:admin,body:{id:other.id,password,confirmation:other.username},expected:403});
await request('/api/contributor/account',{method:'DELETE',cookie:other.cookie,body:{password,confirmation:'wrong'},expected:400});
await request('/api/contributor/account',{method:'DELETE',cookie:other.cookie,body:{password:'wrong-password',confirmation:other.username},expected:401});
await request('/api/contributor/account',{method:'DELETE',cookie:other.cookie,origin:'https://evil.test',body:{password,confirmation:other.username},expected:403});
const otherSession=await login(other.username);
const closed=await request('/api/contributor/account',{method:'DELETE',cookie:other.cookie,body:{password,confirmation:other.username},raw:true});assert.ok(closed.headers.get('set-cookie').includes('Max-Age=0'));
for(const cookie of [other.cookie,otherSession])await request('/api/contributor/members',{cookie,expected:401});
await request('/api/contributor/uploads',{method:'POST',cookie:other.cookie,body:{},expected:401});await request('/api/contributor/auth/login',{method:'POST',body:{username:other.username,password},expected:401});
assert.equal((await request('/api/contributor/albums/'+draft.id,{cookie:admin})).album.title,'Preserved cancelled author');html=await (await request('/members',{raw:true})).text();assert.ok(!html.includes(other.username));
await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'disable',id:other.id,disabled:false},expected:409});checks.push('self closure requires password and exact username, rejects foreign targets, clears cookie and all sessions, blocks upload and preserves historical album');
const paused=await member('paused_member');await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'disable',id:paused.id,disabled:true}});
await request('/api/contributor/members',{cookie:paused.cookie,expected:401});await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'disable',id:paused.id,disabled:false}});await login(paused.username);checks.push('administrator disable is reversible, never closes an account, and is forbidden to contributors');
const pendingName='pending_'+randomUUID().slice(0,6),pendingResponse=await request('/api/contributor/auth/register',{method:'POST',body:{username:pendingName,password},expected:201,raw:true}),pendingCookie=pendingResponse.headers.get('set-cookie').split(';')[0];
await request('/contributor/account',{cookie:pendingCookie,raw:true});await request('/api/contributor/account',{method:'DELETE',cookie:pendingCookie,body:{password,confirmation:pendingName}});await request('/api/contributor/requests',{cookie:pendingCookie,expected:401});checks.push('pending applicants may close their own account without acquiring editing rights');
html=await (await request('/contributor/members',{cookie:admin,raw:true})).text();assert.ok(!html.includes('注销用户'));assert.ok(html.includes('停用'));assert.ok(html.includes('/contributor/account'));
html=await (await request('/members',{raw:true})).text();assert.ok(html.includes('href="/members"'));checks.push('administrator UI has no account closure control, account settings belongs to current user and member directory is linked from public header');
// Leave clearly named disposable fixtures for browser checks; never used in production.
const preview=await member('browser_member');await request('/api/contributor/members',{method:'POST',cookie:preview.cookie,body:{action:'apply-admin',reason:'希望参与资料审核与维护',expectedRevision:0},expected:201});
const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks,browserFixture:preview.username};await writeFile(new URL('../docs/member-governance-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
