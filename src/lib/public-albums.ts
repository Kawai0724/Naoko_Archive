import 'server-only';
import { connection } from 'next/server';
import { releases } from '@/data/releases';
import { albumStore,archiveDataEnabled } from './album-store';
import { releaseToAlbum, publicAlbum,compareAlbumReleaseDate } from './albums';
import { currentContributor,localPublicContext } from './local-access';
import { editionCover } from './edition-hierarchy';
import { withLocalCoverPreviews,type CatalogueAlbum } from './local-cover-preview';
export async function publicAlbums():Promise<CatalogueAlbum[]>{
  await connection();
  if(await localPublicContext()){const store=albumStore();return store.published().map(a=>withLocalCoverPreviews(a,store.get(a.id)));}
  if(archiveDataEnabled()){const member=await currentContributor(),records=albumStore().published();return member?.accountStatus==='approved'?records:records.map(a=>({...a,mediaRequiresLogin:a.media.length>0,media:[]}));}
  return releases.map(r=>publicAlbum(releaseToAlbum(r,''))).sort(compareAlbumReleaseDate);
}
export function artwork(a:CatalogueAlbum,editionId=a.editions[0]?.id){
  if(a.mediaRequiresLogin)return {cover:'',alt:'登录查看封面',original:false,local:false};
  if(editionId&&a.localCovers&&editionId in a.localCovers){const cover=a.localCovers[editionId];return {cover:cover?.url??'',alt:cover?.alt??'版本封面',original:false,local:!!cover};}
  const media=editionCover(a.media,editionId),legacy=releases.find(r=>a.id===`legacy-${r.slug}`&&editionId===`${a.id}-edition`);return {cover:media?.url??legacy?.cover??'',alt:media?.displayName??legacy?.coverAlt??'版本封面',original:!media&&!!legacy,local:false};}
