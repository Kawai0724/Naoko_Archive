import { randomUUID } from 'node:crypto';
import { StoreError } from './album-store';
const COS=require('cos-nodejs-sdk-v5');
const bucket=process.env.COS_BUCKET||'naoko-media-private-1511974295',region=process.env.COS_REGION||'ap-guangzhou';
function client(){const SecretId=process.env.COS_SECRET_ID,SecretKey=process.env.COS_SECRET_KEY;if(!SecretId||!SecretKey)throw new StoreError('COS 服务尚未配置',503);return new COS({SecretId,SecretKey});}
function call<T>(method:string,params:Record<string,unknown>){return new Promise<T>((resolve,reject)=>client()[method](params,(error:{code?:string;statusCode?:number},result:T)=>error?reject(new StoreError(`COS ${method}: ${error.code||'请求失败'}${error.statusCode?' (HTTP '+error.statusCode+')':''}`,502)):resolve(result)));}
export function pendingKey(albumId:string,extension:string){return `pending/${albumId}/${randomUUID()}.${extension}`;}
export function uploadHeaders(mime:string){return {'Content-Type':mime,'x-cos-forbid-overwrite':'true'};}
export function putUrl(key:string,mime:string){return client().getObjectUrl({Bucket:bucket,Region:region,Key:key,Method:'PUT',Sign:true,Expires:1800,Headers:uploadHeaders(mime)});}
export async function verifyObject(key:string,size:number,mime:string){
  const result=await call<{headers?:Record<string,string>}>('headObject',{Bucket:bucket,Region:region,Key:key}),headers=result.headers??{};
  if(Number(headers['content-length'])!==size)throw new StoreError('COS 文件大小校验失败');
  if(headers['content-type']?.split(';')[0]!==mime)throw new StoreError('COS 文件类型校验失败');
  if(headers['x-cos-version-id']&&headers['x-cos-version-id']!=='null')throw new StoreError('COS 已启用版本控制，禁止覆盖头不会生效；当前上传无法安全确认');
  if(!headers.etag)throw new StoreError('COS 对象缺少校验标识');return headers.etag;
}
export async function objectRange(key:string,start:number,end:number,etag:string){
  const result=await call<{Body:Buffer}>('getObject',{Bucket:bucket,Region:region,Key:key,Range:`bytes=${start}-${end}`,IfMatch:etag});
  return new Uint8Array(result.Body);
}
export function privateReadUrl(key:string,disposition?:string){return client().getObjectUrl({Bucket:bucket,Region:region,Key:key,Method:'GET',Sign:true,Expires:120,...(disposition?{Query:{'response-content-disposition':disposition}}:{})});}
