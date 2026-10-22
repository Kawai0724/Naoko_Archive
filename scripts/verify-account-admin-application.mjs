// Use only the disposable fixture server seeded by verify-site-media-sharing.mjs.
import assert from 'node:assert/strict';
import {realpathSync,writeFileSync} from 'node:fs';
const dir=realpathSync(process.argv[2]);
if(!dir.startsWith('/private/tmp/naoko-sharing-qa.'))throw new Error('Expected isolated fixture directory');
const base='http://127.0.0.1:3416',password='site-media-test-password';
async function request(route,{cookie='',method='GET',body,expected=200,origin=base}={}){
 const response=await fetch(base+route,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(response.status,expected,method+' '+route);return response;
}
async function login(username){const r=await request('/api/contributor/auth/login',{method:'POST',body:{username,password}});return {cookie:r.headers.get('set-cookie').split(';')[0],user:(await r.json()).user};}
async function account(cookie){return (await request('/contributor/account',{cookie})).text();}
async function application(cookie){return (await(await request('/api/contributor/members',{cookie})).json()).application;}
async function submit(cookie,reason,expectedRevision,expected=201,origin=base){return request('/api/contributor/members',{cookie,method:'POST',body:{action:'apply-admin',reason,expectedRevision},expected,origin});}
const admin=await login('fly-me-to-1980'),owner=await login('media_owner'),other=await login('media_other');
for(const cookie of ['',owner.cookie,admin.cookie]){
 const html=await(await request('/members',{cookie})).text();assert.ok(!html.includes('成员工作台')&&!html.includes('申请成为管理员')&&!html.includes('href="/contributor/members"'));
}
const legacy=await request('/contributor/members',{cookie:owner.cookie,expected:307});assert.equal(legacy.headers.get('location'),'/members');
assert.ok((await account(owner.cookie)).includes('id="admin-application"'));
assert.ok(!(await account(admin.cookie)).includes('id="admin-application"'));
const pending=await request('/api/contributor/auth/register',{method:'POST',body:{username:'pending_account_test',password},expected:201}),pendingCookie=pending.headers.get('set-cookie').split(';')[0];
assert.ok(!(await account(pendingCookie)).includes('id="admin-application"'));await submit(pendingCookie,'申请',0,403);
await submit(owner.cookie,'',0,400);await submit(owner.cookie,'跨站申请',0,403,'https://foreign.invalid');
await submit(owner.cookie,'希望帮助核实唱片资料',0);assert.equal((await application(owner.cookie)).status,'pending');assert.equal(await application(other.cookie),null);
let html=await account(owner.cookie);assert.ok(html.includes('管理员申请待审核')&&!html.includes('id="admin-reason"'));assert.ok((await account(owner.cookie)).includes('管理员申请待审核'));
await submit(owner.cookie,'重复申请',1,409);
await request('/api/contributor/requests',{cookie:owner.cookie,method:'POST',body:{action:'review-admin-application',id:owner.user.id,decision:'approved',expectedRevision:1},expected:403});
const queue=await(await request('/api/contributor/requests',{cookie:admin.cookie})).json();assert.ok(queue.adminApplications.some(a=>a.user_id===owner.user.id&&a.reason==='希望帮助核实唱片资料'));
async function review(decision,expectedRevision,note=''){await request('/api/contributor/requests',{cookie:admin.cookie,method:'POST',body:{action:'review-admin-application',id:owner.user.id,decision,expectedRevision,note}});}
await review('rejected',1,'请补充参与计划');html=await account(owner.cookie);assert.ok(html.includes('请补充参与计划')&&html.includes('重新申请'));
await submit(owner.cookie,'核实唱片编号与曲目信息',2);await review('approved',3);assert.ok(!(await account(owner.cookie)).includes('id="admin-application"'));
const manager=await(await request('/contributor/members',{cookie:admin.cookie})).text();assert.ok(manager.includes('创建邀请')&&manager.includes('停用'));
assert.ok((await account(other.cookie)).includes('id="admin-application"'));
for(const cookie of [owner.cookie,other.cookie,admin.cookie,pendingCookie])await request('/api/contributor/auth/logout',{cookie,method:'POST'});
const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks:['public member directory read-only for guests, contributors and administrators','legacy contributor member route redirects ordinary contributors to the directory','only approved contributors see the application on their personal account','empty/cross-origin/pending-account submissions denied','pending status survives page reload; duplicate applications denied','application visible only to its owner and administrator review queue','self approval denied; rejection reply and resubmission remain on account page','administrator approval takes effect in existing session; application form disappears','administrator member and invitation management remains available']};
writeFileSync(new URL('../docs/account-admin-application-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
