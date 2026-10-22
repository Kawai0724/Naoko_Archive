import Link from 'next/link';
import { currentContributor } from '@/lib/local-access';
import '../contributor.css';
import '../members.css';
import ContributorAccount from '@/components/contributor/ContributorAccount';
import { identityStore } from '@/lib/contributor-auth';
export const dynamic='force-dynamic';
export default async function ContributorLayout({children}:{children:React.ReactNode}){const user=await currentContributor();return <div className="contributor-shell"><header className="contributor-header"><Link href="/archive">← 返回档案馆</Link>{user?.accountStatus==='approved'&&<nav aria-label="贡献者导航"><Link href="/contributor">工作台</Link><Link href="/contributor/albums">专辑管理</Link><Link href="/contributor/submissions">提交记录</Link><Link href="/contributor/requests">修改申请</Link><Link href="/contributor/members">社区成员</Link>{user.role==='admin'&&<Link href="/contributor/admin">管理员后台</Link>}</nav>}{user&&<ContributorAccount username={user.username} nickname={identityStore().profile(user).nickname}/>}</header>{children}</div>;}
