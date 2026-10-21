import { createHash,randomBytes,randomUUID,scryptSync,timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { StoreError } from './album-store';
export type ContributorUser={id:string;username:string;role:'admin'|'contributor'};
type UserRow=ContributorUser&{password_hash:string;disabled:number};
export const SESSION_SECONDS=8*60*60;
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function hashPassword(password:string){
  if(password.length<12||password.length>256)throw new StoreError('密码需要 12–256 个字符');
  const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
}
function matchesPassword(password:string,hash:string){
  if(password.length>256)return false;
  const [salt,key]=hash.split(':');if(!salt||!key)return false;
  const actual=scryptSync(password,salt,64),expected=Buffer.from(key,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
const publicUser=(u:ContributorUser):ContributorUser=>({id:u.id,username:u.username,role:u.role});
export class IdentityStore{
  constructor(readonly db:DatabaseSync){
    db.exec(`CREATE TABLE IF NOT EXISTS contributor_users(id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','contributor')),disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS contributor_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES contributor_users(id),expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS contributor_invites(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES contributor_users(id),expires_at INTEGER NOT NULL,used_by TEXT,revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS album_owners(album_id TEXT PRIMARY KEY REFERENCES albums(id),user_id TEXT NOT NULL REFERENCES contributor_users(id));
      CREATE TABLE IF NOT EXISTS contributor_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS contributor_audit(id INTEGER PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at INTEGER NOT NULL);`);
  }
  bootstrap(password:string|undefined){
    if(this.db.prepare("SELECT id FROM contributor_users WHERE role='admin'").get())return;
    if(!password)throw new StoreError('管理员账号尚未配置',503);
    const hash=hashPassword(password),id=randomUUID();this.db.exec('BEGIN IMMEDIATE');try{
      if(!this.db.prepare("SELECT id FROM contributor_users WHERE role='admin'").get()){
        this.db.prepare('INSERT INTO contributor_users VALUES(?,?,?,?,0,?)').run(id,'fly-me-to-1980',hash,'admin',Date.now());
        this.db.prepare('INSERT OR IGNORE INTO album_owners SELECT id,? FROM albums').run(id);
      }this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  audit(user:ContributorUser,action:string,target:string){this.db.prepare('INSERT INTO contributor_audit(actor_id,action,target,created_at) VALUES(?,?,?,?)').run(user.id,action,target,Date.now());}
  owner(albumId:string){return (this.db.prepare('SELECT user_id FROM album_owners WHERE album_id=?').get(albumId) as {user_id:string}|undefined)?.user_id;}
  assign(albumId:string,user:ContributorUser){this.db.prepare('INSERT INTO album_owners VALUES(?,?)').run(albumId,user.id);}
  limit(key:string,max=10,window=15*60*1000){
    const now=Date.now();this.db.prepare('DELETE FROM contributor_limits WHERE expires_at<=?').run(now);
    this.db.prepare('INSERT INTO contributor_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+window);
    if((this.db.prepare('SELECT count FROM contributor_limits WHERE key=?').get(key) as {count:number}).count>max)throw new StoreError('尝试次数过多，请稍后再试',429);
  }
  login(username:string,password:string){
    if(username.length>40||password.length>256)throw new StoreError('用户名或密码不正确',401);
    this.limit('login:total',200);this.limit(`login:${username.toLowerCase()}`);
    const u=this.db.prepare('SELECT * FROM contributor_users WHERE username=?').get(username) as UserRow|undefined;
    const valid=matchesPassword(password,u?.password_hash??'00000000000000000000000000000000:'+ '00'.repeat(64));
    if(!u||u.disabled||!valid)throw new StoreError('用户名或密码不正确',401);
    this.db.prepare('DELETE FROM contributor_limits WHERE key=?').run(`login:${username.toLowerCase()}`);return this.createSession(u);
  }
  createSession(user:ContributorUser){
    const token=randomBytes(32).toString('base64url');
    this.db.prepare('DELETE FROM contributor_sessions WHERE expires_at<=?').run(Date.now());
    this.db.prepare('INSERT INTO contributor_sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+SESSION_SECONDS*1000);
    return {token,user:publicUser(user)};
  }
  session(token:string|undefined):ContributorUser|null{
    if(!token||!/^[\w-]{43}$/.test(token))return null;
    const u=this.db.prepare('SELECT u.id,u.username,u.role FROM contributor_sessions s JOIN contributor_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(digest(token),Date.now()) as ContributorUser|undefined;
    return u?publicUser(u):null;
  }
  logout(token:string|undefined){if(token)this.db.prepare('DELETE FROM contributor_sessions WHERE token_hash=?').run(digest(token));}
  requireAdmin(user:ContributorUser){if(!this.db.prepare("SELECT id FROM contributor_users WHERE id=? AND role='admin' AND disabled=0").get(user.id))throw new StoreError('仅管理员可操作',403);}
  invite(user:ContributorUser){
    this.requireAdmin(user);const id=randomUUID(),token=randomBytes(32).toString('base64url'),expiresAt=Date.now()+7*86400000;
    this.db.prepare('INSERT INTO contributor_invites VALUES(?,?,?,?,NULL,0)').run(id,digest(token),user.id,expiresAt);
    this.audit(user,'invite',id);return {id,token,expiresAt};
  }
  accept(token:string,username:string,password:string){
    this.limit('invite:accept',100);
    if(!/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(username))throw new StoreError('用户名使用 3–40 个英文字母、数字、下划线或连字符');
    if(!/^[\w-]{43}$/.test(token))throw new StoreError('邀请无效或已过期');const hash=hashPassword(password);
    this.db.exec('BEGIN IMMEDIATE');try{
      const invite=this.db.prepare('SELECT id FROM contributor_invites WHERE token_hash=? AND expires_at>? AND used_by IS NULL AND revoked=0').get(digest(token),Date.now()) as {id:string}|undefined;
      if(!invite)throw new StoreError('邀请无效或已过期');
      if(this.db.prepare('SELECT id FROM contributor_users WHERE username=?').get(username))throw new StoreError('这个用户名已被使用',409);
      const user:ContributorUser={id:randomUUID(),username,role:'contributor'};
      this.db.prepare('INSERT INTO contributor_users VALUES(?,?,?,?,0,?)').run(user.id,user.username,hash,user.role,Date.now());
      this.db.prepare('UPDATE contributor_invites SET used_by=? WHERE id=?').run(user.id,invite.id);
      const session=this.createSession(user);this.audit(user,'accept-invite',invite.id);this.db.exec('COMMIT');return session;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  adminData(user:ContributorUser){this.requireAdmin(user);return {
    users:this.db.prepare('SELECT id,username,role,disabled,created_at FROM contributor_users ORDER BY created_at').all().map(row=>({...row})),
    invites:this.db.prepare('SELECT id,expires_at,used_by,revoked FROM contributor_invites ORDER BY expires_at DESC LIMIT 100').all().map(row=>({...row}))
  };}
  revoke(user:ContributorUser,id:string){this.requireAdmin(user);this.db.prepare('UPDATE contributor_invites SET revoked=1 WHERE id=? AND used_by IS NULL').run(id);this.audit(user,'revoke-invite',id);}
  disable(user:ContributorUser,id:string,disabled:boolean){
    this.requireAdmin(user);this.db.prepare("UPDATE contributor_users SET disabled=? WHERE id=? AND role='contributor'").run(disabled?1:0,id);
    if(disabled)this.db.prepare('DELETE FROM contributor_sessions WHERE user_id=?').run(id);this.audit(user,disabled?'disable-user':'enable-user',id);
  }
}
