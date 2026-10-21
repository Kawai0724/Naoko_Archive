import { albumStore,StoreError } from '@/lib/album-store';
import { identityStore } from '@/lib/contributor-auth';
import { ChangeRequestStore } from '@/lib/change-request-store';
import { ContributorStore } from '@/lib/contributor-store';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export async function GET(req:Request){try{
  const user=await guardApi(req),store=albumStore(),changes=new ChangeRequestStore(store),scope=new ContributorStore(store,user);
  if(user.role==='admin')return Response.json({registrations:identityStore().registrationQueue(user),adminApplications:identityStore().adminApplications(user),albumRequests:scope.requests.list(user),albums:scope.list().filter(a=>!a.deletedAt&&a.status==='pending-review'),changes:changes.list(user),content:changes.content()},{headers:{'Cache-Control':'no-store'}});
  return Response.json({albumRequests:scope.requests.list(user),changes:changes.list(user),content:changes.content()},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
export async function POST(req:Request){try{
  const user=await guardApi(req),b=await jsonBody(req),changes=new ChangeRequestStore(albumStore());
  if(b.action==='site-change'){const id=changes.submit(user,b.field,b.value,b.reason??'',b.expectedRevision);return Response.json({id},{status:201});}
  identityStore().requireAdmin(user);
  if(!['approved','rejected'].includes(b.decision))throw new StoreError('请选择批准或拒绝');
  if(b.action==='review-album-change'){const result=new ContributorStore(albumStore(),user).requests.review(user,String(b.id),b.decision,b.expectedRevision,String(b.note??''));return Response.json(result,{headers:{'Cache-Control':'no-store'}});}
  if(b.action==='registration')identityStore().reviewRegistration(user,String(b.id),b.decision,b.expectedRevision,String(b.note??''));
  else if(b.action==='review-admin-application')identityStore().reviewAdminApplication(user,String(b.id),b.decision,b.expectedRevision,String(b.note??''));
  else if(b.action==='review-site-change')changes.review(user,String(b.id),b.decision,b.expectedRevision,String(b.note??''));
  else throw new StoreError('未知操作');return Response.json({ok:true});
}catch(e){return apiError(e);}}
