import { albumStore,StoreError } from '@/lib/album-store';
import { privateReadUrl } from '@/lib/cos-storage';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{albumId:string;mediaId:string}>}){
  try{
    const {albumId,mediaId}=await params,a=albumStore().publishedRaw(albumId),m=a?.media.find(m=>m.id===mediaId);
    if(!m?.storageKey||m.type==='audio'||m.rightsStatus!=='licensed-public'||!m.publicationConfirmed)throw new StoreError('不存在',404);
    if(m.storageKey.startsWith('pending/'))return Response.redirect(privateReadUrl(m.storageKey),302);
    const f=albumStore().file(m.storageKey);
    return new Response(new Uint8Array(f.bytes),{headers:{'Content-Type':f.mime,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
  }catch(e){return Response.json({error:'资源不可用'},{status:e instanceof StoreError?e.status:500,headers:{'Cache-Control':'no-store'}});}
}
