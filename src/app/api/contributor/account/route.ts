import { guardApi,jsonBody,apiError } from '@/lib/local-access';
import { identityStore,sessionCookie } from '@/lib/contributor-auth';
import { StoreError } from '@/lib/album-store';

export async function DELETE(req:Request){try{
  const user=await guardApi(req,true),body=await jsonBody(req);
  if(typeof body?.password!=='string'||typeof body?.confirmation!=='string')throw new StoreError('请输入当前密码和用户名确认注销');
  // The target always comes from the session. Reject older clients that specify another account.
  if(body.id!==undefined||body.userId!==undefined)throw new StoreError('只能注销当前登录的账号',403);
  identityStore().closeOwnAccount(user,body.password,body.confirmation);
  return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(req,'',0),'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
