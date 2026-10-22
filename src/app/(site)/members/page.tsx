import { connection } from 'next/server';
import { archiveDataEnabled } from '@/lib/album-store';
import { identityStore } from '@/lib/contributor-auth';
import MemberList from '@/components/MemberList';
import '../../members.css';
export const metadata={title:'社区成员'};
export default async function MembersPage(){
  await connection();const members=archiveDataEnabled()?identityStore().publicMembers():[];
  return <main id="main-content" className="page-shell community-page"><p className="eyebrow">THE CONTRIBUTORS</p><h1>社区成员</h1><MemberList members={members}/>{!members.length&&<p>暂无成员</p>}</main>;
}
