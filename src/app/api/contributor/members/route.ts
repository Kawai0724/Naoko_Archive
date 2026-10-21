import { guardApi,jsonBody,apiError } from '@/lib/local-access';
import { identityStore } from '@/lib/contributor-auth';
import { StoreError } from '@/lib/album-store';
export async function GET(req:Request){try{const user=await guardApi(req),s=identityStore();return Response.json({members:s.publicMembers(),application:s.adminApplication(user),...(user.role==='admin'?s.adminData(user):{})},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{const user=await guardApi(req),b=await jsonBody(req);if(b.action!=='apply-admin')throw new StoreError('未知操作');identityStore().requestAdmin(user,b.reason,b.expectedRevision);return Response.json({ok:true},{status:201,headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
