import { StoreError } from '@/lib/album-store';
import { contributorStore } from '@/lib/contributor-store';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){try{const scope=contributorStore(await guardApi(req)),{id}=await params;return Response.json(scope.result(scope.get(id)),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function PATCH(req:Request,{params}:Context){try{
  const scope=contributorStore(await guardApi(req)),{id}=await params,b=await jsonBody(req);
  if(!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw new StoreError('缺少修订号');
  if(['delete','restore'].includes(b.action)&&b.confirm!==true)throw new StoreError('请确认移除或恢复操作');
  if(b.action==='delete'){const request=scope.requests.requestDelete(scope.user,id,b.expectedRevision,b.reason??'');return Response.json({...scope.result(scope.get(id)),request},{status:202,headers:{'Cache-Control':'no-store'}});}
  const a=['draft','submit'].includes(b.action)?scope.save(b.album,b.action,id,b.expectedRevision,b.reason??''):['approve','reject','delete','restore'].includes(b.action)?scope.transition(id,b.action,b.expectedRevision,typeof b.note==='string'?b.note.slice(0,2000):''):(()=>{throw new StoreError('未知操作');})();
  return Response.json(scope.result(a));
}catch(e){return apiError(e);}}

export async function DELETE(req:Request,{params}:Context){try{
  const scope=contributorStore(await guardApi(req)),{id}=await params,b=await jsonBody(req);
  if(!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw new StoreError('缺少修订号');
  if(b.confirm!==true)throw new StoreError('请确认删除整个专辑及全部版本');
  const request=scope.requests.requestDelete(scope.user,id,b.expectedRevision,b.reason??'');
  return Response.json({...scope.result(scope.get(id)),request},{status:202,headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
