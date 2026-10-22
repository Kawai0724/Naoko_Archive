'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { statusLabels } from '@/lib/albums';
import { editionCover } from '@/lib/edition-hierarchy';
import type { Album } from '@/lib/types';
import PrivateImage from './PrivateImage';
import DeleteAlbumButton from './DeleteAlbumButton';
import EditionOrderEditor from './EditionOrderEditor';
import RequestReasonDialog from './RequestReasonDialog';
import type { AlbumChangeRequest } from '@/lib/album-request-store';
export default function EditionHub({initial,token,admin,canDelete=false,pendingRequest=null}:{initial:Album;token:string;admin:boolean;canDelete?:boolean;pendingRequest?:AlbumChangeRequest|null}){
  const router=useRouter();
  const [album,setAlbum]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false),[reasonOpen,setReasonOpen]=useState(false);
  const locked=!!pendingRequest||album.status==='pending-review';
  useEffect(()=>{if(!dirty&&!busy&&initial.revision>album.revision)setAlbum(initial);},[initial,album.revision,busy,dirty]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  async function save(next:Album,action:'draft'|'submit'='draft',reason=''){
    setBusy(true);setError('');setMessage('');try{
      const r=await fetch(`/api/contributor/albums/${album.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-local-editor-token':token},body:JSON.stringify({action,album:next,expectedRevision:album.revision,reason})}),data=await r.json();
      if(!r.ok)throw new Error(data.error);setAlbum(data.album);setDirty(false);setReasonOpen(false);setMessage(action==='submit'?'已提交审核':'已保存草稿');router.refresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main id="main-content" className="contributor-editions"><Link className="editor-link" href="/contributor/albums">← 专辑目录</Link><div className="editor-title-row"><div><h1>{album.title||'未命名专辑'}</h1><p>{album.translatedTitle||album.artist} · {album.editions.length} 个版本 · {statusLabels[album.status]}</p></div><div className="edition-hub-heading-actions">{canDelete&&<DeleteAlbumButton album={album} disabled={busy||locked}/>}<Link className="editor-button secondary" href={`/contributor/albums/${album.id}/edit`}>编辑专辑</Link>{!locked&&<Link className="editor-button" href={`/contributor/albums/${album.id}/editions/new`}>＋ 添加版本</Link>}</div></div>{pendingRequest&&<p className="editor-message request-pending-note">{pendingRequest.username} 申请{pendingRequest.kind==='delete'?'删除整个专辑':'修改专辑'}（{pendingRequest.reason.trim()||'无'}），等待审核。<Link className="editor-link" href="/contributor/submissions">查看申请</Link></p>}{error&&<p role="alert" className="editor-error">{error}</p>}
    <p role="status" aria-live="polite" className="editor-message">{message}</p>
    <EditionOrderEditor album={album} disabled={busy||locked} onChange={patch=>{setAlbum(a=>({...a,...patch}));setDirty(true);setMessage('');setError('');}} actions={<div className="editor-actions"><button className="editor-button secondary" disabled={busy||locked||!dirty} onClick={()=>save(album)}>保存顺序草稿</button><button className="editor-button" disabled={busy||locked} onClick={()=>{setError('');setReasonOpen(true);}}>提交审核</button>{dirty&&<span className="editor-muted">未保存</span>}</div>}/>
    <div className="edition-hub-list">{album.editions.map((e,i)=>{const cover=editionCover(album.media,e.id),url=`/contributor/albums/${album.id}/editions/${e.id}/edit`;return <article className="edition-hub-row" key={e.id}>
      <Link href={url} className="edition-hub-cover" aria-label={`编辑版本 ${e.editionName||i+1}`}>{cover?.storageKey?<PrivateImage storageKey={cover.storageKey} token={token} className="edition-cover-image"/>:<span className="editor-muted">未添加封面</span>}</Link><div className="edition-hub-copy"><p className="eyebrow">VERSION {String(i+1).padStart(2,'0')}</p><h2><Link href={url}>{e.editionName||'未命名版本'} ↗</Link></h2><dl className="edition-meta-list">{([['format','载体'],['label','厂牌'],['catalogNumber','编号'],['releaseRegion','地区']] as const).map(([key,label])=>e[key]&&<div key={key}><dt>{label}</dt><dd>{e[key]}</dd></div>)}{e.releaseDate&&<div><dt>发行日期</dt><dd>{e.releaseDate.value}</dd></div>}<div><dt>曲目</dt><dd>{e.tracks.length} 首</dd></div></dl></div><div className="edition-hub-actions"><Link className="editor-link" href={url}>{locked?'查看版本':'编辑版本'} ↗</Link><button className="editor-link" disabled={locked||busy} onClick={()=>{if(window.confirm('移除这个版本？关联文件与历史保留，公开目录在重新批准前不变。'))save({...album,editions:album.editions.filter(v=>v.id!==e.id),media:album.media.filter(m=>m.relatedEditionId!==e.id)});}}>移除版本</button></div>
    </article>;})}</div>{!album.editions.length&&<div className="editor-empty"><h2>还没有发行版本</h2><Link className="editor-link" href={`/contributor/albums/${album.id}/editions/new`}>添加版本 ↗</Link></div>}
    <RequestReasonDialog open={reasonOpen} title="提交版本顺序审核" busy={busy} error={error} onClose={()=>setReasonOpen(false)} onSubmit={reason=>save(album,'submit',reason)}/>
  </main>;
}
