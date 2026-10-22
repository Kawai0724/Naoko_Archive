import { createHash,randomBytes,randomUUID,scryptSync,timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { StoreError } from './album-store';
import { bioLength,MEMBER_BIO_LIMIT,memberBio } from './member-bio';
export type AccountStatus='pending'|'approved'|'rejected';
export type ContributorUser={id:string;username:string;role:'admin'|'contributor';accountStatus:AccountStatus};
export type AccountProfile={username:string;nickname:string;bio:string;role:'admin'|'contributor';accountStatus:AccountStatus};
type UserRow=ContributorUser&{password_hash:string;disabled:number};
export const SESSION_SECONDS=8*60*60;
export const REMEMBER_SESSION_SECONDS=30*24*60*60;
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
const publicUser=(u:ContributorUser):ContributorUser=>({id:u.id,username:u.username,role:u.role,accountStatus:u.accountStatus});
export type RegistrationApplication={user_id:string;username:string;reason:string;status:AccountStatus;admin_note:string;created_at:number;reviewed_at:number|null;revision:number};
export type PublicMember={username:string;bio:string;role:'admin'|'contributor';created_at:number};
export type AdminApplication={user_id:string;username:string;reason:string;status:'pending'|'approved'|'rejected';admin_note:string;created_at:number;reviewed_at:number|null;revision:number};
export class IdentityStore{
  constructor(readonly db:DatabaseSync){
    db.exec(`CREATE TABLE IF NOT EXISTS contributor_users(id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','contributor')),disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS contributor_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES contributor_users(id),expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS contributor_invites(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES contributor_users(id),expires_at INTEGER NOT NULL,used_by TEXT,revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS album_owners(album_id TEXT PRIMARY KEY REFERENCES albums(id),user_id TEXT NOT NULL REFERENCES contributor_users(id));
      CREATE TABLE IF NOT EXISTS contributor_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS contributor_audit(id INTEGER PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at INTEGER NOT NULL);`);
    db.exec('BEGIN IMMEDIATE');try{
      const columns=db.prepare('PRAGMA table_info(contributor_users)').all() as {name:string}[];
      if(!columns.some(c=>c.name==='approval_status'))db.exec("ALTER TABLE contributor_users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected'))");
      db.exec(`CREATE TABLE IF NOT EXISTS contributor_applications(user_id TEXT PRIMARY KEY REFERENCES contributor_users(id),reason TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),admin_note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,reviewed_at INTEGER,reviewer_id TEXT,revision INTEGER NOT NULL DEFAULT 1);`);
      if(!columns.some(c=>c.name==='closed_at'))db.exec('ALTER TABLE contributor_users ADD COLUMN closed_at INTEGER');
      if(!columns.some(c=>c.name==='nickname'))db.exec("ALTER TABLE contributor_users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
      if(!columns.some(c=>c.name==='bio'))db.exec("ALTER TABLE contributor_users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
      db.exec(`CREATE TABLE IF NOT EXISTS contributor_admin_applications(user_id TEXT PRIMARY KEY REFERENCES contributor_users(id),reason TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),admin_note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,reviewed_at INTEGER,reviewer_id TEXT,revision INTEGER NOT NULL DEFAULT 1);`);
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  bootstrap(password:string|undefined){
    if(this.db.prepare("SELECT id FROM contributor_users WHERE role='admin'").get())return;
    if(!password)throw new StoreError('管理员账号尚未配置',503);
    const hash=hashPassword(password),id=randomUUID();this.db.exec('BEGIN IMMEDIATE');try{
      if(!this.db.prepare("SELECT id FROM contributor_users WHERE role='admin'").get()){
        this.db.prepare('INSERT INTO contributor_users(id,username,password_hash,role,disabled,created_at) VALUES(?,?,?,?,0,?)').run(id,'fly-me-to-1980',hash,'admin',Date.now());
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
  login(username:string,password:string,rememberMe=false){
    if(username.length>40||password.length>256)throw new StoreError('用户名或密码不正确',401);
    this.limit('login:total',200);this.limit(`login:${username.toLowerCase()}`);
    const u=this.db.prepare('SELECT *,approval_status AS accountStatus FROM contributor_users WHERE username=?').get(username) as UserRow|undefined;
    const valid=matchesPassword(password,u?.password_hash??'00000000000000000000000000000000:'+ '00'.repeat(64));
    if(!u||u.disabled||!valid)throw new StoreError('用户名或密码不正确',401);
    this.db.prepare('DELETE FROM contributor_limits WHERE key=?').run(`login:${username.toLowerCase()}`);return this.createSession(u,rememberMe);
  }
  createSession(user:ContributorUser,rememberMe=false){
    const token=randomBytes(32).toString('base64url'),maxAge=rememberMe===true?REMEMBER_SESSION_SECONDS:SESSION_SECONDS;
    this.db.prepare('DELETE FROM contributor_sessions WHERE expires_at<=?').run(Date.now());
    this.db.prepare('INSERT INTO contributor_sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+maxAge*1000);
    return {token,user:publicUser(user),maxAge};
  }
  session(token:string|undefined):ContributorUser|null{
    if(!token||!/^[\w-]{43}$/.test(token))return null;
    const u=this.db.prepare('SELECT u.id,u.username,u.role,u.approval_status AS accountStatus FROM contributor_sessions s JOIN contributor_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(digest(token),Date.now()) as ContributorUser|undefined;
    return u?publicUser(u):null;
  }
  logout(token:string|undefined){if(token)this.db.prepare('DELETE FROM contributor_sessions WHERE token_hash=?').run(digest(token));}
  profile(user:ContributorUser):AccountProfile{
    const row=this.db.prepare('SELECT username,nickname,bio,role,approval_status AS accountStatus FROM contributor_users WHERE id=? AND disabled=0 AND closed_at IS NULL').get(user.id) as AccountProfile|undefined;
    if(!row)throw new StoreError('请重新登录',401);return {...row};
  }
  updateProfile(user:ContributorUser,nickname:string,bio:string){
    if(typeof nickname!=='string'||typeof bio!=='string'||nickname.trim().length>30||bioLength(bio)>MEMBER_BIO_LIMIT||/[\x00-\x1f\x7f]/.test(nickname)||bio.includes('\0'))throw new StoreError('昵称最多 30 个字符，简介最多 80 字');
    this.db.exec('BEGIN IMMEDIATE');try{
      this.profile(user);this.db.prepare('UPDATE contributor_users SET nickname=?,bio=? WHERE id=?').run(nickname.trim(),bio.trim(),user.id);
      this.audit(user,'update-own-profile',user.id);const profile=this.profile(user);this.db.exec('COMMIT');return profile;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  changePassword(user:ContributorUser,currentPassword:string,newPassword:string){
    if(typeof currentPassword!=='string'||currentPassword.length>256||typeof newPassword!=='string'||newPassword.length<12||newPassword.length>256)throw new StoreError('新密码需要 12–256 个字符');
    this.limit(`change-password:${user.id}`);
    this.db.exec('BEGIN IMMEDIATE');try{
      this.profile(user);const target=this.db.prepare('SELECT password_hash FROM contributor_users WHERE id=?').get(user.id) as {password_hash:string};
      if(!matchesPassword(currentPassword,target.password_hash))throw new StoreError('当前密码不正确',401);
      if(currentPassword===newPassword)throw new StoreError('新密码不能与当前密码相同');
      const hash=hashPassword(newPassword);this.db.prepare('UPDATE contributor_users SET password_hash=? WHERE id=?').run(hash,user.id);
      this.db.prepare('DELETE FROM contributor_sessions WHERE user_id=?').run(user.id);
      this.audit(user,'change-own-password',user.id);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  requireAdmin(user:ContributorUser){if(!this.db.prepare("SELECT id FROM contributor_users WHERE id=? AND role='admin' AND disabled=0 AND approval_status='approved'").get(user.id))throw new StoreError('仅管理员可操作',403);}
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
      const user:ContributorUser={id:randomUUID(),username,role:'contributor',accountStatus:'pending'};
      this.db.prepare("INSERT INTO contributor_users(id,username,password_hash,role,disabled,created_at,approval_status) VALUES(?,?,?,?,0,?,'pending')").run(user.id,user.username,hash,user.role,Date.now());
      this.db.prepare("INSERT INTO contributor_applications(user_id,reason,status,created_at) VALUES(?,?,'pending',?)").run(user.id,'通过管理员邀请申请加入',Date.now());
      this.db.prepare('UPDATE contributor_invites SET used_by=? WHERE id=?').run(user.id,invite.id);
      const session=this.createSession(user);this.audit(user,'accept-invite',invite.id);this.db.exec('COMMIT');return session;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  adminData(user:ContributorUser){this.requireAdmin(user);return {
    users:this.db.prepare('SELECT id,username,role,disabled,created_at,approval_status,closed_at FROM contributor_users ORDER BY created_at').all().map(row=>({...row})),
    invites:this.db.prepare('SELECT id,expires_at,used_by,revoked FROM contributor_invites ORDER BY expires_at DESC LIMIT 100').all().map(row=>({...row}))
  };}
  revoke(user:ContributorUser,id:string){this.requireAdmin(user);this.db.prepare('UPDATE contributor_invites SET revoked=1 WHERE id=? AND used_by IS NULL').run(id);this.audit(user,'revoke-invite',id);}
  disable(user:ContributorUser,id:string,disabled:boolean){
    this.db.exec('BEGIN IMMEDIATE');try{
      this.requireAdmin(user);
      const target=this.db.prepare("SELECT role,closed_at FROM contributor_users WHERE id=?").get(id) as {role:string;closed_at:number|null}|undefined;
      if(!target)throw new StoreError('账号不存在',404);
      if(target.closed_at)throw new StoreError('账号已注销，不能重新启用',409);
      if(target.role!=='contributor')throw new StoreError('不能通过停用操作修改管理员',403);
      this.db.prepare('UPDATE contributor_users SET disabled=? WHERE id=?').run(disabled?1:0,id);
      if(disabled)this.db.prepare('DELETE FROM contributor_sessions WHERE user_id=?').run(id);
      this.audit(user,disabled?'disable-user':'enable-user',id);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  publicMembers():PublicMember[]{return this.db.prepare("SELECT username,bio,role,created_at FROM contributor_users WHERE disabled=0 AND approval_status='approved' AND closed_at IS NULL ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END,created_at,username").all().map(row=>({...row,bio:memberBio(row.bio as string)})) as PublicMember[];}
  private requireActive(user:ContributorUser){
    const row=this.db.prepare("SELECT role FROM contributor_users WHERE id=? AND disabled=0 AND approval_status='approved' AND closed_at IS NULL").get(user.id) as {role:string}|undefined;
    if(!row||row.role!==user.role)throw new StoreError('账号无权执行此操作，请重新登录',403);
    return row;
  }
  adminApplication(user:ContributorUser){this.requireActive(user);const row=this.db.prepare('SELECT a.*,u.username FROM contributor_admin_applications a JOIN contributor_users u ON u.id=a.user_id WHERE a.user_id=?').get(user.id) as AdminApplication|undefined;return row?{...row}:null;}
  adminApplications(admin:ContributorUser){this.requireAdmin(admin);return this.db.prepare('SELECT a.*,u.username FROM contributor_admin_applications a JOIN contributor_users u ON u.id=a.user_id ORDER BY a.created_at DESC').all().map(row=>({...row})) as AdminApplication[];}
  requestAdmin(user:ContributorUser,reason:string,expected:number){
    if(typeof reason!=='string'||reason.trim().length<1||reason.length>2000||!Number.isSafeInteger(expected)||expected<0)throw new StoreError('请填写申请说明（1–2000 字）及有效修订号');
    this.db.exec('BEGIN IMMEDIATE');try{
      const current=this.requireActive(user);if(current.role==='admin')throw new StoreError('你已经是管理员',409);
      const previous=this.adminApplication(user);
      if((previous?.revision??0)!==expected||previous?.status==='pending')throw new StoreError('申请已更新或正在审核，请刷新后查看',409);
      if(previous?.status==='approved')throw new StoreError('申请已通过',409);
      this.db.prepare("INSERT INTO contributor_admin_applications(user_id,reason,status,created_at) VALUES(?,?,'pending',?) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,status='pending',admin_note='',created_at=excluded.created_at,reviewed_at=NULL,reviewer_id=NULL,revision=revision+1").run(user.id,reason.trim(),Date.now());
      this.audit(user,'request-admin',user.id);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  reviewAdminApplication(admin:ContributorUser,userId:string,decision:'approved'|'rejected',expected:number,note:string){
    if(!['approved','rejected'].includes(decision)||!Number.isSafeInteger(expected)||typeof note!=='string'||note.length>2000)throw new StoreError('审核信息无效');
    this.db.exec('BEGIN IMMEDIATE');try{
      this.requireAdmin(admin);if(admin.id===userId)throw new StoreError('不能审批自己的管理员申请',403);
      const request=this.db.prepare('SELECT status,revision FROM contributor_admin_applications WHERE user_id=?').get(userId) as {status:string;revision:number}|undefined;
      if(!request)throw new StoreError('申请不存在',404);
      if(request.status!=='pending'||request.revision!==expected)throw new StoreError('申请已更新，请刷新后审核',409);
      const target=this.db.prepare('SELECT role,disabled,approval_status,closed_at FROM contributor_users WHERE id=?').get(userId) as {role:string;disabled:number;approval_status:string;closed_at:number|null}|undefined;
      if(!target||target.disabled||target.closed_at||target.approval_status!=='approved'||target.role!=='contributor')throw new StoreError('申请人当前状态不允许升级',409);
      if(decision==='approved')this.db.prepare("UPDATE contributor_users SET role='admin' WHERE id=?").run(userId);
      this.db.prepare('UPDATE contributor_admin_applications SET status=?,admin_note=?,reviewed_at=?,reviewer_id=?,revision=revision+1 WHERE user_id=?').run(decision,note.trim(),Date.now(),admin.id,userId);
      this.audit(admin,'admin-application-'+decision,userId);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  closeOwnAccount(user:ContributorUser,password:string,confirmation:string){
    this.limit(`close-account:${user.id}`);
    this.db.exec('BEGIN IMMEDIATE');try{
      const target=this.db.prepare('SELECT username,role,password_hash,disabled,closed_at FROM contributor_users WHERE id=?').get(user.id) as {username:string;role:string;password_hash:string;disabled:number;closed_at:number|null}|undefined;
      if(!target||target.disabled||target.closed_at)throw new StoreError('账号已停用或注销',409);
      if(confirmation!==target.username)throw new StoreError('请输入正确的用户名确认注销');
      if(!matchesPassword(password,target.password_hash))throw new StoreError('当前密码不正确',401);
      if(target.role==='admin'&&(this.db.prepare("SELECT COUNT(*) AS count FROM contributor_users WHERE role='admin' AND disabled=0 AND approval_status='approved' AND closed_at IS NULL").get() as {count:number}).count<=1)throw new StoreError('不能注销最后一位管理员，请先由另一位管理员接任',409);
      const now=Date.now();this.db.prepare('UPDATE contributor_users SET disabled=1,closed_at=? WHERE id=?').run(now,user.id);
      this.db.prepare('DELETE FROM contributor_sessions WHERE user_id=?').run(user.id);
      this.db.prepare('UPDATE contributor_invites SET revoked=1 WHERE created_by=? AND used_by IS NULL').run(user.id);
      for(const table of ['contributor_applications','contributor_admin_applications'])this.db.prepare(`UPDATE ${table} SET status='rejected',admin_note='用户已主动注销账号',reviewed_at=?,reviewer_id=?,revision=revision+1 WHERE user_id=? AND status='pending'`).run(now,user.id,user.id);
      this.audit(user,'close-own-account',user.id);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  register(username:string,password:string,reason:string){
    this.limit('registration:total',50,60*60*1000);
    if(!/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(username))throw new StoreError('用户名使用 3–40 个英文字母、数字、下划线或连字符');
    if(reason.length>2000)throw new StoreError('申请说明请控制在 2000 字以内');
    const hash=hashPassword(password);this.db.exec('BEGIN IMMEDIATE');try{
      if(this.db.prepare('SELECT id FROM contributor_users WHERE username=?').get(username))throw new StoreError('这个用户名已被使用',409);
      const user:ContributorUser={id:randomUUID(),username,role:'contributor',accountStatus:'pending'};
      this.db.prepare("INSERT INTO contributor_users(id,username,password_hash,role,disabled,created_at,approval_status) VALUES(?,?,?,?,0,?,'pending')").run(user.id,username,hash,user.role,Date.now());
      this.db.prepare("INSERT INTO contributor_applications(user_id,reason,status,created_at) VALUES(?,?,'pending',?)").run(user.id,reason.trim(),Date.now());
      const result=this.createSession(user);this.audit(user,'registration-request',user.id);this.db.exec('COMMIT');return result;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  application(user:ContributorUser){
    const r=this.db.prepare('SELECT a.*,u.username FROM contributor_applications a JOIN contributor_users u ON u.id=a.user_id WHERE a.user_id=?').get(user.id) as RegistrationApplication|undefined;
    return r?{...r}:null;
  }
  registrationQueue(admin:ContributorUser){this.requireAdmin(admin);return (this.db.prepare('SELECT a.*,u.username FROM contributor_applications a JOIN contributor_users u ON u.id=a.user_id ORDER BY a.created_at DESC').all() as RegistrationApplication[]).map(r=>({...r}));}
  reviewRegistration(admin:ContributorUser,userId:string,decision:'approved'|'rejected',expected:number,note:string){
    this.requireAdmin(admin);if(!['approved','rejected'].includes(decision)||!Number.isSafeInteger(expected)||note.length>2000)throw new StoreError('审核信息无效');
    this.db.exec('BEGIN IMMEDIATE');try{
      const target=this.db.prepare('SELECT disabled,closed_at FROM contributor_users WHERE id=?').get(userId) as {disabled:number;closed_at:number|null}|undefined;
      if(!target||target.disabled||target.closed_at)throw new StoreError('账号已停用或注销',409);
      const r=this.db.prepare('SELECT * FROM contributor_applications WHERE user_id=?').get(userId) as RegistrationApplication|undefined;
      if(!r)throw new StoreError('申请不存在',404);
      if(r.status!=='pending'||r.revision!==expected)throw new StoreError('申请已更新，请刷新后再审核',409);
      this.db.prepare('UPDATE contributor_applications SET status=?,admin_note=?,reviewed_at=?,reviewer_id=?,revision=revision+1 WHERE user_id=?').run(decision,note.trim(),Date.now(),admin.id,userId);
      this.db.prepare("UPDATE contributor_users SET approval_status=? WHERE id=? AND role='contributor'").run(decision,userId);
      this.audit(admin,'registration-'+decision,userId);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  resubmitRegistration(user:ContributorUser,reason:string,expected:number){
    if(reason.length>2000||!Number.isSafeInteger(expected))throw new StoreError('申请信息无效');
    this.db.exec('BEGIN IMMEDIATE');try{
      const r=this.application(user);if(!r)throw new StoreError('申请不存在',404);
      if(r.status!=='rejected'||r.revision!==expected)throw new StoreError('只能重新提交已退回的申请',409);
      this.db.prepare("UPDATE contributor_applications SET reason=?,status='pending',admin_note='',reviewed_at=NULL,reviewer_id=NULL,created_at=?,revision=revision+1 WHERE user_id=?").run(reason.trim(),Date.now(),user.id);
      this.db.prepare("UPDATE contributor_users SET approval_status='pending' WHERE id=? AND role='contributor'").run(user.id);
      this.audit(user,'registration-resubmit',user.id);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
}
