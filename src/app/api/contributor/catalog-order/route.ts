import { albumStore,StoreError } from '@/lib/album-store';
import { CatalogOrderStore } from '@/lib/catalog-order-store';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function GET(req:Request){try{const user=await guardApi(req),order=new CatalogOrderStore(albumStore());return Response.json({state:order.state(),requests:order.list(user),userId:user.id,admin:user.role==='admin'},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{
  const user=await guardApi(req),body=await jsonBody(req),order=new CatalogOrderStore(albumStore());
  if(body.action==='submit'){const id=order.submit(user,body.mode,body.ids,body.expectedRevision,body.fingerprint,body.reason??'');return Response.json({id},{status:201});}
  if(body.action==='review'){order.review(user,String(body.id),body.decision,body.expectedRevision,body.note??'');return Response.json({ok:true});}
  throw new StoreError('未知操作');
}catch(e){return apiError(e);}}
