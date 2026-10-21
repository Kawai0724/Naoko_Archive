import { randomUUID } from 'node:crypto';
import { AlbumStore,StoreError } from './album-store';
import { IdentityStore,type ContributorUser } from './identity-store';
import { albumDifferences,type AlbumDifference } from './album-diff';
import type { Album } from './types';
export type AlbumChangeRequest={id:string;album_id:string;user_id:string;username:string;kind:'content'|'delete';album_title:string;reason:string;status:'pending'|'approved'|'rejected';album_revision:number;revision:number;created_at:number;reviewed_at:number|null;reviewer_username:string|null;admin_note:string;legacy:number;changes:AlbumDifference[]};
type Row=Omit<AlbumChangeRequest,'changes'|'reviewer_username'>&{before_json:string|null;after_json:string;diff_json:string;reviewer_id:string|null};
export class AlbumRequestStore{
  readonly identity:IdentityStore;
  constructor(readonly store:AlbumStore){
    this.identity=new IdentityStore(store.db);
    store.db.exec(`CREATE TABLE IF NOT EXISTS album_change_requests(id TEXT PRIMARY KEY,album_id TEXT NOT NULL REFERENCES albums(id),user_id TEXT NOT NULL REFERENCES contributor_users(id),username TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('content','delete')),album_title TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),album_revision INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,before_json TEXT,after_json TEXT NOT NULL,diff_json TEXT NOT NULL,created_at INTEGER NOT NULL,reviewed_at INTEGER,reviewer_id TEXT REFERENCES contributor_users(id),admin_note TEXT NOT NULL DEFAULT '',legacy INTEGER NOT NULL DEFAULT 0);
      CREATE UNIQUE INDEX IF NOT EXISTS one_pending_album_change ON album_change_requests(album_id) WHERE status='pending';`);
    const db=store.db;db.exec('BEGIN IMMEDIATE');try{
      if(!db.prepare('SELECT key FROM archive_schema WHERE key=?').get('album-review-messages-v1')){
        for(const row of db.prepare('SELECT id,working_json,published_json FROM albums').all() as {id:string;working_json:string;published_json:string|null}[]){
          const album=JSON.parse(row.working_json) as Album;if(album.deletedAt||album.status!=='pending-review')continue;
          const actor=db.prepare("SELECT u.id,u.username FROM contributor_audit a JOIN contributor_users u ON u.id=a.actor_id WHERE a.target=? AND a.action='submit' ORDER BY a.id DESC LIMIT 1").get(album.id)??db.prepare('SELECT u.id,u.username FROM album_owners o JOIN contributor_users u ON u.id=o.user_id WHERE o.album_id=?').get(album.id)??db.prepare("SELECT id,username FROM contributor_users WHERE role='admin' ORDER BY created_at LIMIT 1").get();
          if(actor)this.insert(actor as {id:string;username:string},album,'content','',row.published_json?JSON.parse(row.published_json):null,true);
        }
        db.prepare('INSERT INTO archive_schema VALUES(?,?)').run('album-review-messages-v1','1');
      }db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  private active(user:ContributorUser){if(!this.store.db.prepare("SELECT id FROM contributor_users WHERE id=? AND role=? AND disabled=0 AND approval_status='approved'").get(user.id,user.role))throw new StoreError('账号无权执行此操作',403);}
  private accessible(user:ContributorUser,albumId:string){this.active(user);const album=this.store.get(albumId);if(!album||user.role!=='admin'&&this.identity.owner(albumId)!==user.id)throw new StoreError('记录不存在',404);return album;}
  private message(row:Row):AlbumChangeRequest{const reviewer=row.reviewer_id?this.store.db.prepare('SELECT username FROM contributor_users WHERE id=?').get(row.reviewer_id) as {username:string}|undefined:undefined;const {before_json,after_json,diff_json,reviewer_id,...safe}=row;return {...safe,reviewer_username:reviewer?.username??null,changes:JSON.parse(diff_json)};}
  pending(albumId:string){const row=this.store.db.prepare("SELECT * FROM album_change_requests WHERE album_id=? AND status='pending'").get(albumId) as Row|undefined;return row?this.message(row):null;}
  list(user:ContributorUser){this.active(user);const rows=(user.role==='admin'?this.store.db.prepare('SELECT * FROM album_change_requests ORDER BY created_at DESC,id DESC').all():this.store.db.prepare('SELECT * FROM album_change_requests WHERE user_id=? ORDER BY created_at DESC,id DESC').all(user.id)) as Row[];return rows.map(r=>this.message(r));}
  validateReason(reason:unknown):asserts reason is string{if(typeof reason!=='string'||reason.length>2000)throw new StoreError('理由请使用不超过 2000 字的文字');}
  private insert(user:{id:string;username:string},album:Album,kind:'content'|'delete',reason:string,before:Album|null,legacy=false){
    const id=randomUUID(),changes=kind==='content'?albumDifferences(before,album):[{path:'album.delete',label:'整张专辑及全部版本',before:`${album.title||'未命名专辑'} · ${album.editions.length} 个版本`,after:'批准后从目录隐藏（文件和历史保留）'}];
    this.store.db.prepare("INSERT INTO album_change_requests(id,album_id,user_id,username,kind,album_title,reason,status,album_revision,before_json,after_json,diff_json,created_at,legacy) VALUES(?,?,?,?,?,?,?,'pending',?,?,?,?,?,?)").run(id,album.id,user.id,user.username,kind,album.title,reason.trim(),album.revision,before?JSON.stringify(before):null,JSON.stringify(album),JSON.stringify(changes),Date.now(),legacy?1:0);
    return this.message(this.store.db.prepare('SELECT * FROM album_change_requests WHERE id=?').get(id) as Row);
  }
  recordContent(user:ContributorUser,album:Album,reason:string){this.active(user);this.validateReason(reason);if(this.pending(album.id))throw new StoreError('已有申请正在审核，请先处理后再提交',409);const row=this.store.db.prepare('SELECT published_json FROM albums WHERE id=?').get(album.id) as {published_json:string|null};return this.insert(user,album,'content',reason,row.published_json?JSON.parse(row.published_json):null);}
  requestDelete(user:ContributorUser,albumId:string,expected:number,reason:string){
    this.validateReason(reason);if(!Number.isSafeInteger(expected)||expected<0)throw new StoreError('缺少修订号');const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{
      const album=this.accessible(user,albumId);if(album.deletedAt)throw new StoreError('专辑已移除',409);if(album.revision!==expected)throw new StoreError('记录已更新，请重新载入',409);if(this.pending(albumId))throw new StoreError('已有申请正在审核，请先处理后再提交',409);
      const request=this.insert(user,album,'delete',reason,album);this.identity.audit(user,'request-album-delete',request.id);db.exec('COMMIT');return request;
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  review(admin:ContributorUser,id:string,decision:'approved'|'rejected',expected:number,note=''){
    this.identity.requireAdmin(admin);if(!['approved','rejected'].includes(decision)||!Number.isSafeInteger(expected)||typeof note!=='string'||note.length>2000)throw new StoreError('审核信息无效');
    const db=this.store.db;
    const checked=()=>{this.identity.requireAdmin(admin);const r=db.prepare('SELECT * FROM album_change_requests WHERE id=?').get(id) as Row|undefined;if(!r)throw new StoreError('申请不存在',404);if(r.status!=='pending'||r.revision!==expected)throw new StoreError('申请已更新，请刷新后再审核',409);if(decision==='approved')this.validateReason(r.reason);return r;};
    const request=checked(),album=this.store.get(request.album_id);if(!album)throw new StoreError('专辑不存在',404);
    const finish=()=>{db.prepare('UPDATE album_change_requests SET status=?,reviewed_at=?,reviewer_id=?,admin_note=?,revision=revision+1 WHERE id=?').run(decision,Date.now(),admin.id,note.trim(),id);this.identity.audit(admin,'album-request-'+decision,id);};
    if(decision==='approved'){
      const updated=this.store.transition(album.id,request.kind==='delete'?'delete':'approve',request.album_revision,true,note,()=>{const r=checked(),current=this.store.get(r.album_id);if(!current||current.deletedAt||current.revision!==r.album_revision||JSON.stringify(current)!==r.after_json)throw new StoreError('资料已发生变化，请拒绝此申请后重新提交',409);},finish);
      return {album:updated,request:this.message(db.prepare('SELECT * FROM album_change_requests WHERE id=?').get(id) as Row)};
    }
    if(request.kind==='content'&&album.status==='pending-review'&&!album.deletedAt){const updated=this.store.transition(album.id,'reject',album.revision,true,note,checked,finish);return {album:updated,request:this.message(db.prepare('SELECT * FROM album_change_requests WHERE id=?').get(id) as Row)};}
    db.exec('BEGIN IMMEDIATE');try{checked();finish();db.exec('COMMIT');return {album:this.store.get(album.id)!,request:this.message(db.prepare('SELECT * FROM album_change_requests WHERE id=?').get(id) as Row)};}catch(e){db.exec('ROLLBACK');throw e;}
  }
}
