import Link from 'next/link';
import { localPage } from '@/lib/local-access';
export const metadata={title:'贡献者工作台'};
export default async function ContributorPage(){const {admin}=await localPage();return <main id="main-content" className="contributor-home"><h1>工作台</h1><div className="contributor-paths"><Link href="/contributor/albums"><span>01</span><div><h2>专辑管理</h2></div><span>↗</span></Link><Link href="/contributor/albums/new"><span>02</span><div><h2>新增专辑</h2></div><span>↗</span></Link><Link href="/contributor/submissions"><span>03</span><div><h2>提交记录</h2></div><span>↗</span></Link>{admin&&<Link href="/contributor/members"><span>04</span><div><h2>成员与邀请</h2></div><span>↗</span></Link>}</div></main>;}
