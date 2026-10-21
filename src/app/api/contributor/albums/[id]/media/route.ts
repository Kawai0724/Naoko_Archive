import { albumStore,StoreError } from '@/lib/album-store';
import { MAX_ALBUM_IMAGES,MAX_IMAGE_BYTES } from '@/lib/albums';
import { guardApi,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guardApi(req);
    if(Number(req.headers.get('content-length'))>MAX_ALBUM_IMAGES*MAX_IMAGE_BYTES+4*1024*1024)throw new StoreError('上传内容过大：最多 6 张，每张不超过 10 MB',413);
    const data=await req.formData(),files=data.getAll('file');
    if(!files.length||files.length>MAX_ALBUM_IMAGES||!files.every(f=>f instanceof File))throw new StoreError('请选择 1–6 张图片');
    if(files.some(f=>f.size>MAX_IMAGE_BYTES))throw new StoreError('每张图片上限为 10 MB',413);
    const raw=data.get('album'),revision=Number(data.get('expectedRevision')),replacement=data.get('replaceId'),kind=data.get('type'),editionId=data.get('editionId');
    if(typeof raw!=='string'||raw.length>4*1024*1024||!Number.isSafeInteger(revision)||revision<0)throw new StoreError('草稿格式错误');
    if(kind!=='cover'&&kind!=='scan')throw new StoreError('请选择封面或歌词纸 / 内页类别');
    if(replacement!==null&&typeof replacement!=='string')throw new StoreError('替换记录格式错误');
    const {id}=await params,store=albumStore();
    const album=store.attachImages(JSON.parse(raw),await Promise.all(files.map(async file=>({name:file.name,bytes:Buffer.from(await file.arrayBuffer())}))),id==='new'?undefined:id,revision,replacement||undefined,kind,typeof editionId==='string'?editionId:undefined);
    return Response.json({album,history:store.revisions(album.id)},{status:id==='new'?201:200});
  }catch(e){return apiError(e);}
}
