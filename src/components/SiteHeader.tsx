'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import ArchiveSearch, { type SearchAlbum } from './ArchiveSearch';
import DirectoryNavigation, { type DirectoryEntry } from './DirectoryNavigation';

export const navigation = [['/archive','主页'],['/contributor','参与共建'],['/about','关于']];
export default function SiteHeader({localContributor=false,albums,directoryEntries}:{localContributor?:boolean;albums?:SearchAlbum[];directoryEntries?:DirectoryEntry[]}) {
  const pathname=usePathname();
  const [searchOpen,setSearchOpen]=useState(false);
  const links=navigation;
  return <header className="site-header">
    <div className="header-main page-shell">
      <Link className="header-brand" href="/archive" aria-label="NAOKO ARCHIVE 档案主页"><span>NAOKO <i>ARCHIVE</i></span><small>河合奈保子数字档案馆</small></Link>
      <nav className="header-desktop-nav" aria-label="主导航">{links.map(([href,label])=><Link key={href} href={href} aria-current={pathname===href||pathname.startsWith(`${href}/`)?'page':undefined}>{label}</Link>)}</nav>
      <div className="header-actions"><button className="header-icon header-search-trigger" aria-label="搜索档案" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={()=>setSearchOpen(true)}><Search size={22} strokeWidth={1.6}/><span>搜索</span></button></div>
    </div>
    <DirectoryNavigation entries={directoryEntries}/>
    <ArchiveSearch open={searchOpen} onClose={()=>setSearchOpen(false)} albums={albums}/>
  </header>;
}
