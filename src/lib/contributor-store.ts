import { albumStore,AlbumStore,StoreError } from './album-store';
import { IdentityStore,type ContributorUser } from './identity-store';
import type { Album } from './types';

// Every Contributor route and server page goes through this policy boundary.
// The underlying album store is also used for public snapshots and migrations.
export class ContributorStore{
  readonly identity:IdentityStore;
  constructor(readonly store:AlbumStore,readonly user:ContributorUser){
    this.identity=new IdentityStore(store.db);
    const current=store.db.prepare("SELECT role FROM contributor_users WHERE id=? AND disabled=0 AND approval_status='approved'").get(user.id) as {role:string}|undefined;
    if(!current||current.role!==user.role)throw new StoreError('请重新登录',401);
  }
  list(){return this.store.list().filter(a=>this.user.role==='admin'||this.identity.owner(a.id)===this.user.id);}
  get(id:string){const a=this.store.get(id);if(!a||this.user.role!=='admin'&&this.identity.owner(id)!==this.user.id)throw new StoreError('记录不存在',404);return a;}
  canDelete(id:string){const a=this.get(id);return this.user.role==='admin'||(a.status!=='pending-review'&&!this.store.db.prepare('SELECT id FROM albums WHERE id=? AND published_json IS NOT NULL').get(id));}
  edit(id:string){const a=this.get(id);if(a.deletedAt)throw new StoreError('记录已移除',404);if(a.status==='pending-review'&&this.user.role!=='admin')throw new StoreError('投稿正在审核，请等待审核结果',409);return a;}
  revisions(id:string){this.get(id);return this.store.revisions(id);}
  save(input:unknown,action:'draft'|'submit',id?:string,expected=0){
    if(id)this.edit(id);
    return this.store.save(input,action,id,expected,this.user.username,undefined,a=>{
      if(!id)this.identity.assign(a.id,this.user);this.identity.audit(this.user,action,a.id);
    });
  }
  transition(id:string,action:'approve'|'reject'|'delete'|'restore',expected:number,note=''){
    const a=this.get(id),admin=this.user.role==='admin';
    const hasPublished=!!this.store.db.prepare('SELECT id FROM albums WHERE id=? AND published_json IS NOT NULL').get(id);
    if(!admin&&(action==='approve'||action==='reject'||a.status==='pending-review'||hasPublished))throw new StoreError('仅管理员可操作',403);
    const result=this.store.transition(id,action,expected,admin,note);this.identity.audit(this.user,action,id);return result;
  }
  media(key:string,audio=false){
    const f=this.store.cloudMediaInfo(key);if(!f||f.mime_type.startsWith('audio/')!==audio)throw new StoreError('文件不存在',404);
    const a=this.get(f.album_id);if(a.deletedAt||!a.media.some(m=>m.storageKey===key))throw new StoreError('文件不存在',404);
    // Full recordings remain administrator-only, including after approval.
    if(audio&&this.user.role!=='admin')throw new StoreError('完整音源仅管理员可访问',403);
    return f;
  }
  result(a:Album){return {album:a,history:this.revisions(a.id)};}
}
export function contributorStore(user:ContributorUser){return new ContributorStore(albumStore(),user);}
