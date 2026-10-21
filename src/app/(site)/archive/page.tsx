import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import '@/app/archive-index.css';

export const metadata = { title: '档案目录' };

const categories = [
  { number: '01', title: 'Albums', description: '专辑、单曲与发行版本', href: '/discography' },
  { number: '02', title: 'Photographs', description: '写真、杂志与印刷物', href: '/photobooks' },
  { number: '03', title: 'Films', description: '电视、现场与访谈影像', href: '/videos' },
  { number: '04', title: 'Timeline', description: '沿着年份，翻阅作品与记忆', href: '/timeline' },
];

export default function ArchivePage() {
  return <main id="main-content" className="archive-index page-shell">
    <div className="archive-index-intro">
      <h1 lang="en"><span>The</span> Collection.</h1>
      <p>从唱片、纸页与光影出发，<br />翻阅河合奈保子的作品档案。</p>
    </div>
    <nav className="archive-index-navigation" aria-label="档案分类目录">
      <ol>
        {categories.map(category => <li key={category.href}>
          <Link className="archive-index-entry" href={category.href}>
            <span className="archive-index-number" aria-hidden="true">{category.number}</span>
            <div className="archive-index-copy">
              <h2 lang="en">{category.title}</h2>
              <p>{category.description}</p>
            </div>
            <ArrowUpRight className="archive-index-arrow" size={26} strokeWidth={1.1} aria-hidden="true" />
          </Link>
        </li>)}
      </ol>
    </nav>
  </main>;
}
