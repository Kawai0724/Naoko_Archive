'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { albumTypes,partialDate,statusLabels } from '@/lib/albums';
import type { Album } from '@/lib/types';
import RequestReasonDialog from './RequestReasonDialog';
import EditionOrderEditor from './EditionOrderEditor';
export default function AlbumBasicsEditor({initial,token,admin,hasPublished=false,pendingReview=false}:{initial:Album;token:string;admin:boolean;hasPublished?:boolean;pendingReview?:boolean}){
  const [album,setAlbum]=useState(initial),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[reasonOpen,setReasonOpen]=useState(false);const router=useRouter();
  const locked=pendingReview||album.status==='pending-review';
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  useEffect(()=>{if(!dirty&&!busy&&initial.revision>album.revision)setAlbum(initial);},[initial,album.revision,dirty,busy]);
  function update(p:Partial<Album>){setAlbum(a=>({...a,...p}));setDirty(true);setError('');}
  async function save(action='draft',reason=''){
    if(['approve','reject','delete'].includes(action)&&!window.confirm(action==='approve'?'批准这张专辑及其所有已保存版本？更新公开目录。':action==='delete'?'移除整张专辑及其版本？历史保留，可以恢复。':'将资料退回草稿？'))return;
    setBusy(true);setError('');try{const r=await fetch(`/api/contributor/albums${album.id?'/'+album.id:''}`,{method:album.id?'PATCH':'POST',headers:{'Content-Type':'application/json','x-local-editor-token':token},body:JSON.stringify({action,album,reason,expectedRevision:album.revision,confirm:true,note:action==='reject'?(window.prompt('退回原因（可选）')??''):''})}),data=await r.json();if(!r.ok)throw new Error(data.error);setAlbum(data.album);setDirty(false);setReasonOpen(false);setMessage(action==='submit'?'已提交审核':action==='approve'?'已批准':'已保存');if(action==='draft')router.push(`/contributor/albums/${data.album.id}`);if(action==='delete')router.push('/contributor/albums');router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main id="main-content" className="album-editor"><Link className="editor-link" href={album.id?`/contributor/albums/${album.id}`:'/contributor/albums'}>← {album.id?'返回版本目录':'专辑目录'}</Link><div className="editor-title-row"><div><h1>{album.id?'编辑专辑':'新增专辑'}</h1></div></div>
    <div className="editor-actions"><button className="editor-button" disabled={busy||locked} onClick={()=>save()}>{album.id?'保存并返回版本目录':'创建专辑'}</button>{album.id&&<button className="editor-button secondary" disabled={busy||locked} onClick={()=>{setError('');setReasonOpen(true);}}>提交审核</button>}<span className="editor-muted">{busy?'正在保存…':dirty?'有未保存修改':statusLabels[album.status]}</span></div><p role="status" className="editor-message">{message}</p>{error&&<p role="alert" className="editor-error">{error}</p>}
    <Link className="editor-link catalog-order-entry" href="/contributor/albums/order" target="_blank" rel="noopener noreferrer">调整专辑顺序 ↗</Link>
    <EditionOrderEditor album={album} disabled={busy||locked} onChange={update}/>
    <fieldset className="editor-form-fields album-basics-fields" disabled={busy||locked}><div className="editor-grid">{([['title','专辑名称'],['artist','艺人']] as const).map(([key,label])=><div className="editor-field" key={key}><label htmlFor={`album-${key}`}>{label}</label><input id={`album-${key}`} value={album[key]??''} onChange={e=>update({[key]:e.target.value})}/></div>)}<div className="editor-field"><label htmlFor="album-type">作品类型</label><select id="album-type" value={album.type??''} onChange={e=>update({type:e.target.value as Album['type']||null})}><option value="">待确定</option>{Object.entries(albumTypes).filter(([k])=>k!=='ep'||album.type==='ep').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div className="editor-field"><label htmlFor="album-date">首次发行日期</label><input id="album-date" value={album.firstReleaseDate?.value??''} placeholder="YYYY / YYYY-MM / YYYY-MM-DD" onChange={e=>update({firstReleaseDate:partialDate(e.target.value)})}/></div><div className="editor-field editor-field-wide"><label htmlFor="album-description">专辑介绍</label><textarea id="album-description" value={album.description??''} onChange={e=>update({description:e.target.value})}/></div></div></fieldset>
    
    {album.status==='rejected'&&album.changeNote&&<div className="editor-muted review-note"><strong>退回原因</strong><p>{album.changeNote}</p></div>}{locked&&<p className="editor-muted">投稿正在审核</p>}
    {album.status==='pending-review'&&admin&&<Link className="editor-link" href="/contributor/admin">前往管理员后台审核消息 ↗</Link>}
    <RequestReasonDialog open={reasonOpen} title="提交专辑修改审核" busy={busy} error={error} onClose={()=>setReasonOpen(false)} onSubmit={reason=>save('submit',reason)}/>
  </main>;
}
