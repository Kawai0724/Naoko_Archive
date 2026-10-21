import { identityStore,requestToken,requireSameOrigin,sessionCookie } from '@/lib/contributor-auth';
import { apiError } from '@/lib/local-access';
export async function POST(req:Request){try{requireSameOrigin(req);identityStore().logout(requestToken(req));return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(req,'',0),'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
