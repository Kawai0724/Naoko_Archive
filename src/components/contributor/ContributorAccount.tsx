'use client';
import { useRouter } from 'next/navigation';
export default function ContributorAccount({username}:{username:string}){const router=useRouter();return <span className="contributor-account">{username}<button type="button" onClick={async()=>{const r=await fetch('/api/contributor/auth/logout',{method:'POST'});if(r.ok){router.replace('/contributor/login');router.refresh();}}}>退出</button></span>;}
