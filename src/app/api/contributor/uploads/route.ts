import { albumStore,StoreError } from '@/lib/album-store';
import { MAX_IMAGE_BYTES } from '@/lib/albums';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
import { putUrl } from '@/lib/cos-storage';
export const runtime='nodejs';
const accepted:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export async function POST(req:Request){try{await guardApi(req);const b=await jsonBody(req),mime=String(b.mimeType||''),name=String(b.name||''),size=Number(b.size),editionId=String(b.editionId||'');if(!accepted[mime]||!name||name.length>500||!Number.isSafeInteger(size)||size<1||size>MAX_IMAGE_BYTES)throw new StoreError('仅支持 PNG、JPEG、WebP 图片，且每张不超过 10 MB');const a=albumStore().get(String(b.albumId));if(!a||a.deletedAt||!a.editions.some(e=>e.id===editionId))throw new StoreError('专辑或发行版本不存在',404);if(a.revision!==b.expectedRevision)throw new StoreError('专辑已更新，请重新载入后上传',409);const upload=albumStore().createCloudUpload(a.id,name,mime,size);return Response.json({uploadId:upload.id,objectKey:upload.key,uploadUrl:putUrl(upload.key,mime),expiresIn:300});}catch(e){return apiError(e);}}
