import { albumStore } from '@/lib/album-store';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function GET(req:Request){try{await guardApi(req);return Response.json({albums:albumStore().list()},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{await guardApi(req);const b=await jsonBody(req);if(!['draft','submit'].includes(b.action))throw new Error('操作不正确');const album=albumStore().save(b.album,b.action);return Response.json({album,history:albumStore().revisions(album.id)},{status:201});}catch(e){return apiError(e);}}
