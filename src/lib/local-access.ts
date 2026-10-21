import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { StoreError } from './album-store';
import { contributorCookie,identityStore,requestToken,requireSameOrigin } from './contributor-auth';
import { localAllowed } from './local-policy';
export { localAllowed } from './local-policy';
export async function currentContributor(){return identityStore().session((await cookies()).get(contributorCookie)?.value);}
export async function localPage(){const user=await currentContributor();if(!user)redirect('/contributor/login');return {token:'',admin:user.role==='admin',user};}
export async function localPublicContext(){return false;}
export async function guardApi(req:Request){
  if(!['GET','HEAD','OPTIONS'].includes(req.method))requireSameOrigin(req);
  const user=identityStore().session(requestToken(req));if(!user)throw new StoreError('请先登录',401);return user;
}
export async function jsonBody(req:Request){
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new StoreError('请使用 JSON 请求');
  const reader=req.body?.getReader();if(!reader)throw new StoreError('缺少请求内容');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4*1024*1024){await reader.cancel();throw new StoreError('表单超过 4 MB',413);}chunks.push(r.value);}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new StoreError('表单格式错误');}
}
export function apiError(e:unknown){return Response.json({error:e instanceof StoreError?e.message:'操作失败，请重试'}, {status:e instanceof StoreError?e.status:500,headers:{'Cache-Control':'no-store'}});}
