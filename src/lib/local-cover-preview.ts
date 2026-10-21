import type { Album,PublicAlbum } from './types';
import { editionCover } from './edition-hierarchy';
export type CatalogueAlbum=PublicAlbum & {localCovers?:Record<string,{url:string;alt:string}|null>};
// Local browsing may preview current covers without changing the published snapshot.
export function withLocalCoverPreviews(published:PublicAlbum,working:Album|null):CatalogueAlbum{
  if(!working||working.id!==published.id||working.deletedAt)return published;
  return {...published,localCovers:Object.fromEntries(published.editions.map(e=>{
    const cover=working.editions.some(v=>v.id===e.id)?editionCover(working.media,e.id):undefined;
    return [e.id,cover?.storageKey?{url:`/api/contributor/albums/${working.id}/covers/${e.id}?v=${working.revision}`,alt:cover.displayName||'版本封面'}:null];
  }))};
}
