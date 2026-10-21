import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { StoreError } from '@/lib/album-store';
import { contributorStore } from '@/lib/contributor-store';
import { privateReadUrl } from '@/lib/cos-storage';
import { guardApi,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{key:string[]}>}){
  try{
    const scope=contributorStore(await guardApi(req)),{key:parts}=await params,key=parts.join('/');scope.media(key,true);if(key.startsWith('pending/'))return new Response(null,{status:302,headers:{Location:privateReadUrl(key),'Cache-Control':'no-store'}});const f=scope.store.audioFile(key),range=req.headers.get('range');
    let start=0,end=f.size-1;
    if(range){
      const m=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!m||(!m[1]&&!m[2]))throw new StoreError('无效读取范围',416);
      if(!m[1])start=Math.max(0,f.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=f.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${f.size}`,'Cache-Control':'no-store'}});
    }
    const stream=Readable.toWeb(createReadStream(f.path,{start,end}));
    const headers:Record<string,string>={'Content-Type':f.mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment'};
    if(range)headers['Content-Range']=`bytes ${start}-${end}/${f.size}`;
    return new Response(stream as ReadableStream,{status:range?206:200,headers});
  }catch(e){return apiError(e);}
}
