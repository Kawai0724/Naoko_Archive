'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { photobooks } from '@/data/photobooks';
import { videos } from '@/data/videos';
import '@/app/directory-navigation.css';

export type DirectoryEntry = { href: string; label: string; parent: string };
const root = { href: '/archive', label: '档案目录', parent: '' };
const sections: DirectoryEntry[] = [
  root,
  { href: '/discography', label: '唱片目录', parent: root.href },
  { href: '/photobooks', label: '写真与印刷物', parent: root.href },
  { href: '/videos', label: '影像档案', parent: root.href },
  { href: '/timeline', label: '时间线', parent: root.href },
  { href: '/about', label: '关于', parent: root.href },
  ...photobooks.map(r => ({ href: `/photobooks/${r.slug}`, label: r.title, parent: '/photobooks' })),
  ...videos.map(r => ({ href: `/videos/${r.slug}`, label: r.title, parent: '/videos' })),
];

export default function DirectoryNavigation({ entries = [] }: { entries?: DirectoryEntry[] }) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const all = [...sections, ...entries];
  const current = all.find(entry => entry.href === pathname);
  if (!current) return null;
  const trail: DirectoryEntry[] = [];
  let entry: DirectoryEntry | undefined = current;
  while (entry && !trail.some(item => item.href === entry!.href)) {
    trail.unshift(entry);
    entry = all.find(item => item.href === entry!.parent);
  }
  return <div className="directory-navigation page-shell">
    <nav className="directory-breadcrumbs" aria-label="当前位置">
      <ol>{trail.map((item, i) => <li key={item.href}>
        {i > 0 && <ChevronRight size={13} strokeWidth={1.2} aria-hidden="true" />}
        {i === trail.length - 1 ? <span aria-current="page">{item.label}</span> : <Link href={item.href}>{item.label}</Link>}
      </li>)}</ol>
    </nav>
  </div>;
}
