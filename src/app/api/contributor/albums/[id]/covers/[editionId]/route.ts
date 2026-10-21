import { albumStore,StoreError } from '@/lib/album-store';
import { guardApi,apiError } from '@/lib/local-access';
import { editionCover } from '@/lib/edition-hierarchy';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string;editionId:string}>}){
  try{
    guardApi(req);
    const {id,editionId}=await params,store=albumStore(),album=store.get(id);
    if(!album||album.deletedAt||!album.editions.some(e=>e.id===editionId))throw new StoreError('封面不存在',404);
    const cover=editionCover(album.media,editionId);
    if(!cover?.storageKey)throw new StoreError('封面不存在',404);
    const file=store.file(cover.storageKey);
    return new Response(new Uint8Array(file.bytes),{headers:{'Content-Type':file.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(e){return apiError(e);}
}
