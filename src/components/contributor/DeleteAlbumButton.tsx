'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Album } from '@/lib/types';
export default function DeleteAlbumButton({album,disabled=false,onDeleted}:{album:Album;disabled?:boolean;onDeleted?:(album:Album)=>void}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function remove(){
    if(!window.confirm(`删除整个专辑“${album.title||'未命名专辑'}”及其全部 ${album.editions.length} 个版本？\n删除后将从公开目录隐藏，文件和历史保留，可在“查看已移除”中恢复。`))return;
    setBusy(true);setError('');try{
      const response=await fetch(`/api/contributor/albums/${album.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:album.revision,confirm:true})}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'删除失败，请重试');
      if(onDeleted)onDeleted(data.album);else router.push('/contributor/albums');router.refresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="album-delete-control"><button className="editor-link editor-delete" type="button" disabled={busy||disabled} onClick={remove}>{busy?'正在删除…':'删除整个专辑'}</button>{error&&<p className="editor-error" role="alert">{error}</p>}</div>;
}
