import { contributorStore } from '@/lib/contributor-store';
import { StoreError } from '@/lib/album-store';
import { guardApi,jsonBody,apiError } from '@/lib/local-access';
export const runtime='nodejs';
export async function GET(req:Request){try{const scope=contributorStore(await guardApi(req));return Response.json({albums:scope.list()},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{const scope=contributorStore(await guardApi(req)),b=await jsonBody(req);if(!['draft','submit'].includes(b.action))throw new StoreError('操作不正确');const a=scope.save(b.album,b.action);return Response.json(scope.result(a),{status:201});}catch(e){return apiError(e);}}
