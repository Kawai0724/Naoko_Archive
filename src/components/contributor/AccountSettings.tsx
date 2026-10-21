'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountSettings({username,role}:{username:string;role:'admin'|'contributor'}){
  const router=useRouter(),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function closeAccount(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const response=await fetch('/api/contributor/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,confirmation})}),data=await response.json();
    if(!response.ok)throw new Error(data.error);
    setPassword('');router.replace('/contributor/login?closed=1');router.refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="contributor-home account-settings"><h1>账号设置</h1><p className="account-summary">{username}<span>{role==='admin'?'管理员':'贡献者'}</span></p>
    <section className="editor-section account-closure"><h2>注销账号</h2><p>注销后无法登录，所有设备将退出。历史投稿保留；账号不能重新启用，原用户名不能再次注册。</p>
      <form className="access-form" onSubmit={closeAccount}>
        <div className="editor-field"><label htmlFor="close-username">输入用户名 {username} 确认</label><input id="close-username" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} required maxLength={40}/></div>
        <div className="editor-field"><label htmlFor="close-password">当前密码</label><input id="close-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required maxLength={256}/></div>
        {error&&<p role="alert" className="editor-error">{error}</p>}
        <button className="editor-button account-close-button" disabled={busy||confirmation!==username||!password}>{busy?'正在注销…':'注销我的账号'}</button>
      </form>
    </section>
  </main>;
}
