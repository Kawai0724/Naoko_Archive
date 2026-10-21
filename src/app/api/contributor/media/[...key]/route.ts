import { contributorStore } from '@/lib/contributor-store';
import { guardApi,apiError } from '@/lib/local-access';
import { privateReadUrl } from '@/lib/cos-storage';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{key:string[]}>}){try{
  const scope=contributorStore(await guardApi(req)),{key:parts}=await params,key=parts.join('/');scope.media(key);
  if(key.startsWith('pending/'))return new Response(null,{status:302,headers:{Location:privateReadUrl(key),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  const f=scope.store.file(key);return new Response(new Uint8Array(f.bytes),{headers:{'Content-Type':f.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return apiError(e);}}
