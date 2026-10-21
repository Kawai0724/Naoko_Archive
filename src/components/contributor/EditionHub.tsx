'use client';
import Link from 'next/link';
import { useState } from 'react';
import { statusLabels } from '@/lib/albums';
import { editionCover } from '@/lib/edition-hierarchy';
import type { Album,AlbumEdition } from '@/lib/types';
import PrivateImage from './PrivateImage';
import DeleteAlbumButton from './DeleteAlbumButton';
export default function EditionHub({initial,token,admin,canDelete=false}:{initial:Album;token:string;admin:boolean;canDelete?:boolean}){
  const locked=!admin&&initial.status==='pending-review';
  const [album,setAlbum]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(editions:AlbumEdition[],removedId?:string){setBusy(true);setError('');try{const next={...album,editions,media:removedId?album.media.filter(m=>m.relatedEditionId!==removedId):album.media};const r=await fetch(`/api/contributor/albums/${album.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-local-editor-token':token},body:JSON.stringify({action:'draft',album:next,expectedRevision:album.revision})}),data=await r.json();if(!r.ok)throw new Error(data.error);setAlbum(data.album);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function move(index:number,delta:number){const rows=[...album.editions];[rows[index],rows[index+delta]]=[rows[index+delta],rows[index]];save(rows);}
  return <main id="main-content" className="contributor-editions"><Link className="editor-link" href="/contributor/albums">← 专辑目录</Link><div className="editor-title-row"><div><h1>{album.title||'未命名专辑'}</h1><p>{album.translatedTitle||album.artist} · {album.editions.length} 个版本 · {statusLabels[album.status]}</p></div><div className="edition-hub-heading-actions"><Link className="editor-button secondary" href={`/contributor/albums/${album.id}/edit`}>编辑专辑</Link>{!locked&&<Link className="editor-button" href={`/contributor/albums/${album.id}/editions/new`}>＋ 添加版本</Link>}</div></div>{error&&<p role="alert" className="editor-error">{error}</p>}
    <div className="edition-hub-list">{album.editions.map((e,i)=>{const cover=editionCover(album.media,e.id),url=`/contributor/albums/${album.id}/editions/${e.id}/edit`;return <article className="edition-hub-row" key={e.id}>
      <Link href={url} className="edition-hub-cover" aria-label={`编辑版本 ${e.editionName||i+1}`}>{cover?.storageKey?<PrivateImage storageKey={cover.storageKey} token={token} className="edition-cover-image"/>:<span className="editor-muted">未添加封面</span>}</Link><div className="edition-hub-copy"><p className="eyebrow">VERSION {String(i+1).padStart(2,'0')}</p><h2><Link href={url}>{e.editionName||'未命名版本'} ↗</Link></h2><dl className="edition-meta-list">{([['format','载体'],['label','厂牌'],['catalogNumber','编号'],['releaseRegion','地区']] as const).map(([key,label])=>e[key]&&<div key={key}><dt>{label}</dt><dd>{e[key]}</dd></div>)}{e.releaseDate&&<div><dt>发行日期</dt><dd>{e.releaseDate.value}</dd></div>}<div><dt>曲目</dt><dd>{e.tracks.length} 首</dd></div></dl></div><div className="edition-hub-actions"><Link className="editor-link" href={url}>{locked?'查看版本':'编辑版本'} ↗</Link><button className="editor-link" aria-label={`上移版本 ${i+1}`} disabled={locked||busy||i===0} onClick={()=>move(i,-1)}>↑ 上移</button><button className="editor-link" aria-label={`下移版本 ${i+1}`} disabled={locked||busy||i===album.editions.length-1} onClick={()=>move(i,1)}>↓ 下移</button><button className="editor-link" disabled={locked||busy} onClick={()=>{if(window.confirm('移除这个版本？关联文件与历史保留，公开目录在重新批准前不变。'))save(album.editions.filter(v=>v.id!==e.id),e.id);}}>移除版本</button></div>
    </article>;})}</div>{!album.editions.length&&<div className="editor-empty"><h2>还没有发行版本</h2><Link className="editor-link" href={`/contributor/albums/${album.id}/editions/new`}>添加版本 ↗</Link></div>}
    {canDelete&&<section className="album-delete-section" aria-label="删除整个专辑"><DeleteAlbumButton album={album} disabled={busy}/></section>}
  </main>;
}
