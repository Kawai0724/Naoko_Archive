import type { Album } from './types';
export type AlbumDifference={path:string;label:string;before:string;after:string};
const labels:Record<string,string>={title:'名称',artist:'艺人',type:'作品类型',firstReleaseDate:'首次发行日期',description:'介绍',originalTitle:'原文标题',translatedTitle:'中文译名',aliases:'别名',editionName:'版本名称',catalogNumber:'唱片编号',label:'厂牌',format:'载体',releaseDate:'发行日期',releaseRegion:'发行地区',barcode:'条码',position:'曲序',durationText:'时长',durationSeconds:'时长（秒）',lyricists:'作词',composers:'作曲',arrangers:'编曲',lyricsText:'歌词',lyricsSource:'歌词来源',lyricsRightsStatus:'歌词公开权限',lyricsPublicationConfirmed:'歌词公开确认',displayName:'文件名称',rightsStatus:'公开权限',publicationConfirmed:'公开确认',relatedEditionId:'关联版本',relatedTrackId:'关联曲目',source:'来源',type_media:'媒体类型',mimeType:'文件格式',size:'文件大小',codec:'音频编码',bitDepth:'位深',sampleRate:'采样率',channels:'声道',audioScope:'音源归属',name:'姓名',url:'网址',merchantName:'渠道名称',notes:'备注',editorNotes:'编辑备注',note:'说明',sources:'来源',purchaseLinks:'购买渠道',trackIds:'曲目关联'};
const ignored=new Set(['id','albumId','slug','contributor','revision','createdAt','updatedAt','status','deletedAt','changeNote','storageKey']);
function display(value:unknown):string{if(value==null||value==='')return '—';if(typeof value==='boolean')return value?'是':'否';if(typeof value==='object'){if(Array.isArray(value)){if(value.every(v=>v&&typeof v==='object'&&'name' in v))return value.map(v=>v.name).join('、')||'—';return value.map(v=>display(v)).join('、')||'—';}if('value' in value)return String(value.value);return JSON.stringify(value,null,2);}return String(value);}
export function albumDifferences(before:Album|null,after:Album):AlbumDifference[]{
  const changes:AlbumDifference[]=[];
  function visit(left:unknown,right:unknown,path:string,label:string){
    if(JSON.stringify(left??null)===JSON.stringify(right??null))return;
    if(Array.isArray(left)||Array.isArray(right)){
      const a=Array.isArray(left)?left:[],b=Array.isArray(right)?right:[];
      if(/(?:lyricists|composers|arrangers)$/.test(path)){changes.push({path,label,before:display(a),after:display(b)});return;}
      if([...a,...b].every(v=>v&&typeof v==='object'&&typeof v.id==='string')&&(a.length||b.length)){
        const names=(rows:Record<string,unknown>[])=>rows.map(v=>String(v.editionName||v.title||v.displayName||v.label||v.merchantName||v.name||'未命名'));
        if(a.length===b.length&&a.length>1&&a.map(v=>v.id).sort().join()===b.map(v=>v.id).sort().join()&&a.map(v=>v.id).join()!==b.map(v=>v.id).join())changes.push({path:path+'.order',label:label+'顺序',before:names(a).join(' → '),after:names(b).join(' → ')});
        for(const id of new Set([...a,...b].map(v=>v.id))){const old=a.find(v=>v.id===id),next=b.find(v=>v.id===id),name=next??old,item=`${label}「${String(name.editionName||name.title||name.displayName||name.label||name.merchantName||name.name||'未命名')}」`;
          if(!old||!next)changes.push({path:`${path}.${id}`,label:item,before:old?'已有条目':'—',after:next?'新增条目':'移除条目'});
          visit(old??{},next??{},`${path}.${id}`,item);
        }return;
      }
      changes.push({path,label,before:display(a),after:display(b)});return;
    }
    if((left&&typeof left==='object')||(right&&typeof right==='object')){
      const a=(left??{}) as Record<string,unknown>,b=(right??{}) as Record<string,unknown>;
      if('value' in a||'value' in b){changes.push({path,label,before:display(left),after:display(right)});return;}
      for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
        if(ignored.has(key))continue;
        const child=key==='editions'?'版本':key==='tracks'?'曲目':key==='media'?'媒体':labels[key]||key;
        visit(a[key],b[key],path?path+'.'+key:key,label?label+' · '+child:child);
      }return;
    }
    changes.push({path,label,before:display(left),after:display(right)});
  }
  visit(before,after,'','');
  // A replacement can keep its filename and all metadata; object-key changes still need explicit review.
  for(const media of after.media){const old=before?.media.find(m=>m.id===media.id);if(old&&old.storageKey!==media.storageKey)changes.push({path:`media.${media.id}.replacement`,label:`媒体「${media.displayName||'未命名'}」· 文件替换`,before:old.displayName||'原文件',after:media.displayName||'新文件'});}
  const editions=[...(before?.editions??[]),...after.editions],tracks=[...(before?.tracks??[]),...after.tracks,...editions.flatMap(e=>e.tracks??[])];
  for(const change of changes){if(change.path.endsWith('.relatedEditionId')){change.before=editions.find(e=>e.id===change.before)?.editionName||change.before;change.after=editions.find(e=>e.id===change.after)?.editionName||change.after;}if(change.path.endsWith('.relatedTrackId')){change.before=tracks.find(t=>t.id===change.before)?.title||change.before;change.after=tracks.find(t=>t.id===change.after)?.title||change.after;}}
  return changes;
}
