import Link from 'next/link';
import { localPage } from '@/lib/local-access';
import '../contributor.css';
export const dynamic='force-dynamic';
export default async function ContributorLayout({children}:{children:React.ReactNode}){await localPage();return <div className="contributor-shell"><header className="contributor-header"><Link href="/archive">← 返回档案馆</Link><nav aria-label="贡献者导航"><Link href="/contributor">工作台</Link><Link href="/contributor/albums">专辑管理</Link><Link href="/contributor/submissions">提交记录</Link></nav></header>{children}</div>;}
