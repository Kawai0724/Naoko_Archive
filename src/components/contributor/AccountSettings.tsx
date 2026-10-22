'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AccountProfile,AdminApplication as Application } from '@/lib/identity-store';
import { bioLength,MEMBER_BIO_LIMIT } from '@/lib/member-bio';
import AdminApplication from './AdminApplication';

export default function AccountSettings({profile:initial,application}:{profile:AccountProfile;application:Application|null}){
  const router=useRouter(),[profile,setProfile]=useState(initial),[nickname,setNickname]=useState(initial.nickname),[bio,setBio]=useState(initial.bio),[profileError,setProfileError]=useState(''),[message,setMessage]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[repeatPassword,setRepeatPassword]=useState(''),[passwordError,setPasswordError]=useState(''),[closePassword,setClosePassword]=useState(''),[confirmation,setConfirmation]=useState(''),[closeError,setCloseError]=useState(''),[busy,setBusy]=useState(false);
  async function saveProfile(e:React.FormEvent){e.preventDefault();setProfileError('');setMessage('');if(bioLength(bio)>MEMBER_BIO_LIMIT){setProfileError('简介最多 80 字');return;}setBusy(true);try{
    const response=await fetch('/api/contributor/account',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile',nickname,bio})}),data=await response.json();
    if(!response.ok)throw new Error(data.error);setProfile(data.profile);setNickname(data.profile.nickname);setBio(data.profile.bio);setMessage('个人资料已保存');router.refresh();
  }catch(e){setProfileError((e as Error).message);}finally{setBusy(false);}}
  async function changePassword(e:React.FormEvent){e.preventDefault();setPasswordError('');if(newPassword!==repeatPassword){setPasswordError('两次输入的新密码不一致');return;}setBusy(true);try{
    const response=await fetch('/api/contributor/account',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'password',currentPassword,newPassword,confirmation:repeatPassword})}),data=await response.json();
    if(!response.ok)throw new Error(data.error);setCurrentPassword('');setNewPassword('');setRepeatPassword('');router.replace('/contributor/login?passwordChanged=1');router.refresh();
  }catch(e){setPasswordError((e as Error).message);}finally{setBusy(false);}}
  async function closeAccount(e:React.FormEvent){e.preventDefault();setBusy(true);setCloseError('');try{
    const response=await fetch('/api/contributor/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:closePassword,confirmation})}),data=await response.json();
    if(!response.ok)throw new Error(data.error);setClosePassword('');router.replace('/contributor/login?closed=1');router.refresh();
  }catch(e){setCloseError((e as Error).message);}finally{setBusy(false);}}
  return <main id="main-content" className="contributor-home account-settings"><h1>个人账号</h1>
    <div className="account-identity"><p className="account-summary"><strong>{profile.nickname||profile.username}</strong><span>{profile.role==='admin'?'管理员':'贡献者'}</span></p><p className="account-handle">登录账号 · {profile.username}</p></div>
    <section className="editor-section account-profile"><h2>个人资料</h2><form className="access-form" onSubmit={saveProfile}>
      <div className="editor-field"><label htmlFor="account-nickname">昵称</label><input id="account-nickname" value={nickname} onChange={e=>setNickname(e.target.value)} placeholder={profile.username} autoComplete="nickname" maxLength={30} disabled={busy}/></div>
      <div className="editor-field"><label htmlFor="account-bio">简介（最多 80 字）</label><textarea id="account-bio" value={bio} onChange={e=>setBio(e.target.value)} maxLength={MEMBER_BIO_LIMIT*2} rows={2} aria-invalid={bioLength(bio)>MEMBER_BIO_LIMIT||undefined} disabled={busy}/></div>
      {profileError&&<p role="alert" className="editor-error">{profileError}</p>}{message&&<p role="status" className="editor-message">{message}</p>}
      <button className="editor-button" disabled={busy}>保存资料</button>
    </form></section>
    {profile.role==='contributor'&&profile.accountStatus==='approved'&&<AdminApplication initial={application}/>}
    <section className="editor-section account-password"><h2>修改密码</h2><p className="editor-muted">修改后，所有设备需要重新登录。</p><form className="access-form" onSubmit={changePassword}>
      <div className="editor-field"><label htmlFor="account-current-password">当前密码</label><input id="account-current-password" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" required maxLength={256} disabled={busy}/></div>
      <div className="editor-field"><label htmlFor="account-new-password">新密码（至少 12 个字符）</label><input id="account-new-password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={256} disabled={busy}/></div>
      <div className="editor-field"><label htmlFor="account-repeat-password">确认新密码</label><input id="account-repeat-password" type="password" value={repeatPassword} onChange={e=>setRepeatPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={256} disabled={busy}/></div>
      {passwordError&&<p role="alert" className="editor-error">{passwordError}</p>}<button className="editor-button secondary" disabled={busy}>更新密码</button>
    </form></section>
    <section className="editor-section account-closure"><details><summary>注销账号</summary><p>注销后无法登录，所有设备将退出。历史投稿保留；账号不能重新启用，原用户名不能再次注册。</p>
      <form className="access-form" onSubmit={closeAccount}>
        <div className="editor-field"><label htmlFor="close-username">输入用户名 {profile.username} 确认</label><input id="close-username" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} required maxLength={40} disabled={busy}/></div>
        <div className="editor-field"><label htmlFor="close-password">当前密码</label><input id="close-password" type="password" value={closePassword} onChange={e=>setClosePassword(e.target.value)} autoComplete="current-password" required maxLength={256} disabled={busy}/></div>
        {closeError&&<p role="alert" className="editor-error">{closeError}</p>}
        <button className="editor-button account-close-button" disabled={busy||confirmation!==profile.username||!closePassword}>注销我的账号</button>
      </form>
    </details></section>
  </main>;
}
