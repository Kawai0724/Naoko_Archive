import { albumStore,StoreError } from '@/lib/album-store';
import { verifyObject } from '@/lib/cos-storage';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{uploadId:string}>}){try{await guardApi(req);const b=await jsonBody(req),{uploadId}=await params,store=albumStore(),row=store.cloudUpload(uploadId);if(!row)throw new StoreError('上传记录不存在',404);await verifyObject(row.object_key,row.size,row.mime_type);if(b.kind!=='cover'&&b.kind!=='scan')throw new StoreError('图片类别无效');const album=store.confirmCloudImage(uploadId,Number(b.expectedRevision),String(b.editionId),b.kind);return Response.json({album,history:store.revisions(album.id)});}catch(e){return apiError(e);}}
