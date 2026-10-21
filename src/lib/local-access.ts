import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies,headers } from 'next/headers';
import { notFound,redirect } from 'next/navigation';
import { StoreError } from './album-store';
import { isLoopback,localAllowed,sameLocalOrigin } from './local-policy';
import { contributorCookie,validContributorSession } from './contributor-auth';
export { localAllowed } from './local-policy';

const state=globalThis as typeof globalThis & { archiveEditorToken?:string };
export function editorToken(){return state.archiveEditorToken??=randomBytes(32).toString('hex');}
export const adminEnabled=()=>process.env.NODE_ENV==='development'&&process.env.ARCHIVE_LOCAL_ADMIN==='1';
export async function localPage(){const h=await headers();if(process.env.NODE_ENV==='development'&&localAllowed(h.get('host')))return {token:editorToken(),admin:adminEnabled()};const session=(await cookies()).get(contributorCookie)?.value;if(!validContributorSession(session))redirect('/contributor/login');return {token:'',admin:true};}
export async function localPublicContext(){const h=await headers();return process.env.NODE_ENV==='development'&&localAllowed(h.get('host'));}
export async function guardApi(req:Request){
  if(process.env.NODE_ENV!=='development'){if(!validContributorSession(req.headers.get('cookie')?.match(new RegExp(`(?:^|; )${contributorCookie}=([^;]+)`))?.[1]))throw new StoreError('需要管理员登录',401);return;}
  const u=new URL(req.url);if(!localAllowed(req.headers.get('host'))||!isLoopback(u.host))throw new StoreError('本地开发专用接口',404);
  // Next may normalize request.url to localhost; compare with the actual validated Host.
  if(!sameLocalOrigin(req.headers.get('host'),u.protocol,req.headers.get('origin')))throw new StoreError('来源不被允许',403);
  const token=req.headers.get('x-local-editor-token')??'',expected=editorToken();
  if(Buffer.byteLength(token)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))throw new StoreError('请从本机 Contributor 页面打开编辑器',403);
}
export async function jsonBody(req:Request){const body=await req.text();if(body.length>4*1024*1024)throw new StoreError('表单超过 4 MB',413);try{return JSON.parse(body);}catch{throw new StoreError('表单格式错误');}}
export function apiError(e:unknown){return Response.json({error:e instanceof Error?e.message:'操作失败'}, {status:e instanceof StoreError?e.status:400,headers:{'Cache-Control':'no-store'}});}
