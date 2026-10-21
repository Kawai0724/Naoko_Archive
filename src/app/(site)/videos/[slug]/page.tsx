import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Film } from 'lucide-react';
import { videos } from '@/data/videos';
import '@/app/catalog.css';
export function generateStaticParams(){return videos.map(r=>({slug:r.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:videos.find(r=>r.slug===slug)?.title??'影像资料'}}
export default async function VideoPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const r=videos.find(r=>r.slug===slug);if(!r)notFound();
  return <main id="main-content" className="detail-page page-shell"><Link href="/videos" className="detail-back"><ArrowLeft size={15} strokeWidth={1.2}/> 返回影像档案</Link><div className="video-detail-title"><p className="eyebrow">MOVING IMAGES / {r.category}</p><h1>{r.title}</h1><span className="detail-demo-label">演示占位 · 节目资料待核实</span></div><div className="video-detail-placeholder"><img src={r.thumbnail} alt="本站原创静态画面，非节目截图" width="960" height="540"/><div><Film size={33} strokeWidth={1}/><h2>影像资料待整理</h2><p>暂无可公开使用的视频文件</p></div></div><div className="video-detail-body"><section><p className="eyebrow">ABOUT THIS RECORD</p><h2>档案笔记</h2><p>{r.description}</p><p className="detail-small-note">此页仅演示影像档案的资料结构，不代表存在相应节目或已取得视频授权。</p></section><dl className="detail-metadata"><div><dt>资料分类</dt><dd>{r.category}</dd></div><div><dt>节目 / 演出</dt><dd>{r.program??'待考证'}</dd></div><div><dt>日期</dt><dd>{r.date??'待考证'}</dd></div><div><dt>出演曲目</dt><dd>待考证</dd></div><div><dt>资料来源</dt><dd>{r.sourceLabel}</dd></div><div><dt>相关作品</dt><dd>尚未建立关联</dd></div></dl></div></main>;
}
