import { albumStore,StoreError } from '@/lib/album-store';
import { mediaResponse } from '@/lib/media-delivery';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{albumId:string;mediaId:string}>}){
  try{
    const {albumId,mediaId}=await params,store=albumStore(),media=store.publishedMedia(albumId,mediaId);
    return mediaResponse(req,store,media.storageKey!,media.displayName||'media');
  }catch(e){return Response.json({error:'资源不可用'},{status:e instanceof StoreError?e.status:500,headers:{'Cache-Control':'no-store'}});}
}
