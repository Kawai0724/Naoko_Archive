import { guardApi,jsonBody,apiError } from '@/lib/local-access';
import { identityStore } from '@/lib/contributor-auth';
import { StoreError } from '@/lib/album-store';
export async function GET(req:Request){try{const user=await guardApi(req);return Response.json(identityStore().adminData(user),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{
  const user=await guardApi(req),s=identityStore();s.requireAdmin(user);const b=await jsonBody(req);
  if(b.action==='invite'){const invite=s.invite(user);return Response.json({invite},{status:201,headers:{'Cache-Control':'no-store'}});}
  if(b.action==='revoke')s.revoke(user,String(b.id));
  else if(b.action==='disable'&&typeof b.disabled==='boolean')s.disable(user,String(b.id),b.disabled);
  else throw new StoreError('未知操作');return Response.json({ok:true});
}catch(e){return apiError(e);}}
