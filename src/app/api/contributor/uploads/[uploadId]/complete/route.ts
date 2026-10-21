import { contributorStore } from '@/lib/contributor-store';
import { ContributorUploads } from '@/lib/contributor-uploads';
import { verifyObject,objectRange } from '@/lib/cos-storage';
import { inspectCloudAudio,verifyImageHeader } from '@/lib/cloud-media';
import { guardApi,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{uploadId:string}>}){try{
  const scope=contributorStore(await guardApi(req)),{uploadId}=await params,uploads=new ContributorUploads(scope),t=uploads.get(uploadId);
  const etag=await verifyObject(t.object_key,t.size,t.mime),range=(start:number,end:number)=>objectRange(t.object_key,start,end,etag);
  const facts=t.kind==='audio'?await inspectCloudAudio(t.size,t.mime,t.name,range):undefined;
  if(t.kind!=='audio')verifyImageHeader(await range(0,Math.min(63,t.size-1)),t.mime);
  // Recheck revision and ownership after the asynchronous COS requests.
  return Response.json(scope.result(uploads.complete(uploadId,facts)));
}catch(e){return apiError(e);}}
