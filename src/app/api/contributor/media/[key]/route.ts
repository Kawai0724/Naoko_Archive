import { albumStore } from '@/lib/album-store';
import { guardApi,apiError } from '@/lib/local-access';
import { privateReadUrl } from '@/lib/cos-storage';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{key:string}>}){try{await guardApi(req);const {key}=await params;if(key.startsWith('pending/')){const f=albumStore().cloudMediaInfo(key);if(!f||!f.mime_type.startsWith('image/'))throw new Error('文件不存在');return Response.redirect(privateReadUrl(key),302);}const f=albumStore().file(key);return new Response(new Uint8Array(f.bytes),{headers:{'Content-Type':f.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return apiError(e);}}
