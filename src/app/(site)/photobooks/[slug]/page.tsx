import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { photobooks } from '@/data/photobooks';
import ImageGallery from '@/components/ImageGallery';
import '@/app/catalog.css';
export function generateStaticParams(){return photobooks.map(r=>({slug:r.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:photobooks.find(r=>r.slug===slug)?.title??'写真资料'}}
export default async function PhotobookPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const r=photobooks.find(r=>r.slug===slug);if(!r)notFound();
  return <main id="main-content" className="detail-page page-shell"><Link href="/photobooks" className="detail-back"><ArrowLeft size={15} strokeWidth={1.2}/> 返回写真与印刷物</Link><div className="photo-detail-layout"><section className="photo-detail-gallery"><ImageGallery images={r.images}/></section><section className="photo-detail-intro"><p className="eyebrow">PAPER & LIGHT / ORIGINAL STUDY</p><h1>{r.title}</h1><p className="detail-translated-title">{r.subtitle}</p><div className="detail-demo-label">演示占位 · 非历史出版物</div><p className="detail-description">{r.description}</p><dl className="detail-metadata"><div><dt>分类</dt><dd>{r.category} · 阅读方式演示</dd></div><div><dt>出版日期</dt><dd>{r.publishedDate??'待考证'}</dd></div><div><dt>出版社</dt><dd>{r.publisher??'待考证'}</dd></div><div><dt>ISBN</dt><dd>{r.isbn??'待考证'}</dd></div><div><dt>图像来源</dt><dd>{r.sourceLabel}</dd></div><div><dt>演示页数</dt><dd>{r.images.length} 页</dd></div></dl><div className="photo-reader-note"><h2>慢慢翻，放大看。</h2><p>点击图像打开大图。大图内可使用方向键翻页，按 Esc 退出。图像保持原始比例。</p></div></section></div></main>;
}
