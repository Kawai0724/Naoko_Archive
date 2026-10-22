import { guardApi,jsonBody,apiError } from '@/lib/local-access';
import { identityStore,sessionCookie } from '@/lib/contributor-auth';
import { StoreError } from '@/lib/album-store';
export const runtime='nodejs';

export async function GET(req:Request){try{
  const user=await guardApi(req,true);return Response.json({profile:identityStore().profile(user)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}

export async function PATCH(req:Request){try{
  const user=await guardApi(req,true),body=await jsonBody(req);
  if(body.id!==undefined||body.userId!==undefined)throw new StoreError('只能修改自己的账号',403);
  if(body.action==='profile'){
    if(Object.keys(body).some(k=>!['action','nickname','bio'].includes(k)))throw new StoreError('只能修改昵称和简介');
    return Response.json({profile:identityStore().updateProfile(user,body.nickname,body.bio)},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='password'){
    if(Object.keys(body).some(k=>!['action','currentPassword','newPassword','confirmation'].includes(k)))throw new StoreError('密码修改信息无效');
    if(typeof body.newPassword!=='string'||body.newPassword!==body.confirmation)throw new StoreError('两次输入的新密码不一致');
    identityStore().changePassword(user,body.currentPassword,body.newPassword);
    return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(req,'',0),'Cache-Control':'no-store'}});
  }
  throw new StoreError('账号操作无效');
}catch(e){return apiError(e);}}

export async function DELETE(req:Request){try{
  const user=await guardApi(req,true),body=await jsonBody(req);
  if(typeof body?.password!=='string'||typeof body?.confirmation!=='string')throw new StoreError('请输入当前密码和用户名确认注销');
  // The target always comes from the session. Reject older clients that specify another account.
  if(body.id!==undefined||body.userId!==undefined)throw new StoreError('只能注销当前登录的账号',403);
  identityStore().closeOwnAccount(user,body.password,body.confirmation);
  return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(req,'',0),'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
