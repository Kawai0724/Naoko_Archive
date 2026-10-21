'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
export default function AccessForm({inviteToken,accountClosed=false}:{inviteToken?:string;accountClosed?:boolean}){
  const router=useRouter(),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const r=await fetch('/api/contributor/auth/'+(inviteToken?'accept':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,token:inviteToken})}),data=await r.json();
    if(!r.ok)throw new Error(data.error);router.replace(data.user.accountStatus==='approved'?'/contributor':'/contributor/application');router.refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="contributor-home"><h1>{inviteToken?'接受共建邀请':'登录'}</h1>{accountClosed&&<p role="status" className="editor-message">账号已注销，历史投稿保留。</p>}{inviteToken&&<p className="editor-muted">设置账号后，等待管理员批准即可参与共建。</p>}<form onSubmit={submit} className="access-form"><div className="editor-field"><label htmlFor="contributor-username">用户名</label><input id="contributor-username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,39}"/></div><div className="editor-field"><label htmlFor="contributor-password">{inviteToken?'设置密码（至少 12 个字符）':'密码'}</label><input id="contributor-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={inviteToken?'new-password':'current-password'} required minLength={inviteToken?12:1} maxLength={256}/></div>{error&&<p role="alert" className="editor-error">{error}</p>}<button className="editor-button" disabled={busy}>{busy?'正在验证…':inviteToken?'提交注册申请':'登录'}</button>{!inviteToken&&<Link className="editor-link" href="/contributor/register">首次参与？申请注册 ↗</Link>}</form></main>;
}
