import { localPage } from '@/lib/local-access';
import { identityStore } from '@/lib/contributor-auth';
import MemberManager from '@/components/contributor/MemberManager';
import { redirect } from 'next/navigation';
export const metadata={title:'成员与邀请'};
export default async function MembersPage(){const {user,admin}=await localPage();if(!admin)redirect('/members');return <MemberManager user={user} initial={identityStore().adminData(user) as Parameters<typeof MemberManager>[0]['initial']}/>;}
