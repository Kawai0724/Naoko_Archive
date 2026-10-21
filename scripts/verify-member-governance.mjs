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
await request('/api/contributor/members',{expected:401});let html=await (await request('/members',{raw:true})).text();assert.ok(html.includes('社区成员'));await request('/contributor/members',{raw:true,expected:307});
const alice=await member('member'),other=await member('other');
let data=await request('/api/contributor/members',{cookie:alice.cookie});assert.ok(data.members.some(m=>m.username===alice.username));assert.ok(!data.users&&!data.invites);for(const m of data.members)assert.deepEqual(Object.keys(m).sort(),['created_at','role','username']);
await request('/api/contributor/admin',{cookie:alice.cookie,expected:403});html=await (await request('/contributor/members',{cookie:alice.cookie,raw:true})).text();assert.ok(html.includes('申请成为管理员'));assert.ok(!html.includes('注销用户'));checks.push('public directory and approved member page show names and roles without account internals or administrator actions');
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
await request('/api/contributor/admin',{method:'POST',cookie:other.cookie,body:{action:'close-user',id:alice.id,confirmation:alice.username},expected:403});
await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'close-user',id:other.id,confirmation:'wrong'},expected:400});
await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'close-user',id:(await request('/api/contributor/admin',{cookie:admin})).users.find(u=>u.username==='fly-me-to-1980').id,confirmation:'fly-me-to-1980'},expected:403});
await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'close-user',id:other.id,confirmation:other.username}});
await request('/api/contributor/members',{cookie:other.cookie,expected:401});await request('/api/contributor/uploads',{method:'POST',cookie:other.cookie,body:{},expected:401});await request('/api/contributor/auth/login',{method:'POST',body:{username:other.username,password},expected:401});
assert.equal((await request('/api/contributor/albums/'+draft.id,{cookie:admin})).album.title,'Preserved cancelled author');html=await (await request('/members',{raw:true})).text();assert.ok(!html.includes(other.username));
await request('/api/contributor/admin',{method:'POST',cookie:admin,body:{action:'disable',id:other.id,disabled:false},expected:409});checks.push('typed account closure blocks login, existing sessions and upload; hides closed user and retains original album');
await request('/api/contributor/admin',{method:'POST',cookie:admin,origin:'https://evil.test',body:{action:'close-user',id:alice.id,confirmation:alice.username},expected:403});await request('/api/contributor/members',{method:'POST',cookie:alice.cookie,origin:'https://evil.test',body:{action:'apply-admin',reason:'spoof',expectedRevision:0},expected:403});checks.push('same-origin checks protect administrator requests and account closure');
// Leave clearly named disposable fixtures for browser checks; never used in production.
const preview=await member('browser_member');await request('/api/contributor/members',{method:'POST',cookie:preview.cookie,body:{action:'apply-admin',reason:'希望参与资料审核与维护',expectedRevision:0},expected:201});
const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks,browserFixture:preview.username};await writeFile(new URL('../docs/member-governance-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
