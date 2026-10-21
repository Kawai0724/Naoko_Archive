import Link from 'next/link';
import { currentContributor } from '@/lib/local-access';
import '../contributor.css';
import ContributorAccount from '@/components/contributor/ContributorAccount';
export const dynamic='force-dynamic';
export default async function ContributorLayout({children}:{children:React.ReactNode}){const user=await currentContributor();return <div className="contributor-shell"><header className="contributor-header"><Link href="/archive">← 返回档案馆</Link>{user&&<nav aria-label="贡献者导航"><Link href="/contributor">工作台</Link><Link href="/contributor/albums">专辑管理</Link><Link href="/contributor/submissions">提交记录</Link>{user.role==='admin'&&<Link href="/contributor/members">成员与邀请</Link>}</nav>}{user&&<ContributorAccount username={user.username}/>}</header>{children}</div>;}
