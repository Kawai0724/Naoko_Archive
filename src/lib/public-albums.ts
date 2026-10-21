import 'server-only';
import { releases } from '@/data/releases';
import { albumStore,archiveDataEnabled } from './album-store';
import { releaseToAlbum, publicAlbum } from './albums';
import { localPublicContext } from './local-access';
import { editionCover } from './edition-hierarchy';
import { withLocalCoverPreviews,type CatalogueAlbum } from './local-cover-preview';
export async function publicAlbums():Promise<CatalogueAlbum[]>{
  if(await localPublicContext()){const store=albumStore();return store.published().map(a=>withLocalCoverPreviews(a,store.get(a.id)));}
  if(archiveDataEnabled())return albumStore().published();
  return releases.map(r=>publicAlbum(releaseToAlbum(r,'')));
}
export function artwork(a:CatalogueAlbum,editionId=a.editions[0]?.id){
  if(editionId&&a.localCovers&&editionId in a.localCovers){const cover=a.localCovers[editionId];return {cover:cover?.url??'',alt:cover?.alt??'版本封面',original:false,local:!!cover};}
  const media=editionCover(a.media,editionId),legacy=releases.find(r=>a.id===`legacy-${r.slug}`&&editionId===`${a.id}-edition`);return {cover:media?.url??legacy?.cover??'',alt:media?.displayName??legacy?.coverAlt??'版本封面',original:!media&&!!legacy,local:false};}
