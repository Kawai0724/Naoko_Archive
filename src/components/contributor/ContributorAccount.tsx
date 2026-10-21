'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function ContributorAccount({username}:{username:string}){const router=useRouter();return <span className="contributor-account"><Link href="/contributor/account" aria-label="账号设置">{username}</Link><button type="button" onClick={async()=>{const r=await fetch('/api/contributor/auth/logout',{method:'POST'});if(r.ok){router.replace('/contributor/login');router.refresh();}}}>退出登录</button></span>;}
