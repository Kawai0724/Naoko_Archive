'use client';
import { useId,type ReactNode } from 'react';
import { orderedEditions } from '@/lib/albums';
import type { Album,AlbumEdition } from '@/lib/types';

type OrderPatch={editions:AlbumEdition[];editionOrder:NonNullable<Album['editionOrder']>};
export default function EditionOrderEditor({album,disabled=false,onChange,actions}:{album:Pick<Album,'editions'|'editionOrder'>;disabled?:boolean;onChange:(patch:OrderPatch)=>void;actions?:ReactNode}){
  const id=useId(),mode=album.editionOrder??'manual',rows=orderedEditions(album.editions,mode);
  function move(index:number,delta:number){
    if(disabled||index+delta<0||index+delta>=rows.length)return;
    const editions=[...rows];[editions[index],editions[index+delta]]=[editions[index+delta],editions[index]];
    onChange({editions,editionOrder:'manual'});
  }
  return <details className="editor-disclosure edition-order-editor"><summary>调整版本顺序</summary><div className="editor-disclosure-body">
    <div className="editor-field"><label htmlFor={id}>排序方式</label><select id={id} value={mode} disabled={disabled} onChange={e=>{const editionOrder=e.target.value as OrderPatch['editionOrder'];onChange({editionOrder,editions:orderedEditions(rows,editionOrder)});}}><option value="release-date">按发行日期（从早到晚）</option><option value="manual">手动排序</option></select></div>
    {rows.length?<ol className="edition-order-list">{rows.map((edition,index)=><li key={edition.id}><span className="edition-order-number">{String(index+1).padStart(2,'0')}</span><div><strong>{edition.editionName||edition.catalogNumber||'未命名版本'}</strong><p>{[edition.catalogNumber,edition.format,edition.releaseDate?.value].filter(Boolean).join(' · ')||'日期待补充'}</p></div><div className="edition-order-actions"><button type="button" className="editor-link" aria-label={`上移版本 ${index+1}`} disabled={disabled||index===0} onClick={()=>move(index,-1)}>↑ 上移</button><button type="button" className="editor-link" aria-label={`下移版本 ${index+1}`} disabled={disabled||index===rows.length-1} onClick={()=>move(index,1)}>↓ 下移</button></div></li>)}</ol>:<p className="editor-muted">添加版本后可调整顺序。</p>}
    {actions}
  </div></details>;
}
