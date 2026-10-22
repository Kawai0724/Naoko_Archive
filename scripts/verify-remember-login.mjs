// This verifier only accepts a disposable fixture database; it never reads .env.local.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const [phase,directory]=process.argv.slice(2),dir=realpathSync(directory);
if(!dir.startsWith('/private/tmp/naoko-sharing-qa.'))throw new Error('Expected a disposable fixture directory');
const base='http://127.0.0.1:3416',password='site-media-test-password',savedPath=path.join(dir,'remember-login-fixtures.json');
async function login(body){return fetch(base+'/api/contributor/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'media_owner',password,...body})});}
async function protectedPage(cookie,expected=200){const r=await fetch(base+'/api/contributor/albums',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(r.status,expected);}
async function logout(cookie){const r=await fetch(base+'/api/contributor/auth/logout',{method:'POST',headers:{Origin:base,Cookie:cookie}});assert.equal(r.status,200);assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));await protectedPage(cookie,401);}
if(phase==='before-restart'){
 const db=new DatabaseSync(path.join(dir,'archive.sqlite'),{readOnly:true}),sessions=[];
 for(const [choice,seconds] of [[undefined,28800],[false,28800],[true,2592000]]){
  const started=Date.now(),r=await login(choice===undefined?{}:{rememberMe:choice,maxAge:999999999});assert.equal(r.status,200);
  const header=r.headers.get('set-cookie');assert.ok(header.includes(`Max-Age=${seconds}`));assert.ok(header.includes('HttpOnly; SameSite=Strict'));assert.equal(r.headers.get('cache-control'),'no-store');
  const cookie=header.split(';')[0],token=cookie.split('=')[1],hash=createHash('sha256').update(token).digest('hex'),row=db.prepare('SELECT expires_at FROM contributor_sessions WHERE token_hash=?').get(hash);
  assert.ok(row.expires_at>=started+seconds*1000&&row.expires_at<=Date.now()+seconds*1000);await protectedPage(cookie);
  const landing=await fetch(base+'/contributor/login',{headers:{Cookie:cookie},redirect:'manual'}),html=await landing.text();
  assert.ok(landing.status===307&&landing.headers.get('location')==='/contributor'||html.includes('NEXT_REDIRECT;replace;/contributor;307;'),'Authenticated login must redirect to workbench');
  sessions.push({cookie,seconds});
 }
 for(const rememberMe of ['true',1,null,{},[]]){const r=await login({rememberMe});assert.equal(r.status,400);assert.equal(r.headers.get('set-cookie'),null);}
 const denied=await login({password:'incorrect-test-password',rememberMe:true});assert.equal(denied.status,401);assert.equal(denied.headers.get('set-cookie'),null);
 const page=await fetch(base+'/contributor/login');assert.equal(page.status,200);assert.ok((await page.text()).includes('保持登录（30 天）'));
 writeFileSync(savedPath,JSON.stringify(sessions),{mode:0o600});db.close();console.log('HTTP checks passed: opt-in/default expiry, matching database TTL, validation, protected access and login redirect. Restart the isolated server, then run after-restart.');
}else if(phase==='after-restart'){
 const sessions=JSON.parse(readFileSync(savedPath,'utf8'));for(const s of sessions){await protectedPage(s.cookie);await logout(s.cookie);}
 const report={testedAt:new Date().toISOString(),isolatedDatabase:true,checks:['default/unchecked login has matching 8-hour Cookie and database expiry','checked login has matching 30-day Cookie and database expiry; arbitrary maxAge ignored','Cookie HttpOnly and SameSite=Strict; HTTPS Secure separately unit-tested','non-boolean rememberMe rejected without session cookie','wrong password does not create remembered session','authenticated login page redirects to workbench','all sessions survive a real application restart','logout clears cookie and server session immediately','login form contains optional 30-day checkbox']};
 writeFileSync(new URL('../docs/remember-login-http-qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}else throw new Error('Use before-restart or after-restart');
