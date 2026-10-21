import { contributorStore } from '@/lib/contributor-store';
import { ContributorUploads } from '@/lib/contributor-uploads';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
import { putUrl,uploadHeaders } from '@/lib/cos-storage';
export const runtime='nodejs';
export async function POST(req:Request){try{
  const scope=contributorStore(await guardApi(req)),b=await jsonBody(req),t=new ContributorUploads(scope).create(b);
  return Response.json({uploadId:t.id,objectKey:t.object_key,uploadUrl:putUrl(t.object_key,t.mime),headers:uploadHeaders(t.mime),expiresIn:1800},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
