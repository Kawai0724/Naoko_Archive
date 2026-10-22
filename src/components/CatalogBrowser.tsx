'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Grid2X2, List, Search, X } from 'lucide-react';
import { releases, releaseTypeLabel } from '@/data/releases';
import { photobooks } from '@/data/photobooks';
import { videos } from '@/data/videos';
import PrivateImage from './contributor/PrivateImage';
import { matchesSearch } from '@/lib/search';
import '@/app/catalog.css';
import type { ReleaseType } from '@/lib/types';

export type CatalogKind = 'discography' | 'photobooks' | 'videos';
const content = {
  discography:{en:'THE RECORD COLLECTION',title:'唱片目录',description:'先选择专辑，再翻阅不同发行版本的封面与资料。',notice:'一级封面来自第一个发行版本。缺失资料保持待整理；原创封面演绎在条目中标明。'},
  photobooks:{en:'PAPER, PRINT & MEMORIES',title:'写真与印刷物',description:'纸页的质感，画面的留白。为值得细读的印刷物留一处位置。',notice:'真实写真资料待整理。以下条目为原创版式演示，不对应历史出版物。'},
  videos:{en:'AN INDEX OF MOVING IMAGES',title:'影像档案',description:'荧屏与舞台上的片刻，沿着资料线索，慢慢收集。',notice:'以下条目为演示占位。节目、演出与采访资料待核实，暂无可公开播放的视频。'},
};
type CatalogRelease={slug:string;title:string;titleZh:string;year:number|null;type:ReleaseType|null;cover:string;coverAlt:string;description:string;isDemo:boolean;searchText?:string;editionCount?:number;localCover?:boolean};
export default function CatalogBrowser({kind,albumRecords,localContributor=false,coverToken}:{kind:CatalogKind;albumRecords?:CatalogRelease[];localContributor?:boolean;coverToken?:string}) {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const [year,setYear]=useState('all');
  const [view,setView]=useState<'grid'|'list'>('grid');
  const data = kind==='discography'?(albumRecords??releases).map(r=>({slug:r.slug,title:r.title,subtitle:r.titleZh,year:r.year,category:r.type?releaseTypeLabel[r.type]:'类型待补充',image:r.cover,alt:r.coverAlt,localCover:'localCover' in r&&r.localCover,description:r.description,isDemo:r.isDemo,editionCount:'editionCount' in r?r.editionCount:undefined,searchText:'searchText' in r?String(r.searchText):''})):kind==='photobooks'?photobooks.map(r=>({slug:r.slug,title:r.title,subtitle:r.subtitle,year:r.year,category:r.category,image:r.cover,alt:`${r.title} · 原创版式演示`,localCover:false,description:r.description,isDemo:r.isDemo,editionCount:undefined,searchText:''})):videos.map(r=>({slug:r.slug,title:r.title,subtitle:r.category,year:r.year,category:r.category,image:r.thumbnail,alt:`${r.title} · 原创静态占位`,localCover:false,description:r.description,isDemo:r.isDemo,editionCount:undefined,searchText:''}));
  const categories=Array.from(new Set(data.map(r=>r.category)));
  const years=Array.from(new Set(data.map(r=>r.year))).sort((a,b)=>(a??0)-(b??0));
  const filtered=data.filter(r=>(category==='all'||r.category===category)&&(year==='all'||String(r.year??'unknown')===year)&&matchesSearch(query,r.title,r.subtitle,r.year,r.category,r.searchText));
  const reset=()=>{setQuery('');setCategory('all');setYear('all')};
  return <main id="main-content" className="catalog-page page-shell"><div className="catalog-page-top"><p className="eyebrow">{content[kind].en}</p><span className="catalog-index">{kind==='discography'?'01':kind==='photobooks'?'02':'03'} / THE ARCHIVE</span></div><div className="catalog-title-row"><h1>{content[kind].title}</h1>{kind!=='discography'&&<p>{content[kind].description}</p>}</div>{kind!=='discography'&&<div className="catalog-notice"><span>演示占位</span><p>{content[kind].notice}</p></div>}
    {kind==='discography'&&localContributor&&<Link href="/contributor/albums" className="catalog-contribute">补充或更正资料 ↗</Link>}<div className="catalog-tools"><div className="catalog-tabs" role="group" aria-label="按类别筛选"><button onClick={()=>setCategory('all')} aria-pressed={category==='all'}>全部<span>{data.length}</span></button>{categories.map(c=><button key={c} onClick={()=>setCategory(c)} aria-pressed={category===c}>{c}</button>)}</div><div className="catalog-tool-right"><label className="catalog-year"><span className="sr-only">按年份筛选</span><select value={year} onChange={e=>setYear(e.target.value)} aria-label="按年份筛选"><option value="all">全部年份</option>{years.map(y=><option key={y??'unknown'} value={y??'unknown'}>{y??'年代待考证'}</option>)}</select></label><div className="catalog-view-switch" role="group" aria-label="展示方式"><button aria-label="网格视图" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><Grid2X2 size={16} strokeWidth={1.3}/></button><button aria-label="列表视图" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={18} strokeWidth={1.3}/></button></div></div></div>
    <div className="catalog-search-row"><label className="catalog-search"><Search size={17} strokeWidth={1.3}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="搜索当前目录" placeholder={kind==='discography'?'搜索专辑、译名或年份':'搜索名称或类别…'}/>{query&&<button aria-label="清除搜索内容" onClick={()=>setQuery('')}><X size={15}/></button>}</label><span className="catalog-result-count" aria-live="polite">{filtered.length} 件{kind==='discography'?'作品':'档案'}{kind!=='discography'?' · 演示':''}</span></div>
    {filtered.length>0?<div className={`catalog-items catalog-${kind} catalog-${view}`}>{filtered.map((r,i)=><Link key={r.slug} href={`/${kind}/${r.slug}`} className={`catalog-card ${r.image?'':'catalog-no-image'}`}>{r.image&&<div className="catalog-card-image">{r.localCover&&coverToken?<PrivateImage src={r.image} token={coverToken} className="" alt={r.alt} width={800} height={800}/>:<img src={r.image} alt={r.alt} width={kind==='videos'?960:kind==='photobooks'?600:800} height={kind==='videos'?540:800} loading="lazy"/>}<span>{r.isDemo?'演示占位':r.image.startsWith('/placeholders/')?'原创封面':'资料封面'}</span></div>}<div className="catalog-card-copy">{kind==='discography'&&<div className="catalog-album-heading"><h2 lang="ja">{r.title}</h2>{r.editionCount!=null&&<span className="catalog-version-entry">{r.editionCount} 个版本<ArrowUpRight size={14} strokeWidth={1.3}/></span>}</div>}<div className="catalog-card-meta"><span className="catalog-card-release"><span className="catalog-card-year">{r.year??'年代待考证'}</span> <i aria-hidden="true">/</i> <span className="catalog-card-category">{r.category}</span></span><span className="catalog-card-number">{String(i+1).padStart(2,'0')}</span></div>{kind!=='discography'&&<h2>{r.title}</h2>}{r.subtitle&&<p className="catalog-card-subtitle">{r.subtitle}</p>}{kind!=='discography'&&<p className="catalog-card-description">{r.description}</p>}</div>{(kind!=='discography'||r.editionCount==null)&&<ArrowUpRight className="catalog-card-arrow" size={18} strokeWidth={1.2}/>}</Link>)}</div>:<div className="catalog-empty"><p className="eyebrow">NO RECORDS FOUND</p><h2>暂时没有找到这一页。</h2><p>换一个关键词，或放宽年份与类别筛选。</p><button className="text-link" onClick={reset}>重置全部筛选<ArrowUpRight size={16}/></button></div>}
    
    {kind!=='discography'&&<div className="catalog-endnote"><span>END OF THIS SELECTION</span><p>这是一份慢慢生长的目录。<Link href="/about">了解资料整理方式 ↗</Link></p></div>}
  </main>;
}
