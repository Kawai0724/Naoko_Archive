import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { AlbumStore,StoreError } from './album-store';
import { privateReadUrl } from './cos-storage';

export function mediaDisposition(name:string,download:boolean){
  const encoded=encodeURIComponent(name.slice(0,500)).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  return `${download?'attachment':'inline'}; filename*=UTF-8''${encoded}`;
}
export function mediaResponse(req:Request,store:AlbumStore,key:string,name:string){
  const disposition=mediaDisposition(name,new URL(req.url).searchParams.get('download')==='1');
  const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
  if(key.startsWith('pending/'))return new Response(null,{status:302,headers:{...headers,Location:privateReadUrl(key,disposition)}});
  const info=store.fileInfo(key);if(!info)throw new StoreError('文件不存在',404);
  if(!info.mime_type.startsWith('audio/')){const f=store.file(key);return new Response(new Uint8Array(f.bytes),{headers:{...headers,'Content-Type':f.mime,'Content-Disposition':disposition}});}
  const f=store.audioFile(key),range=req.headers.get('range');let start=0,end=f.size-1;
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${f.size}`}});
    if(!match[1])start=Math.max(0,f.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=f.size)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${f.size}`}});
  }
  Object.assign(headers,{'Content-Type':f.mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Content-Disposition':disposition});
  if(range)headers['Content-Range']=`bytes ${start}-${end}/${f.size}`;
  return new Response(Readable.toWeb(createReadStream(f.path,{start,end})) as ReadableStream,{status:range?206:200,headers});
}
