'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestStatusLabels } from '@/lib/site-content';
import type { RegistrationApplication } from '@/lib/identity-store';
export default function ApplicationStatus({initial}:{initial:RegistrationApplication}){
  const router=useRouter(),[reason,setReason]=useState(initial.reason),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function resubmit(){setBusy(true);setError('');try{const r=await fetch('/api/contributor/application',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason,expectedRevision:initial.revision})}),d=await r.json();if(!r.ok)throw new Error(d.error);router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="contributor-home"><p className="eyebrow">CONTRIBUTOR APPLICATION</p><h1>{initial.status==='pending'?'等待审核':initial.status==='rejected'?'申请已退回':'申请已通过'}</h1><p className="editor-muted">{initial.username} · {requestStatusLabels[initial.status]}</p>{initial.status==='pending'&&<p className="application-copy">申请已提交。管理员批准后，即可创建专辑、补充曲目和上传资料。</p>}{initial.admin_note&&<div className="review-note"><h2>管理员回复</h2><p>{initial.admin_note}</p></div>}{initial.status==='rejected'&&<div className="access-form"><div className="editor-field"><label htmlFor="resubmit-reason">申请说明</label><textarea id="resubmit-reason" value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></div><button className="editor-button" disabled={busy} onClick={resubmit}>修改并重新提交</button></div>}{error&&<p role="alert" className="editor-error">{error}</p>}<div className="editor-actions application-actions"><button className="editor-button secondary" onClick={()=>router.refresh()}>刷新审核状态</button><Link className="editor-link" href="/archive">返回档案馆 ↗</Link></div></main>;
}
