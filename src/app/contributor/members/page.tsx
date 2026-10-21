import { localPage } from '@/lib/local-access';
import { identityStore } from '@/lib/contributor-auth';
import MemberManager from '@/components/contributor/MemberManager';
export const metadata={title:'社区成员与管理'};
export default async function MembersPage(){const {user,admin}=await localPage(),s=identityStore();return <MemberManager user={user} initial={{members:s.publicMembers(),application:s.adminApplication(user),...(admin?s.adminData(user):{})} as unknown as Parameters<typeof MemberManager>[0]['initial']}/>;}
