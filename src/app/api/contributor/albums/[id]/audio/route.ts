import { unlink } from 'node:fs/promises';
import { albumStore,StoreError } from '@/lib/album-store';
import { guardApi,apiError } from '@/lib/local-access';
import { receiveAudio,AudioUploadError,type PreparedAudio } from '@/lib/lossless-audio';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  let prepared:PreparedAudio|undefined;
  try{
    guardApi(req);
    const {id}=await params,store=albumStore(),a=store.get(id),expected=Number(req.headers.get('x-expected-revision'));
    if(!a||a.deletedAt)throw new StoreError('请先保存有效草稿',404);
    if(!Number.isSafeInteger(expected)||expected!==a.revision)throw new StoreError('记录已更新，请重新载入后再上传',409);
    const target=req.headers.get('x-audio-target')??'',replaceId=req.headers.get('x-audio-replace')||undefined,editionId=req.headers.get('x-audio-edition')||undefined;
    const edition=editionId?a.editions.find(e=>e.id===editionId):null;if(editionId&&!edition)throw new StoreError('版本不存在');
    const tracks=edition?edition.tracks:a.tracks;
    if(target!=='album'&&!tracks.some(t=>t.id===target))throw new StoreError('请选择整张专辑或当前版本已添加的曲目');
    const name=decodeURIComponent(req.headers.get('x-audio-name')??'');
    prepared=await receiveAudio(store.directory,req.body,name,Number(req.headers.get('content-length')),req.signal);
    const album=store.attachAudio(id,expected,prepared,target,replaceId,editionId);
    return Response.json({album,history:store.revisions(id)});
  }catch(e){return apiError(e instanceof AudioUploadError?new StoreError(e.message,e.status):e);}
  finally{if(prepared)await unlink(prepared.temporaryPath).catch(()=>{});}
}
