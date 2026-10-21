export function isLoopback(host:string|null){if(!host)return false;try{const u=new URL(`http://${host}`);return ['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
export function localAllowed(host:string|null,mode:string|undefined=process.env.NODE_ENV){return mode==='development'&&isLoopback(host);}
export function sameLocalOrigin(host:string|null,protocol:string,origin:string|null){if(!isLoopback(host))return false;try{return !origin||origin===new URL(`${protocol}//${host}`).origin;}catch{return false;}}
