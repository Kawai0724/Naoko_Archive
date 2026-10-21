import { identityStore } from '@/lib/contributor-auth';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export async function GET(req:Request){try{const user=await guardApi(req,true);return Response.json({user,application:identityStore().application(user)},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{const user=await guardApi(req,true),b=await jsonBody(req),s=identityStore();s.resubmitRegistration(user,String(b.reason??''),b.expectedRevision);return Response.json({application:s.application(user)},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
