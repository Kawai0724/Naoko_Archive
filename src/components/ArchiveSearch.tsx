'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { releases } from '@/data/releases';
import { photobooks } from '@/data/photobooks';
import { videos } from '@/data/videos';
import { matchesSearch } from '@/lib/search';

export type SearchAlbum={title:string;subtitle:string;year:number|null;href:string};
const fallbackAlbums:SearchAlbum[]=releases.map(r=>({title:r.title,subtitle:r.titleZh,year:r.year,href:`/discography/${r.slug}`}));
const otherRecords = [...photobooks.map(r=>({title:r.title,subtitle:r.subtitle,year:r.year,category:'写真 · 演示',href:`/photobooks/${r.slug}`})),...videos.map(r=>({title:r.title,subtitle:r.category,year:r.year,category:'影像 · 演示',href:`/videos/${r.slug}`}))];
export default function ArchiveSearch({open,onClose,albums=fallbackAlbums}:{open:boolean;onClose:()=>void;albums?:SearchAlbum[]}) {
  const records=[...albums.map(a=>({...a,category:'唱片'})),...otherRecords];
  const ref=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState('');
  useEffect(()=>{if(open&&!ref.current?.open){ref.current?.showModal()}else if(!open&&ref.current?.open){ref.current.close()}},[open]);
  const results=records.filter(r=>matchesSearch(query,r.title,r.subtitle,r.year,r.category));
  return <dialog ref={ref} className="search-dialog" aria-labelledby="search-title" onCancel={e=>{e.preventDefault();onClose()}} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="search-dialog-inner"><div className="search-heading"><div><p className="eyebrow">FIND SOMETHING TO REMEMBER</p><h2 id="search-title">在档案中寻找</h2></div><button className="header-icon" aria-label="关闭搜索" onClick={onClose}><X size={22} strokeWidth={1.2}/></button></div><label className="search-field"><Search size={20} strokeWidth={1.2}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="作品名、中文译名或年份" aria-label="搜索作品名或年份"/>{query&&<button aria-label="清除搜索" onClick={()=>setQuery('')}><X size={16}/></button>}</label><div className="search-summary" aria-live="polite">{query?`找到 ${results.length} 条档案`:'从一张唱片，或一个年份开始。'}</div><div className="search-results">{results.slice(0,10).map(r=><Link key={r.href} href={r.href} onClick={onClose}><div><small>{r.category} {r.year&&`/ ${r.year}`}</small><span>{r.title}</span></div><ArrowUpRight size={18} strokeWidth={1.2}/></Link>)}{results.length===0&&<p className="search-empty">没有找到相关档案。</p>}</div></div></dialog>;
}
