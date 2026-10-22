import { albumStore,StoreError } from '@/lib/album-store';
import { guardApi } from '@/lib/local-access';
import { mediaResponse } from '@/lib/media-delivery';
import { identityStore } from '@/lib/contributor-auth';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{albumId:string;mediaId:string}>}){
  try{
    const {albumId,mediaId}=await params,store=albumStore(),media=store.publishedMedia(albumId,mediaId);
    // Only reviewed covers are accessible without a session. Audio remains
    // administrator-only, including Range and download requests.
    if(media.type!=='cover'){
      const user=await guardApi(req);
      if(media.type==='audio')identityStore().requireAdmin(user);
    }
    return mediaResponse(req,store,media.storageKey!,media.displayName||'media');
  }catch(e){return Response.json({error:'资源不可用'},{status:e instanceof StoreError?e.status:500,headers:{'Cache-Control':'no-store'}});}
}
