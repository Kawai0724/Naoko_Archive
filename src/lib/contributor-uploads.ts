import { randomUUID } from 'node:crypto';
import { StoreError } from './album-store';
import { ContributorStore } from './contributor-store';
import { emptyMedia,MAX_ALBUM_IMAGES } from './albums';
import { uploadFormat,type CloudKind } from './cloud-media';
import type { AudioFacts } from './lossless-audio';
export type UploadTicket={id:string;user_id:string;album_id:string;edition_id:string;object_key:string;name:string;mime:string;size:number;kind:CloudKind;target:string;replace_id:string|null;revision:number;expires_at:number;status:string};
export class ContributorUploads{
  constructor(readonly scope:ContributorStore){scope.store.db.exec(`CREATE TABLE IF NOT EXISTS contributor_uploads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,album_id TEXT NOT NULL,edition_id TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,replace_id TEXT,revision INTEGER NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL);`);}
  create(input:{albumId:string;editionId:string;expectedRevision:number;name:string;mimeType:string;size:number;kind:CloudKind;target?:string;replaceId?:string}){
    const {scope}=this,a=scope.edit(input.albumId),edition=a.editions.find(e=>e.id===input.editionId);
    if(!edition)throw new StoreError('发行版本不存在',404);
    if(a.revision!==input.expectedRevision)throw new StoreError('资料已更新，请重新载入',409);
    if(!['cover','scan','audio'].includes(input.kind))throw new StoreError('文件类别无效');
    const format=uploadFormat(input.name,input.mimeType,input.size,input.kind),replacement=input.replaceId?a.media.find(m=>m.id===input.replaceId):null;
    if(input.replaceId&&(!replacement||replacement.relatedEditionId!==edition.id||(replacement.type==='audio')!==(input.kind==='audio')))throw new StoreError('替换目标不正确');
    if(input.kind!=='audio'&&!replacement&&a.media.filter(m=>m.type!=='audio'&&m.relatedEditionId===edition.id).length>=MAX_ALBUM_IMAGES)throw new StoreError('每个版本最多 6 张图片');
    const target=input.target??'album';if(input.kind==='audio'&&target!=='album'&&!edition.tracks.some(t=>t.id===target))throw new StoreError('请选择当前版本已添加的曲目');
    scope.identity.limit('upload:'+scope.user.id,200,86400000);
    const t:UploadTicket={id:randomUUID(),user_id:scope.user.id,album_id:a.id,edition_id:edition.id,object_key:`pending/${a.id}/${randomUUID()}.${format.extension}`,name:input.name,mime:format.mime,size:input.size,kind:input.kind,target,replace_id:input.replaceId??null,revision:a.revision,expires_at:Date.now()+2*60*60*1000,status:'authorized'};
    scope.store.db.prepare('INSERT INTO contributor_uploads VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(t.id,t.user_id,t.album_id,t.edition_id,t.object_key,t.name,t.mime,t.size,t.kind,t.target,t.replace_id,t.revision,t.expires_at,t.status);
    return t;
  }
  get(id:string){
    const t=this.scope.store.db.prepare('SELECT * FROM contributor_uploads WHERE id=?').get(id) as UploadTicket|undefined;
    if(!t||t.user_id!==this.scope.user.id)throw new StoreError('上传记录不存在',404);
    if(t.status!=='authorized'||t.expires_at<Date.now())throw new StoreError('上传授权已完成或过期',409);
    const a=this.scope.edit(t.album_id);if(a.revision!==t.revision)throw new StoreError('资料已更新，请重新选择上传',409);return t;
  }
  complete(id:string,facts?:AudioFacts){
    const t=this.get(id),{scope}=this,a=scope.edit(t.album_id),db=scope.store.db;
    if(t.kind==='audio'&&!facts)throw new StoreError('缺少音源校验信息');
    const m={...emptyMedia(a.id),id:t.replace_id??randomUUID(),relatedEditionId:t.edition_id,type:t.kind,displayName:t.name,storageKey:t.object_key,mimeType:t.mime,size:t.size,...(facts?{codec:facts.codec,bitDepth:facts.bitDepth,sampleRate:facts.sampleRate,channels:facts.channels,durationSeconds:facts.durationSeconds,audioScope:t.target==='album'?'album' as const:'track' as const,relatedTrackId:t.target==='album'?null:t.target}:{}),rightsStatus:'private' as const,publicationConfirmed:false};
    a.media=t.replace_id?a.media.map(x=>x.id===t.replace_id?m:x):[...a.media,m];
    // AlbumStore.save owns the transaction; its precommit callback atomically
    // registers the verified file and consumes this exact upload ticket.
    return scope.store.save(a,'draft',a.id,a.revision,scope.user.username,()=>{
      scope.edit(a.id);
      db.prepare('INSERT INTO media_files VALUES(?,?,?,?)').run(t.object_key,a.id,t.mime,t.size);
      if(facts)db.prepare('INSERT INTO audio_files VALUES(?,?,?,?,?,?)').run(t.object_key,facts.codec,facts.bitDepth,facts.sampleRate,facts.channels,facts.durationSeconds);
      db.prepare("UPDATE contributor_uploads SET status='completed' WHERE id=? AND status='authorized'").run(t.id);
      scope.identity.audit(scope.user,'complete-upload',t.id);
    });
  }
}
