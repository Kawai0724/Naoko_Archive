import { createHash,randomUUID } from 'node:crypto';
import { StoreError,type AlbumStore } from './album-store';
import { IdentityStore,type ContributorUser } from './identity-store';
import { albumReleaseDate,compareAlbumReleaseDate } from './albums';
import { readCatalogOrder,type CatalogOrderMode,type CatalogOrderSnapshot } from './catalog-order';
export type CatalogOrderRequest={id:string;user_id:string;username:string;before:CatalogOrderSnapshot;after:CatalogOrderSnapshot;reason:string;status:'pending'|'approved'|'rejected';admin_note:string;created_at:number;reviewed_at:number|null;revision:number};
type RequestRow=Omit<CatalogOrderRequest,'before'|'after'>&{before_json:string;after_json:string;base_revision:number;fingerprint:string};
export class CatalogOrderStore{
  readonly identity:IdentityStore;
  constructor(readonly store:AlbumStore){
    this.identity=new IdentityStore(store.db);
    store.db.exec(`CREATE TABLE IF NOT EXISTS catalog_order(id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL CHECK(mode IN ('release-date','manual')),ids_json TEXT NOT NULL,revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_order_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES contributor_users(id),before_json TEXT NOT NULL,after_json TEXT NOT NULL,base_revision INTEGER NOT NULL,fingerprint TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),admin_note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,reviewed_at INTEGER,reviewer_id TEXT,revision INTEGER NOT NULL DEFAULT 1);`);
  }
  private active(user:ContributorUser){if(!this.store.db.prepare("SELECT id FROM contributor_users WHERE id=? AND role=? AND approval_status='approved' AND disabled=0 AND closed_at IS NULL").get(user.id,user.role))throw new StoreError('账号尚未获准参与共建',403);}
  state(){
    const config=readCatalogOrder(this.store.db),published=this.store.published();
    const fingerprint=createHash('sha256').update(JSON.stringify(published.map(a=>[a.id,a.revision]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))).digest('hex');
    return {...config,fingerprint,albums:published.map(a=>({id:a.id,title:a.title,date:albumReleaseDate(a)?.value??null}))};
  }
  list(user:ContributorUser):CatalogOrderRequest[]{
    this.active(user);const sql='SELECT r.*,u.username FROM catalog_order_requests r JOIN contributor_users u ON u.id=r.user_id';
    const rows=(user.role==='admin'?this.store.db.prepare(sql+' ORDER BY r.created_at DESC').all():this.store.db.prepare(sql+' WHERE r.user_id=? ORDER BY r.created_at DESC').all(user.id)) as RequestRow[];
    return rows.map(r=>({id:r.id,user_id:r.user_id,username:r.username,before:JSON.parse(r.before_json),after:JSON.parse(r.after_json),reason:r.reason,status:r.status,admin_note:r.admin_note,created_at:r.created_at,reviewed_at:r.reviewed_at,revision:r.revision}));
  }
  submit(user:ContributorUser,mode:CatalogOrderMode,ids:unknown,expected:number,fingerprint:unknown,reason:unknown){
    if(!['release-date','manual'].includes(mode)||!Array.isArray(ids)||ids.length>2000||ids.some(id=>typeof id!=='string'||id.length>100)||new Set(ids).size!==ids.length||!Number.isSafeInteger(expected)||typeof fingerprint!=='string'||typeof reason!=='string'||reason.length>2000)throw new StoreError('专辑排序申请无效');
    const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{
      this.active(user);const current=this.state();
      if(current.revision!==expected||current.fingerprint!==fingerprint)throw new StoreError('唱片目录已更新，请刷新后重新调整',409);
      const available=new Map(current.albums.map(a=>[a.id,a]));
      if(ids.length!==available.size||ids.some(id=>!available.has(id)))throw new StoreError('只能调整当前已发布专辑，不能添加、隐藏或删除专辑');
      if(db.prepare("SELECT id FROM catalog_order_requests WHERE user_id=? AND status='pending'").get(user.id))throw new StoreError('已有专辑排序申请待审核',409);
      const ordered=mode==='manual'?ids as string[]:this.store.published().sort(compareAlbumReleaseDate).map(a=>a.id);
      if(mode===current.mode&&ordered.join()===current.albums.map(a=>a.id).join())throw new StoreError('专辑顺序未改变');
      const before:CatalogOrderSnapshot={mode:current.mode,albums:current.albums},after:CatalogOrderSnapshot={mode,albums:ordered.map(id=>available.get(id)!)};
      const id=randomUUID();db.prepare("INSERT INTO catalog_order_requests(id,user_id,before_json,after_json,base_revision,fingerprint,reason,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?)").run(id,user.id,JSON.stringify(before),JSON.stringify(after),current.revision,current.fingerprint,reason.trim(),Date.now());
      this.identity.audit(user,'catalog-order-submit',id);db.exec('COMMIT');return id;
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  review(admin:ContributorUser,id:string,decision:'approved'|'rejected',expected:number,note:unknown){
    if(!['approved','rejected'].includes(decision)||!Number.isSafeInteger(expected)||typeof note!=='string'||note.length>2000)throw new StoreError('审核信息无效');
    const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{
      this.active(admin);this.identity.requireAdmin(admin);
      const request=db.prepare('SELECT * FROM catalog_order_requests WHERE id=?').get(id) as RequestRow|undefined;
      if(!request)throw new StoreError('申请不存在',404);
      if(request.status!=='pending'||request.revision!==expected)throw new StoreError('申请已更新，请刷新后再审核',409);
      if(decision==='approved'){
        const current=this.state();if(current.revision!==request.base_revision||current.fingerprint!==request.fingerprint)throw new StoreError('唱片目录或排序已更新，请拒绝此申请后重新提交',409);
        const after=JSON.parse(request.after_json) as CatalogOrderSnapshot;
        db.prepare('INSERT INTO catalog_order VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,ids_json=excluded.ids_json,revision=excluded.revision').run(after.mode,JSON.stringify(after.albums.map(a=>a.id)),current.revision+1);
      }
      db.prepare('UPDATE catalog_order_requests SET status=?,admin_note=?,reviewed_at=?,reviewer_id=?,revision=revision+1 WHERE id=?').run(decision,note.trim(),Date.now(),admin.id,id);
      this.identity.audit(admin,'catalog-order-'+decision,id);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
}
