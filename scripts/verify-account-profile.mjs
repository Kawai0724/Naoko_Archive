// All writes, including password changes, are limited to disposable local accounts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
const [phase,directory]=process.argv.slice(2),dir=realpathSync(directory);
if(!dir.startsWith('/private/tmp/naoko-sharing-qa.'))throw new Error('Expected disposable fixture database');
const base='http://127.0.0.1:3416',password='site-media-test-password',nextPassword='profile-new-test-password',savedPath=path.join(dir,'account-profile-fixtures.json');
async function request(route,{cookie='',method='GET',body,expected=200,origin=base}={}){
 const r=await fetch(base+route,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,expected,`${method} ${route}`);return r;
}
async function login(username,pw=password,expected=200){const r=await request('/api/contributor/auth/login',{method:'POST',body:{username,password:pw,rememberMe:true},expected});if(expected!==200){assert.equal(r.headers.get('set-cookie'),null);return '';}return r.headers.get('set-cookie').split(';')[0];}
async function profile(cookie){const r=await request('/api/contributor/account',{cookie});assert.equal(r.headers.get('cache-control'),'no-store');return (await r.json()).profile;}
async function patch(cookie,body,expected=200,origin=base){return request('/api/contributor/account',{cookie,method:'PATCH',body,expected,origin});}
const profileBody={action:'profile',nickname:'唱片收藏者',bio:'喜欢收藏唱片。\n这份简介只在个人账号页显示。'};
if(phase==='before-restart'){
 const owner=await login('media_owner'),second=await login('media_owner'),other=await login('media_other'),admin=await login('fly-me-to-1980');
 await request('/api/contributor/account',{expected:401});await request('/api/contributor/account',{cookie:'naoko_contributor_v2=forged-token',expected:401});
 const otherBefore=await profile(other),first=await profile(owner);assert.equal(first.username,'media_owner');assert.equal(first.nickname,'');assert.ok(!JSON.stringify(first).includes('password_hash'));
 const changed=await patch(owner,profileBody);assert.equal(changed.headers.get('set-cookie'),null);assert.equal((await changed.json()).profile.nickname,profileBody.nickname);
 assert.equal((await profile(owner)).bio,profileBody.bio);assert.deepEqual(await profile(other),otherBefore);
 const ownQuery=await request('/api/contributor/account?userId=other',{cookie:owner});assert.equal((await ownQuery.json()).profile.username,'media_owner');
 for(const body of [{...profileBody,id:'other-user'},{...profileBody,userId:'other-user'}])await patch(owner,body,403);
 for(const body of [{...profileBody,role:'admin'},{...profileBody,username:'admin'},{...profileBody,nickname:'x'.repeat(31)},{...profileBody,bio:'x'.repeat(501)},{...profileBody,nickname:17},{...profileBody,bio:{}},{...profileBody,nickname:'name\nadmin'}])await patch(owner,body,400);
 await patch(admin,{...profileBody,id:'other-user'},403);await patch(owner,profileBody,403,'https://foreign.invalid');assert.equal((await profile(owner)).role,'contributor');
 const html=await(await request('/contributor/account',{cookie:owner})).text();assert.ok(html.includes(profileBody.nickname)&&html.includes('简介')&&html.includes('修改密码'));assert.ok(!html.includes('password_hash')&&!html.includes(password));
 const members=await(await request('/members',{cookie:owner})).text();assert.ok(!members.includes(profileBody.bio));
 const header=await(await request('/archive')).text();assert.ok(header.includes('aria-label="个人账号"')&&header.includes('href="/contributor/account"'));
 const guestAccount=await fetch(base+'/contributor/account',{redirect:'manual'});const guestHtml=await guestAccount.text();assert.ok(guestAccount.status===200&&guestHtml.includes('NEXT_REDIRECT;replace;/contributor/login?next=account;307;')||guestAccount.status===307&&guestAccount.headers.get('location')==='/contributor/login?next=account');
 const action={action:'password',currentPassword:password,newPassword:nextPassword,confirmation:nextPassword};
 for(const body of [{...action,id:'other-user'},{...action,userId:'other-user'}])await patch(owner,body,403);
 await patch(owner,{...action,currentPassword:'incorrect-current-password'},401);await patch(owner,{...action,confirmation:'different-confirmation'},400);await patch(owner,{...action,newPassword:'short',confirmation:'short'},400);assert.equal((await profile(owner)).username,'media_owner');
 const changedPassword=await patch(owner,action);assert.ok(changedPassword.headers.get('set-cookie').includes('Max-Age=0'));
 for(const cookie of [owner,second])await request('/api/contributor/account',{cookie,expected:401});assert.deepEqual(await profile(other),otherBefore);await login('media_owner',password,401);const fresh=await login('media_owner',nextPassword);
 assert.equal((await profile(fresh)).nickname,profileBody.nickname);
 const pendingName='profile_pending_'+Date.now().toString(36),pending=await request('/api/contributor/auth/register',{method:'POST',body:{username:pendingName,password},expected:201}),pendingCookie=pending.headers.get('set-cookie').split(';')[0];
 await patch(pendingCookie,{action:'profile',nickname:'待审成员',bio:'可以编辑自己的资料'});assert.equal((await profile(pendingCookie)).accountStatus,'pending');await request('/api/contributor/albums',{cookie:pendingCookie,expected:403});
 writeFileSync(savedPath,JSON.stringify({fresh,other,admin,pendingCookie}),{mode:0o600});console.log('Account HTTP checks passed. Restart the isolated server, then run after-restart.');
}else if(phase==='after-restart'){
 const sessions=JSON.parse(readFileSync(savedPath,'utf8'));assert.equal((await profile(sessions.fresh)).nickname,profileBody.nickname);assert.equal((await profile(sessions.fresh)).bio,profileBody.bio);await login('media_owner',password,401);const current=await login('media_owner',nextPassword);await profile(current);
 const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks:['personal account header and guest sign-in route','profile GET/PATCH require a real session and correct origin','nickname/biography save privately, with immutable login username and role','foreign user ID and role/username modification rejected, including administrator requests','invalid types and length/control-character limits enforced','wrong current password, mismatched confirmation and weak new password rejected','password change clears Cookie and all own sessions; other user unaffected','old password fails, new password works; profile and new hash survive actual application restart','pending member can edit own profile but cannot access albums','public member page does not expose private biography']};
 writeFileSync(new URL('../docs/account-profile-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 for(const cookie of [current,...Object.values(sessions)])await request('/api/contributor/auth/logout',{cookie,method:'POST'});
}else throw new Error('Use before-restart or after-restart');
