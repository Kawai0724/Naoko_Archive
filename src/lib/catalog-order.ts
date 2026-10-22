import type { DatabaseSync } from 'node:sqlite';
import type { PartialDate } from './types';
import { compareAlbumReleaseDate } from './albums';
export type CatalogOrderMode='release-date'|'manual';
export const catalogOrderLabels={'release-date':'按发行日期','manual':'手动排序'};
export type CatalogOrderConfig={mode:CatalogOrderMode;ids:string[];revision:number};
export type CatalogOrderAlbum={id:string;title:string;date:string|null};
export type CatalogOrderSnapshot={mode:CatalogOrderMode;albums:CatalogOrderAlbum[]};
export type CatalogOrderState=CatalogOrderConfig&{fingerprint:string;albums:CatalogOrderAlbum[]};
export function readCatalogOrder(db:DatabaseSync):CatalogOrderConfig{
  if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_order'").get())return {mode:'release-date',ids:[],revision:0};
  const row=db.prepare('SELECT mode,ids_json,revision FROM catalog_order WHERE id=1').get() as {mode:CatalogOrderMode;ids_json:string;revision:number}|undefined;
  return row?{mode:row.mode,ids:JSON.parse(row.ids_json),revision:row.revision}:{mode:'release-date',ids:[],revision:0};
}
export function sortCatalog<T extends {id:string;firstReleaseDate:PartialDate;editions:{releaseDate:PartialDate}[]}>(albums:T[],order:CatalogOrderConfig):T[]{
  const rank=new Map(order.ids.map((id,index)=>[id,index]));
  return [...albums].sort((a,b)=>{
    if(order.mode==='manual'){const left=rank.get(a.id)??Number.MAX_SAFE_INTEGER,right=rank.get(b.id)??Number.MAX_SAFE_INTEGER;if(left!==right)return left-right;}
    return compareAlbumReleaseDate(a,b);
  });
}
