import { guardApi,apiError } from '@/lib/local-access';
export async function POST(req:Request){try{await guardApi(req);return Response.json({error:'请通过 COS 直传接口上传图片'},{status:410});}catch(e){return apiError(e);}}
