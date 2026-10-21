import { randomUUID } from 'node:crypto';
import { AlbumStore,StoreError } from './album-store';
import { IdentityStore,type ContributorUser } from './identity-store';
import { siteContentFields,type SiteContentKey,type ContentSnapshot } from './site-content';
export type SiteChangeRequest={id:string;user_id:string;username:string;field:SiteContentKey;before_value:string;proposed_value:string;base_revision:number;reason:string;status:'pending'|'approved'|'rejected';admin_note:string;created_at:number;reviewed_at:number|null;revision:number};
export class ChangeRequestStore{
  readonly identity:IdentityStore;
  constructor(readonly store:AlbumStore){
    this.identity=new IdentityStore(store.db);store.db.exec(`CREATE TABLE IF NOT EXISTS approved_site_content(field TEXT PRIMARY KEY,value TEXT NOT NULL,revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS site_change_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES contributor_users(id),field TEXT NOT NULL,before_value TEXT NOT NULL,proposed_value TEXT NOT NULL,base_revision INTEGER NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),admin_note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,reviewed_at INTEGER,reviewer_id TEXT,revision INTEGER NOT NULL DEFAULT 1);`);
  }
  active(user:ContributorUser){if(!this.store.db.prepare("SELECT id FROM contributor_users WHERE id=? AND role=? AND disabled=0 AND approval_status='approved'").get(user.id,user.role))throw new StoreError('账号尚未获准参与共建',403);}
  content():ContentSnapshot{return Object.fromEntries(Object.entries(siteContentFields).map(([field,defaultValue])=>{
    const row=this.store.db.prepare('SELECT value,revision FROM approved_site_content WHERE field=?').get(field) as {value:string;revision:number}|undefined;
    return [field,row?{...row}:{value:defaultValue.value,revision:0}];
  })) as ContentSnapshot;}
  list(user:ContributorUser){this.active(user);const rows=user.role==='admin'?this.store.db.prepare('SELECT r.*,u.username FROM site_change_requests r JOIN contributor_users u ON u.id=r.user_id ORDER BY r.created_at DESC').all():this.store.db.prepare('SELECT r.*,u.username FROM site_change_requests r JOIN contributor_users u ON u.id=r.user_id WHERE r.user_id=? ORDER BY r.created_at DESC').all(user.id);return rows.map(r=>({...r})) as SiteChangeRequest[];}
  submit(user:ContributorUser,field:SiteContentKey,value:string,reason:string,expected:number){
    this.active(user);if(!Object.hasOwn(siteContentFields,field)||typeof value!=='string'||!value.trim()||value.length>5000||typeof reason!=='string'||reason.length>2000||!Number.isSafeInteger(expected))throw new StoreError('请填写有效的修改内容');
    const current=this.content()[field];if(current.revision!==expected)throw new StoreError('网站内容已更新，请刷新后重新提交',409);
    if(value.trim()===current.value)throw new StoreError('修改内容与当前内容相同');
    const pending=(this.store.db.prepare("SELECT count(*) n FROM site_change_requests WHERE user_id=? AND status='pending'").get(user.id) as {n:number}).n;
    if(pending>=10)throw new StoreError('待审核申请较多，请等待处理',429);
    const id=randomUUID();this.store.db.prepare("INSERT INTO site_change_requests(id,user_id,field,before_value,proposed_value,base_revision,reason,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?)").run(id,user.id,field,current.value,value.trim(),expected,reason.trim(),Date.now());this.identity.audit(user,'site-change-submit',id);return id;
  }
  review(admin:ContributorUser,id:string,decision:'approved'|'rejected',expected:number,note:string){
    this.identity.requireAdmin(admin);if(!['approved','rejected'].includes(decision)||!Number.isSafeInteger(expected)||note.length>2000)throw new StoreError('审核信息无效');
    const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{
      const r=db.prepare('SELECT * FROM site_change_requests WHERE id=?').get(id) as SiteChangeRequest|undefined;
      if(!r)throw new StoreError('申请不存在',404);
      if(r.status!=='pending'||r.revision!==expected)throw new StoreError('申请已更新，请刷新后再审核',409);
      if(decision==='approved'){
        if(this.content()[r.field].revision!==r.base_revision)throw new StoreError('当前内容已被其他申请更新，请退回此申请后重新提交',409);
        db.prepare('INSERT INTO approved_site_content VALUES(?,?,?) ON CONFLICT(field) DO UPDATE SET value=excluded.value,revision=excluded.revision').run(r.field,r.proposed_value,r.base_revision+1);
      }
      db.prepare('UPDATE site_change_requests SET status=?,admin_note=?,reviewed_at=?,reviewer_id=?,revision=revision+1 WHERE id=?').run(decision,note.trim(),Date.now(),admin.id,id);this.identity.audit(admin,'site-change-'+decision,id);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
}
