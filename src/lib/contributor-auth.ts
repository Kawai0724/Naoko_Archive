import { albumStore,StoreError } from './album-store';
import { IdentityStore,SESSION_SECONDS } from './identity-store';
export const contributorCookie='naoko_contributor_v2';
export const maxAge=SESSION_SECONDS;
export function identityStore(){const store=new IdentityStore(albumStore().db);store.bootstrap(process.env.CONTRIBUTOR_ADMIN_PASSWORD);return store;}
export function requestToken(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(contributorCookie+'='))?.slice(contributorCookie.length+1);}
export function requireSameOrigin(req:Request){
  const origin=req.headers.get('origin'),host=req.headers.get('host');
  if(!origin||!host)throw new StoreError('请求来源不被允许',403);
  try{const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.host!==host||u.username||u.password)throw new Error();}catch{throw new StoreError('请求来源不被允许',403);}
  if(req.headers.get('sec-fetch-site')==='cross-site')throw new StoreError('请求来源不被允许',403);
}
export function sessionCookie(req:Request,token:string,age=maxAge){
  const host=req.headers.get('host')?.split(':')[0],local=host==='localhost'||host==='127.0.0.1';
  const secure=process.env.CONTRIBUTOR_SECURE_COOKIES!=='0'&&!local;
  return `${contributorCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
}
