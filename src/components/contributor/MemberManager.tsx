'use client';
import { useState } from 'react';
type Data={users:{id:string;username:string;role:string;disabled:number}[];invites:{id:string;expires_at:number;used_by:string|null;revoked:number}[]};
export default function MemberManager({initial}:{initial:Data}){
  const [data,setData]=useState(initial),[url,setUrl]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function action(body:Record<string,unknown>){setBusy(true);setMessage('');try{
    const r=await fetch('/api/contributor/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw new Error(d.error);
    if(d.invite)setUrl(`${location.origin}/contributor/join?token=${d.invite.token}`);
    const next=await fetch('/api/contributor/admin',{cache:'no-store'});if(next.ok)setData(await next.json());
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <main className="contributor-home"><div className="editor-title-row"><h1>成员与邀请</h1><button className="editor-button" disabled={busy} onClick={()=>action({action:'invite'})}>创建邀请</button></div>{url&&<div className="editor-field invite-result"><label htmlFor="invite-url">邀请链接 · 7 天内有效，仅可使用一次</label><input id="invite-url" value={url} readOnly onFocus={e=>e.target.select()}/><button className="editor-link" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('邀请链接已复制');}catch{setMessage('请选择并复制上方链接');}}}>复制邀请链接</button></div>}<p role="status" className="editor-message">{message}</p><section className="editor-section"><h2>Contributor</h2>{data.users.map(u=><div className="member-row" key={u.id}><strong>{u.username}</strong><span>{u.role==='admin'?'管理员':u.disabled?'已停用':'贡献者'}</span>{u.role!=='admin'&&<button className="editor-link" disabled={busy} onClick={()=>action({action:'disable',id:u.id,disabled:!u.disabled})}>{u.disabled?'启用':'停用'}</button>}</div>)}</section><section className="editor-section"><h2>邀请记录</h2>{data.invites.map(i=><div className="member-row" key={i.id}><time>{new Date(i.expires_at).toLocaleDateString('zh-CN')} 到期</time><span>{i.used_by?'已使用':i.revoked?'已撤销':i.expires_at<Date.now()?'已过期':'待接受'}</span>{!i.used_by&&!i.revoked&&i.expires_at>Date.now()&&<button className="editor-link" disabled={busy} onClick={()=>action({action:'revoke',id:i.id})}>撤销</button>}</div>)}</section></main>;
}
