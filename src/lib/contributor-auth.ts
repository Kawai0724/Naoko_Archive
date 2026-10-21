import { createHmac, timingSafeEqual } from 'node:crypto';
export const contributorCookie='naoko_contributor';
const maxAge=60*60*8;
function secret(){const value=process.env.CONTRIBUTOR_SESSION_SECRET;if(!value||value.length<32)throw new Error('缺少 CONTRIBUTOR_SESSION_SECRET（至少 32 个字符）');return value;}
function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url');}
export function createContributorSession(){const payload=Buffer.from(JSON.stringify({role:'admin',exp:Math.floor(Date.now()/1000)+maxAge})).toString('base64url');return `${payload}.${sign(payload)}`;}
export function validContributorSession(value:string|undefined){if(!value)return false;const [payload,signature,...extra]=value.split('.');if(!payload||!signature||extra.length)return false;const expected=sign(payload);if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;try{const parsed=JSON.parse(Buffer.from(payload,'base64url').toString()) as {role?:string;exp?:number};return parsed.role==='admin'&&typeof parsed.exp==='number'&&parsed.exp>Math.floor(Date.now()/1000);}catch{return false;}}
export function checkAdminPassword(value:unknown){const expected=process.env.CONTRIBUTOR_ADMIN_PASSWORD;if(!expected||typeof value!=='string'||value.length!==expected.length)return false;return timingSafeEqual(Buffer.from(value),Buffer.from(expected));}
export { maxAge };
