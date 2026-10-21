import Link from 'next/link';
export default function NotFound() { return <main className="not-found"><p className="eyebrow">NAOKO ARCHIVE / 404</p><h1>这一页，还没有入藏。</h1><p>你可以回到档案主页，继续翻阅。</p><Link className="text-link" href="/archive">返回档案主页 →</Link></main>; }
