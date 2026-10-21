import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { albumStore,StoreError } from '@/lib/album-store';
import { guardApi,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{key:string}>}){
  try{
    guardApi(req);const {key}=await params,f=albumStore().audioFile(key),range=req.headers.get('range');
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
