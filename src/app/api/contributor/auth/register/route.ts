import { identityStore,requireSameOrigin,sessionCookie } from '@/lib/contributor-auth';
import { jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function POST(req:Request){try{
  requireSameOrigin(req);const b=await jsonBody(req),result=identityStore().register(String(b.username??''),String(b.password??''),String(b.reason??''));
  return Response.json({user:result.user},{status:201,headers:{'Set-Cookie':sessionCookie(req,result.token),'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
