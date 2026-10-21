import { contributorCookie } from '@/lib/contributor-auth';
export async function POST(){const response=Response.json({ok:true});response.headers.append('Set-Cookie',`${contributorCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);return response;}
