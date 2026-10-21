import { albumStore,StoreError } from '@/lib/album-store';
import { guardApi,jsonBody,apiError,adminEnabled } from '@/lib/local-access';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){try{guardApi(req);const {id}=await params,a=albumStore().get(id);if(!a)throw new StoreError('记录不存在',404);return Response.json({album:a,history:albumStore().revisions(id)},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function PATCH(req:Request,{params}:Context){try{guardApi(req);const {id}=await params,b=await jsonBody(req);if(!Number.isInteger(b.expectedRevision))throw new StoreError('缺少修订号');if(['delete','restore'].includes(b.action)&&b.confirm!==true)throw new StoreError('请确认删除或恢复操作');const store=albumStore();const a=['draft','submit'].includes(b.action)?store.save(b.album,b.action,id,b.expectedRevision):['approve','reject','delete','restore'].includes(b.action)?store.transition(id,b.action,b.expectedRevision,adminEnabled(),b.note):(()=>{throw new StoreError('未知操作');})();return Response.json({album:a,history:store.revisions(id)});}catch(e){return apiError(e);}}
