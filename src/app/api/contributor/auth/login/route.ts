import { identityStore,requireSameOrigin,sessionCookie } from '@/lib/contributor-auth';
import { jsonBody,apiError } from '@/lib/local-access';
import { StoreError } from '@/lib/album-store';
export const runtime='nodejs';
export async function POST(req:Request){try{
  requireSameOrigin(req);const b=await jsonBody(req);
  if(b.rememberMe!==undefined&&typeof b.rememberMe!=='boolean')throw new StoreError('保持登录选项无效');
  const result=identityStore().login(typeof b.username==='string'?b.username:'',typeof b.password==='string'?b.password:'',b.rememberMe===true);
  return Response.json({user:result.user},{headers:{'Set-Cookie':sessionCookie(req,result.token,result.maxAge),'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
