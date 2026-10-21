import { StoreError } from '@/lib/album-store';
import { contributorStore } from '@/lib/contributor-store';
import { guardApi,apiError } from '@/lib/local-access';
import { editionCover } from '@/lib/edition-hierarchy';
import { privateReadUrl } from '@/lib/cos-storage';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string;editionId:string}>}){try{
  const scope=contributorStore(await guardApi(req)),{id,editionId}=await params,a=scope.get(id),m=editionCover(a.media,editionId);
  if(!m?.storageKey)throw new StoreError('封面不存在',404);scope.media(m.storageKey);
  if(m.storageKey.startsWith('pending/'))return new Response(null,{status:302,headers:{Location:privateReadUrl(m.storageKey),'Cache-Control':'no-store'}});
  const f=scope.store.file(m.storageKey);return new Response(new Uint8Array(f.bytes),{headers:{'Content-Type':f.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return apiError(e);}}
