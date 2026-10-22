import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, writeFileSync, readFileSync, unlinkSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { releases } from '../data/releases';
import { normalizeAlbum, releaseToAlbum, submissionErrors, changeSummary, publicAlbum, localContributor, emptyMedia, MAX_ALBUM_IMAGES, MAX_IMAGE_BYTES,durationText } from './albums';
import type { Album, AlbumRevision } from './types';
import type { PreparedAudio } from './lossless-audio';
import { readCatalogOrder,sortCatalog } from './catalog-order';
import { migrateAlbumHierarchy } from './edition-hierarchy';

export class StoreError extends Error { constructor(message:string,public status=400){super(message);} }
type Row={working_json:string;published_json:string|null;revision:number};
export class AlbumStore {
  readonly db:DatabaseSync;
  constructor(readonly directory:string){
    mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
    this.db=new DatabaseSync(path.join(directory,'archive.sqlite'));
    chmodSync(path.join(directory,'archive.sqlite'),0o600);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS albums(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,working_json TEXT NOT NULL,published_json TEXT,revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,album_id TEXT NOT NULL,action TEXT NOT NULL,contributor TEXT NOT NULL,created_at TEXT NOT NULL,summary_json TEXT NOT NULL,snapshot_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media_files(storage_key TEXT PRIMARY KEY,album_id TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS cloud_uploads(upload_id TEXT PRIMARY KEY,album_id TEXT NOT NULL,object_key TEXT NOT NULL,display_name TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audio_files(storage_key TEXT PRIMARY KEY,codec TEXT NOT NULL,bit_depth INTEGER NOT NULL,sample_rate INTEGER NOT NULL,channels INTEGER NOT NULL,duration_seconds REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS archive_schema(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    this.db.exec('BEGIN IMMEDIATE');try{
      const count=this.db.prepare('SELECT count(*) n FROM albums').get() as {n:number};
      if(!count.n)for(const r of releases){const a=releaseToAlbum(r,new Date().toISOString());this.db.prepare('INSERT INTO albums VALUES(?,?,?,?,?)').run(a.id,a.slug,JSON.stringify(a),JSON.stringify(a),a.revision);this.history(a,'import',['从原有只读目录导入，版本载体待确认']);}
      if(!this.db.prepare('SELECT key FROM archive_schema WHERE key=?').get('edition-hierarchy-v1')){
        const rows=this.db.prepare('SELECT * FROM albums').all() as (Row&{id:string})[];
        for(const row of rows){
          const original=JSON.parse(row.working_json) as Album,a=migrateAlbumHierarchy(original),published=row.published_json?migrateAlbumHierarchy(JSON.parse(row.published_json)):null;
          if(JSON.stringify(a)!==row.working_json){a.revision++;a.updatedAt=new Date().toISOString();this.history(a,'migrate-editions',['迁移至专辑与版本两级目录，保留原资料与文件']);}
          this.db.prepare('UPDATE albums SET working_json=?,published_json=?,revision=? WHERE id=?').run(JSON.stringify(a),published?JSON.stringify(published):null,a.revision,row.id);
        }
        this.db.prepare('INSERT INTO archive_schema VALUES(?,?)').run('edition-hierarchy-v1','1');
      }
      this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  close(){this.db.close();}
  get(id:string):Album|null{const row=this.db.prepare('SELECT working_json FROM albums WHERE id=?').get(id) as {working_json:string}|undefined;return row?JSON.parse(row.working_json):null;}
  list():Album[]{return sortCatalog((this.db.prepare('SELECT working_json FROM albums').all() as {working_json:string}[]).map(r=>JSON.parse(r.working_json) as Album),readCatalogOrder(this.db));}
  published(){return sortCatalog((this.db.prepare('SELECT published_json,working_json FROM albums WHERE published_json IS NOT NULL').all() as Row[]).filter(r=>!JSON.parse(r.working_json).deletedAt).map(r=>publicAlbum(JSON.parse(r.published_json!))),readCatalogOrder(this.db));}
  publishedRaw(id:string):Album|null{const row=this.db.prepare('SELECT * FROM albums WHERE id=?').get(id) as Row|undefined;return row?.published_json&&!JSON.parse(row.working_json).deletedAt?JSON.parse(row.published_json):null;}
  publishedMedia(albumId:string,mediaId:string){
    const album=this.publishedRaw(albumId),media=album?.media.find(m=>m.id===mediaId),file=media?.storageKey?this.cloudMediaInfo(media.storageKey):null;
    if(!media?.storageKey||!file||file.album_id!==albumId||(media.type==='audio')!==file.mime_type.startsWith('audio/')||media.type==='audio'&&!this.audioInfo(media.storageKey))throw new StoreError('文件不存在',404);
    return media;
  }
  revisions(id:string):AlbumRevision[]{return (this.db.prepare('SELECT * FROM revisions WHERE album_id=? ORDER BY id DESC').all(id) as {id:number;album_id:string;action:string;contributor:string;created_at:string;summary_json:string;snapshot_json:string}[]).map(r=>({id:r.id,albumId:r.album_id,action:r.action,contributor:r.contributor,createdAt:r.created_at,summary:JSON.parse(r.summary_json),snapshot:JSON.parse(r.snapshot_json)}));}
  private history(a:Album,action:string,summary:string[]){this.db.prepare('INSERT INTO revisions(album_id,action,contributor,created_at,summary_json,snapshot_json) VALUES(?,?,?,?,?,?)').run(a.id,action,a.contributor,a.updatedAt,JSON.stringify(summary),JSON.stringify(a));}
  save(input:unknown,action:'draft'|'submit',id?:string,expected=0,contributor=localContributor,beforePersist?:()=>void,afterPersist?:(a:Album)=>void):Album{
    this.db.exec('BEGIN IMMEDIATE');try{
      beforePersist?.();const a=this.persist(input,action,id,expected,undefined,contributor);afterPersist?.(a);
      this.db.exec('COMMIT');return a;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  private persist(input:unknown,action:'draft'|'submit',id?:string,expected=0,newId:string=randomUUID(),contributor=localContributor):Album{
    const a=normalizeAlbum(input),before=id?this.get(id):null;
    if(id&&!before)throw new StoreError('记录不存在',404);
    if(before?.deletedAt)throw new StoreError('记录已移除，请先恢复');
    if((before?.revision??0)!==expected)throw new StoreError('记录已在另一页面修改，请重新载入后再保存',409);
    a.id=before?.id??newId;a.slug=before?.slug??`album-${a.id}`;
    a.contributor=before?.contributor??contributor;a.createdAt=before?.createdAt??new Date().toISOString();a.updatedAt=new Date().toISOString();a.revision=(before?.revision??0)+1;
    a.status=action==='submit'?'pending-review':'draft';
    a.media.forEach(m=>{m.albumId=a.id;if(m.storageKey){const f=this.fileInfo(m.storageKey)??this.cloudMediaInfo(m.storageKey);if(!f||f.album_id!==a.id||(m.type==='audio')!==f.mime_type.startsWith('audio/'))throw new StoreError('媒体文件引用无效');m.mimeType=f.mime_type;m.size=f.size;if(m.type==='audio'){const facts=this.audioInfo(m.storageKey);if(!facts)throw new StoreError('音源文件引用无效');m.codec=facts.codec;m.bitDepth=facts.bit_depth;m.sampleRate=facts.sample_rate;m.channels=facts.channels;m.durationSeconds=facts.duration_seconds;m.rightsStatus='private';m.publicationConfirmed=false;}}});
    if(action==='submit'){const errors=submissionErrors(a);if(errors.length)throw new StoreError(errors.join('；'));}
    if(before)this.db.prepare('UPDATE albums SET working_json=?,revision=? WHERE id=?').run(JSON.stringify(a),a.revision,a.id);
    else this.db.prepare('INSERT INTO albums VALUES(?,?,?,NULL,?)').run(a.id,a.slug,JSON.stringify(a),a.revision);
    this.history(a,action,changeSummary(before,a));return a;
  }
  attachImages(input:unknown,files:{name:string;bytes:Buffer}[],id?:string,expected=0,replaceId?:string,type:'cover'|'scan'='scan',editionId?:string):Album{
    const a=normalizeAlbum(input),target=replaceId?a.media.find(m=>m.id===replaceId):null,scope=editionId??target?.relatedEditionId??null;
    if(scope&&!a.editions.some(e=>e.id===scope))throw new StoreError('版本不存在');
    if(target&&target.relatedEditionId!==scope)throw new StoreError('不能替换其他版本的图片');
    if(!files.length||files.length>MAX_ALBUM_IMAGES)throw new StoreError(`每次请选择 1–${MAX_ALBUM_IMAGES} 张图片`);
    if(replaceId&&(!target||target.type==='audio'||files.length!==1))throw new StoreError('请选择一张图片替换有效的图片记录');
    if(a.media.filter(m=>m.type!=='audio'&&m.relatedEditionId===scope).length+(target?0:files.length)>MAX_ALBUM_IMAGES)throw new StoreError(`每个版本最多提交 ${MAX_ALBUM_IMAGES} 张图片（封面、歌词纸和内页合计）`);
    const albumId=id??randomUUID(),created:string[]=[];
    this.db.exec('BEGIN IMMEDIATE');try{
      const before=id?this.get(id):null;
      if(id&&!before)throw new StoreError('记录不存在',404);
      if(before?.deletedAt)throw new StoreError('记录已移除，请先恢复');
      if((before?.revision??0)!==expected)throw new StoreError('记录已在另一页面修改，请重新载入后再上传',409);
      for(const file of files){
        const stored=this.writeImage(albumId,file.bytes);created.push(stored.storageKey);
        if(target)Object.assign(target,stored,{displayName:file.name,rightsStatus:'private',publicationConfirmed:false});
        else a.media.push({...emptyMedia(albumId),...stored,type,displayName:file.name,relatedEditionId:scope});
      }
      const saved=this.persist(a,'draft',id,expected,albumId);
      this.db.exec('COMMIT');return saved;
    }catch(e){
      this.db.exec('ROLLBACK');
      for(const key of created)try{unlinkSync(path.join(this.directory,'private-media',key));}catch{}
      throw e;
    }
  }
  createCloudUpload(albumId:string,name:string,mime:string,size:number){const id=randomUUID(),key=`pending/${albumId}/${randomUUID()}.${mime==='image/jpeg'?'jpg':mime.split('/')[1]}`;this.db.prepare('INSERT INTO cloud_uploads VALUES(?,?,?,?,?,?,?,?)').run(id,albumId,key,name,mime,size,'authorized',new Date().toISOString());return {id,key};}
  cloudUpload(id:string){return this.db.prepare('SELECT * FROM cloud_uploads WHERE upload_id=?').get(id) as {upload_id:string;album_id:string;object_key:string;display_name:string;mime_type:string;size:number;status:string}|undefined;}
  confirmCloudImage(uploadId:string,expected:number,editionId:string,type:'cover'|'scan'){const row=this.db.prepare('SELECT * FROM cloud_uploads WHERE upload_id=?').get(uploadId) as {album_id:string;object_key:string;display_name:string;mime_type:string;size:number;status:string}|undefined;if(!row||row.status!=='authorized')throw new StoreError('上传记录无效');const a=this.get(row.album_id);if(!a||a.revision!==expected||!a.editions.some(e=>e.id===editionId))throw new StoreError('专辑已更新，请重新上传',409);if(a.media.filter(m=>m.type!=='audio'&&m.relatedEditionId===editionId).length>=MAX_ALBUM_IMAGES)throw new StoreError(`每个版本最多提交 ${MAX_ALBUM_IMAGES} 张图片`);this.db.prepare('INSERT INTO media_files VALUES(?,?,?,?)').run(row.object_key,a.id,row.mime_type,row.size);a.media.push({...emptyMedia(a.id),type,displayName:row.display_name,storageKey:row.object_key,mimeType:row.mime_type,size:row.size,relatedEditionId:editionId,rightsStatus:'private',publicationConfirmed:false});const saved=this.save(a,'draft',a.id,expected);this.db.prepare("UPDATE cloud_uploads SET status='completed' WHERE upload_id=?").run(uploadId);return saved;}
  audioInfo(key:string){return this.db.prepare('SELECT * FROM audio_files WHERE storage_key=?').get(key) as {codec:string;bit_depth:number;sample_rate:number;channels:number;duration_seconds:number}|undefined;}
  attachAudio(id:string,expected:number,prepared:PreparedAudio,target:string,replaceId?:string,editionId?:string):Album{
    const key=`${randomUUID()}.${prepared.facts.extension}`,destination=path.join(this.directory,'private-media',key);let moved=false;
    this.db.exec('BEGIN IMMEDIATE');try{
      const a=this.get(id);if(!a||a.deletedAt)throw new StoreError('记录不存在或已移除',404);
      if(a.revision!==expected)throw new StoreError('上传期间记录已被修改，请重新载入后重试',409);
      const edition=editionId?a.editions.find(e=>e.id===editionId):null;if(editionId&&!edition)throw new StoreError('版本不存在');
      const tracks=edition?edition.tracks:a.tracks;
      let trackId:string|null=null;
      if(target!=='album'){
        if(!tracks.some(t=>t.id===target))throw new StoreError('关联曲目已不存在，请重新选择');trackId=target;
      }
      const previous=replaceId?a.media.find(m=>m.id===replaceId&&m.type==='audio'):null;
      if(replaceId&&!previous)throw new StoreError('音源记录已不存在');
      if(previous&&previous.relatedEditionId!==(editionId??null))throw new StoreError('不能替换其他版本的音源');
      renameSync(prepared.temporaryPath,destination);moved=true;
      const f=prepared.facts;
      this.db.prepare('INSERT INTO media_files VALUES(?,?,?,?)').run(key,id,f.mimeType,f.size);
      this.db.prepare('INSERT INTO audio_files VALUES(?,?,?,?,?,?)').run(key,f.codec,f.bitDepth,f.sampleRate,f.channels,f.durationSeconds);
      const media={...(previous??emptyMedia(id)),storageKey:key,type:'audio' as const,displayName:prepared.name,audioScope:target==='album'?'album' as const:'track' as const,relatedTrackId:trackId,relatedEditionId:editionId??null,rightsStatus:'private' as const,publicationConfirmed:false};
      if(previous)a.media=a.media.map(m=>m.id===previous.id?media:m);else a.media.push(media);
      if(trackId){const track=tracks.find(t=>t.id===trackId)!;if(track.durationSeconds==null){track.durationSeconds=Math.round(f.durationSeconds);track.durationText=durationText(track.durationSeconds);}}
      if(edition)edition.trackIds=tracks.map(t=>t.id);
      const saved=this.persist(a,'draft',id,expected);this.db.exec('COMMIT');return saved;
    }catch(e){this.db.exec('ROLLBACK');try{unlinkSync(moved?destination:prepared.temporaryPath);}catch{}throw e;}
  }
  audioFile(key:string){const info=this.fileInfo(key);if(!info?.mime_type.startsWith('audio/')||!this.audioInfo(key))throw new StoreError('音源不存在',404);const filePath=path.join(this.directory,'private-media',key);try{if(statSync(filePath).size!==info.size)throw new Error();}catch{throw new StoreError('音源文件已缺失或被改动',404);}return {path:filePath,mime:info.mime_type,size:info.size};}
  transition(id:string,action:'approve'|'reject'|'delete'|'restore',expected:number,admin:boolean,note='',beforeTransition?:()=>void,afterTransition?:()=>void):Album{
    this.db.exec('BEGIN IMMEDIATE');try{
      beforeTransition?.();
      const a=this.get(id);if(!a)throw new StoreError('记录不存在',404);
      if(a.revision!==expected)throw new StoreError('记录已更新，请重新载入',409);
      const hasPublished=!!this.db.prepare('SELECT id FROM albums WHERE id=? AND published_json IS NOT NULL').get(id);
      if((action==='approve'||action==='reject'||hasPublished&&(action==='delete'||action==='restore'))&&!admin)throw new StoreError('此操作需要管理员权限',403);
      if(action==='approve'||action==='reject'){if(a.status!=='pending-review'||a.deletedAt)throw new StoreError('只有待审核记录可以审核');}
      if(action==='approve'){const errors=submissionErrors(a);if(errors.length)throw new StoreError(errors.join('；'));a.status='published';}
      if(action==='reject')a.status='rejected';
      if(action==='delete')a.deletedAt=new Date().toISOString();if(action==='restore')a.deletedAt=null;
      a.updatedAt=new Date().toISOString();a.revision++;a.changeNote=note||a.changeNote;
      this.db.prepare('UPDATE albums SET working_json=?,revision=? WHERE id=?').run(JSON.stringify(a),a.revision,id);
      if(action==='approve')this.db.prepare('UPDATE albums SET published_json=? WHERE id=?').run(JSON.stringify(a),id);
      this.history(a,action,[{approve:'管理员审核批准，更新公开快照',reject:'已拒绝，退回修改',delete:'移除记录（保留历史，可恢复）',restore:'恢复记录'}[action],...(note?[note]:[])]);
      afterTransition?.();
      this.db.exec('COMMIT');return a;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  fileInfo(key:string){if(!/^[\w-]+\.(png|jpg|webp|flac|wav|aiff|m4a)$/.test(key))return null;return this.db.prepare('SELECT * FROM media_files WHERE storage_key=?').get(key) as {storage_key:string;album_id:string;mime_type:string;size:number}|undefined;}
  cloudMediaInfo(key:string){return this.db.prepare('SELECT * FROM media_files WHERE storage_key=?').get(key) as {storage_key:string;album_id:string;mime_type:string;size:number}|undefined;}
  private writeImage(albumId:string,bytes:Buffer){
    if(bytes.length>MAX_IMAGE_BYTES)throw new StoreError('图片上限为 10 MB',413);
    const kind=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
    if(!kind)throw new StoreError('仅支持真实 PNG、JPEG 或 WebP 图片；音频仅登记元数据');
    const key=`${randomUUID()}.${kind}`,dir=path.join(this.directory,'private-media');mkdirSync(dir,{recursive:true,mode:0o700});
    writeFileSync(path.join(dir,key),bytes,{mode:0o600,flag:'wx'});
    const mime=kind==='jpg'?'image/jpeg':`image/${kind}`;
    try{this.db.prepare('INSERT INTO media_files VALUES(?,?,?,?)').run(key,albumId,mime,bytes.length);}catch(e){unlinkSync(path.join(dir,key));throw e;}return {storageKey:key,mimeType:mime,size:bytes.length};
  }
  file(key:string){const info=this.fileInfo(key);if(info?.mime_type.startsWith('audio/'))throw new StoreError('请使用受保护的音源接口',403);if(!info)throw new StoreError('文件不存在',404);return {bytes:readFileSync(path.join(this.directory,'private-media',key)),mime:info.mime_type};}
}
const stores=new Map<string,AlbumStore>();
// Production only uses a separately provisioned data directory when this flag is
// set. This prevents a deployment from silently creating or serving a database
// from the application checkout.
export function archiveDataEnabled(){return process.env.NODE_ENV==='development'||(process.env.ARCHIVE_PUBLIC_DATA==='1'&&!!process.env.ARCHIVE_DATA_DIR);}
export function albumStore(){
  if(!archiveDataEnabled())throw new StoreError('资料库尚未配置',404);
  const dir=path.resolve(/*turbopackIgnore: true*/ process.env.ARCHIVE_DATA_DIR||path.join(process.cwd(),'data'));
  let store=stores.get(dir);if(!store){store=new AlbumStore(dir);stores.set(dir,store);}return store;
}
