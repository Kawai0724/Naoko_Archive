import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import './splash.css';
import './community.css';
import './mobile-cover.css';

export default function SplashPage() {
  return <main className="splash-page">
    <section id="cover" className="splash splash--cover" aria-labelledby="cover-title">
      <picture>
        <source media="(max-width: 768px)" srcSet="/cover-mobile.jpg" />
        <img className="splash-photo" src="/cover-hero-8k.webp" alt="" fetchPriority="high" width="7680" height="4320" />
      </picture>
      <div className="splash-overlay" aria-hidden="true" />
      <div className="splash-content">
        <h1 id="cover-title" lang="en">Naoko Kawai&apos;s <span>Archive</span></h1>
        <Link className="splash-enter" href="/archive" lang="en">ENTER <ArrowRight size={28} strokeWidth={1.5} aria-hidden="true" /></Link>
      </div>
    </section>

    <section id="credits" className="archive-community" aria-labelledby="community-title">
      <div className="community-inner">
        <div className="community-overview">
          <div className="community-introduction">
            <h2 id="community-title"><span className="community-title-en" lang="en">About the<br />Archive</span><span className="community-title-zh">关于本站</span></h2>
            <p className="community-copy-zh">这是由中国歌迷发起的河合奈保子非官方数字档案馆。我们整理唱片、写真、影像与相关资料，让散落的作品线索与昭和记忆在这里重新汇聚。</p>
            <p className="community-copy-en" lang="en">Created by fans in China, this independent archive brings together Naoko Kawai&apos;s records, photobooks, films, and related materials — preserving the details and memories that deserve to be rediscovered.</p>
          </div>
          <dl className="community-metadata">
            <div>
              <dt><span className="community-label-zh">始建于</span> <span aria-hidden="true">/</span> <span lang="en">ESTABLISHED</span></dt>
              <dd className="community-date"><time dateTime="2026-10">2026.10</time></dd>
            </div>
            <div>
              <dt><span className="community-label-zh">发起人</span> <span aria-hidden="true">/</span> <span lang="en">INITIATOR</span></dt>
              <dd className="community-contributor">fly_me_to_1980<br />Sentimental Velvet Rain</dd>
            </div>
            <div className="community-collection">
              <dt><span className="community-label-zh">收藏范围</span> <span aria-hidden="true">/</span> <span lang="en">COLLECTION</span></dt>
              <dd>唱片 · 写真 · 影像<span lang="en">Records · Photobooks · Films</span></dd>
            </div>
          </dl>
        </div>

        <div className="community-invitation">
          <h3>欢迎成为这个社区的贡献者<span lang="en">Help Build the Archive</span></h3>
          <div>
            <p className="community-copy-zh">无论是唱片版本信息、旧节目线索、写真出版记录，还是对现有资料的补充与更正，都欢迎你的参与。</p>
            <p className="community-copy-en" lang="en">Have a release detail, a broadcast reference, photobook information, or a correction to share? Your contribution can help this archive grow.</p>
            <Link className="community-contribute-link" href="/about#contribute">参与共建 <span lang="en">CONTRIBUTE</span> <span aria-hidden="true">↗</span></Link>
          </div>
        </div>

        <footer className="community-footer">
          <nav aria-label="档案馆入口与返回顶部">
            <Link href="/archive" lang="en">ENTER THE ARCHIVE <span aria-hidden="true">↗</span></Link>
            <a href="#cover" lang="en">BACK TO TOP <span aria-hidden="true">↑</span></a>
          </nav>
          <div className="community-rights">
            <p>非官方歌迷档案馆；相关作品权利归各自权利人所有。</p>
            <p lang="en">Independent and unofficial. Rights to original works remain with their respective owners.</p>
          </div>
        </footer>
      </div>
    </section>
  </main>;
}
