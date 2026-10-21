import { identityStore,requireSameOrigin,sessionCookie } from '@/lib/contributor-auth';
import { jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function POST(req:Request){try{
  requireSameOrigin(req);const b=await jsonBody(req);
  const result=identityStore().login(typeof b.username==='string'?b.username:'',typeof b.password==='string'?b.password:'');
  return Response.json({user:result.user},{headers:{'Set-Cookie':sessionCookie(req,result.token),'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
