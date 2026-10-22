'use client';
import { useState } from 'react';
import type { AdminApplication as Application } from '@/lib/identity-store';

export default function AdminApplication({initial}:{initial:Application|null}){
  const [application,setApplication]=useState(initial),[reason,setReason]=useState(initial?.reason??''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){
    const response=await fetch('/api/contributor/members',{cache:'no-store'}),data=await response.json();
    if(!response.ok)throw new Error(data.error);setApplication(data.application);
  }
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{
    const response=await fetch('/api/contributor/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply-admin',reason,expectedRevision:application?.revision??0})}),data=await response.json();
    if(!response.ok)throw new Error(data.error);await refresh();setMessage('申请已提交，等待管理员审核');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section id="admin-application" className="admin-application editor-section"><details className="account-disclosure"><summary>申请成为管理员</summary>
    {application&&<div><p>{application.status==='pending'?'管理员申请待审核':application.status==='approved'?'申请已通过，请刷新页面':'管理员申请已拒绝'}</p>{application.admin_note&&<p className="request-text">管理员回复：{application.admin_note}</p>}</div>}
    {application?.status!=='pending'&&application?.status!=='approved'&&<form className="access-form" onSubmit={submit}><div className="editor-field"><label htmlFor="admin-reason">申请原因（必填）</label><textarea id="admin-reason" required maxLength={2000} rows={4} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></div><button className="editor-button" disabled={busy||!reason.trim()}>{application?'重新申请':'申请成为管理员'}</button></form>}
    {error&&<p role="alert" className="editor-error">{error}</p>}{message&&<p role="status" className="editor-message">{message}</p>}
    <button className="editor-link" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>刷新状态</button>
  </details></section>;
}
