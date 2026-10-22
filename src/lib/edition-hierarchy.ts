import type { Album,AlbumEdition,PublicAlbum } from './types';
import { emptyEdition } from './albums';

// Only used by the one-time storage migration. Keep the original snapshots and files.
export function migrateAlbumHierarchy(input:Album):Album{
  const a=structuredClone(input);
  if(!a.editions.length&&(a.tracks.length||a.media.length))a.editions=[{...emptyEdition(),id:`${a.id}-legacy-edition`,editionName:'待整理版本',tracks:structuredClone(a.tracks),trackIds:a.tracks.map(t=>t.id)}];
  for(const e of a.editions){
    if(!Array.isArray(e.tracks))e.tracks=structuredClone(e.trackIds?.length?a.tracks.filter(t=>e.trackIds.includes(t.id)):a.tracks);
    e.description??=null;e.sources??=structuredClone(a.sources);e.editorNotes??=null;
  }
  if(a.editions[0]&&a.editorNotes&&!a.editions[0].editorNotes)a.editions[0].editorNotes=a.editorNotes;
  if(a.editions[0])for(const m of a.media)if(!m.relatedEditionId)m.relatedEditionId=a.editions[0].id;
  return a;
}
export function editionEditorAlbum(source:Album,editionId:string):Album{
  const a=structuredClone(source),e=a.editions.find(e=>e.id===editionId);
  if(!e)throw new Error('版本不存在');
  return {...a,tracks:e.tracks??[],editions:[e],description:e.description,sources:e.sources??[],editorNotes:e.editorNotes,media:a.media.filter(m=>m.relatedEditionId===editionId)};
}
export function mergeEditionEditor(source:Album,editor:Album,editionId:string):Album{
  if(!source.editions.some(e=>e.id===editionId)||editor.editions.length!==1||editor.editions[0].id!==editionId)throw new Error('版本资料不匹配');
  const e:AlbumEdition={...editor.editions[0],tracks:editor.tracks,trackIds:editor.tracks.map(t=>t.id),description:editor.description,sources:editor.sources,editorNotes:editor.editorNotes};
  return {...source,editionOrder:editor.editionOrder??source.editionOrder??'manual',revision:editor.revision,changeNote:editor.changeNote,editions:source.editions.map(v=>v.id===editionId?e:v),media:[...source.media.filter(m=>m.relatedEditionId!==editionId),...editor.media.map(m=>({...m,relatedEditionId:editionId}))]};
}
export function publicEditionAlbum(a:PublicAlbum,editionId:string):PublicAlbum{
  const e=a.editions.find(e=>e.id===editionId);if(!e)throw new Error('版本不存在');
  return {...a,tracks:e.tracks,editions:[e],description:e.description,sources:e.sources,firstReleaseDate:e.releaseDate,media:a.media.filter(m=>m.relatedEditionId===editionId)};
}
export function editionCover<T extends {type:string;relatedEditionId:string|null}>(media:T[],editionId:string|undefined):T|undefined{
  return editionId?media.find(m=>m.relatedEditionId===editionId&&m.type==='cover'):undefined;
}
