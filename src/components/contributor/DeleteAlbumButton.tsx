'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Album } from '@/lib/types';
import RequestReasonDialog from './RequestReasonDialog';
export default function DeleteAlbumButton({album,disabled=false}:{album:Album;disabled?:boolean}){
  const router=useRouter(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function requestDeletion(reason:string){setBusy(true);setError('');try{
    const response=await fetch(`/api/contributor/albums/${album.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:album.revision,confirm:true,reason})}),data=await response.json();
    if(!response.ok)throw new Error(data.error||'提交失败，请重试');setOpen(false);setMessage('删除申请已提交');router.refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="album-delete-control"><button className="editor-button secondary album-delete-trigger" type="button" disabled={busy||disabled} onClick={()=>{setError('');setOpen(true);}}>删除整个专辑</button>{message&&<p className="editor-message" role="status">{message}</p>}<RequestReasonDialog open={open} title={`申请删除「${album.title||'未命名专辑'}」`} description={`包含全部 ${album.editions.length} 个版本。审核通过后才会从目录隐藏，文件和历史保留。`} submitLabel="提交删除审核" busy={busy} error={error} onClose={()=>setOpen(false)} onSubmit={requestDeletion}/></div>;
}
