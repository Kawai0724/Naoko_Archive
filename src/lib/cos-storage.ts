import { randomUUID } from 'node:crypto';
const COS=require('cos-nodejs-sdk-v5');
const bucket=process.env.COS_BUCKET||'naoko-media-private-1511974295',region=process.env.COS_REGION||'ap-guangzhou';
function client(){const SecretId=process.env.COS_SECRET_ID,SecretKey=process.env.COS_SECRET_KEY;if(!SecretId||!SecretKey)throw new Error('缺少 COS_SECRET_ID 或 COS_SECRET_KEY');return new COS({SecretId,SecretKey});}
function call<T>(method:string,params:Record<string,unknown>){return new Promise<T>((resolve,reject)=>client()[method](params,(error:Error,result:T)=>error?reject(error):resolve(result)));}
export function pendingKey(albumId:string,extension:string){return `pending/${albumId}/${randomUUID()}.${extension}`;}
export function putUrl(key:string,mime:string){return client().getObjectUrl({Bucket:bucket,Region:region,Key:key,Method:'PUT',Sign:true,Expires:300,Headers:{'Content-Type':mime}});}
export async function verifyObject(key:string,size:number,mime:string){const result=await call<{headers?:Record<string,string>}>('headObject',{Bucket:bucket,Region:region,Key:key});const headers=result.headers??{};if(Number(headers['content-length'])!==size)throw new Error('COS 文件大小校验失败');if(headers['content-type']&&headers['content-type'].split(';')[0]!==mime)throw new Error('COS 文件类型校验失败');}
export function privateReadUrl(key:string){return client().getObjectUrl({Bucket:bucket,Region:region,Key:key,Method:'GET',Sign:true,Expires:120});}
