'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, X } from 'lucide-react';
import '@/app/catalog.css';
type GalleryImage={src:string;alt:string;caption:string};
export default function ImageGallery({images}:{images:GalleryImage[]}) {
  const [index,setIndex]=useState(0);
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();else if(!open&&dialog.current?.open)dialog.current.close()},[open]);
  if(!images.length)return <p>扫描资料待整理。</p>;
  const prev=()=>setIndex(i=>(i-1+images.length)%images.length);
  const next=()=>setIndex(i=>(i+1)%images.length);
  return <div className="gallery"><div className="gallery-stage"><button className="gallery-image-button" onClick={()=>setOpen(true)} aria-label={`放大第 ${index+1} 页：${images[index].caption}`}><img src={images[index].src} alt={images[index].alt} width="600" height="800"/><span><Maximize2 size={15} strokeWidth={1.3}/> 点击放大</span></button></div><div className="gallery-controls"><button className="gallery-arrow" aria-label="上一页" onClick={prev} disabled={images.length<2}><ArrowLeft size={20} strokeWidth={1.2}/></button><div aria-live="polite"><span>{String(index+1).padStart(2,'0')} / {String(images.length).padStart(2,'0')}</span><p>{images[index].caption}</p></div><button className="gallery-arrow" aria-label="下一页" onClick={next} disabled={images.length<2}><ArrowRight size={20} strokeWidth={1.2}/></button></div><div className="gallery-thumbnails">{images.map((img,i)=><button key={img.src} onClick={()=>setIndex(i)} aria-label={`查看第 ${i+1} 页`} aria-pressed={index===i}><img src={img.src} alt="" width="60" height="80"/></button>)}</div><dialog ref={dialog} className="gallery-dialog" aria-label="大图阅读器" onCancel={e=>{e.preventDefault();setOpen(false)}} onClose={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();prev()}if(e.key==='ArrowRight'){e.preventDefault();next()}}}><div className="gallery-dialog-top"><span>原创版式演示 / {index+1} OF {images.length}</span><button aria-label="关闭大图" onClick={()=>setOpen(false)}><X size={25} strokeWidth={1}/></button></div><div className="gallery-dialog-content"><button className="gallery-lightbox-arrow" onClick={prev} aria-label="大图上一页"><ArrowLeft size={24} strokeWidth={1}/></button><img src={images[index].src} alt={images[index].alt} width="600" height="800"/><button className="gallery-lightbox-arrow" onClick={next} aria-label="大图下一页"><ArrowRight size={24} strokeWidth={1}/></button></div><p className="gallery-dialog-caption" aria-live="polite">{images[index].caption} <span>← → 翻页 · Esc 退出</span></p></dialog></div>;
}
