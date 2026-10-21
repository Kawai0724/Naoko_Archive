import { contributorStore } from '@/lib/contributor-store';
import { guardApi,apiError } from '@/lib/local-access';
import { mediaResponse } from '@/lib/media-delivery';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{key:string[]}>}){
  try{
    const scope=contributorStore(await guardApi(req)),{key:parts}=await params,key=parts.join('/');scope.media(key,true);
    const media=scope.get(scope.store.cloudMediaInfo(key)!.album_id).media.find(m=>m.storageKey===key)!;
    return mediaResponse(req,scope.store,key,media.displayName||'audio');
  }catch(e){return apiError(e);}
}
