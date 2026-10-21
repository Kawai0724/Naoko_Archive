import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { identityStore } from '@/lib/contributor-auth';
import MemberManager from '@/components/contributor/MemberManager';
export default async function MembersPage(){const {user,admin}=await localPage();if(!admin)notFound();return <MemberManager initial={identityStore().adminData(user) as unknown as Parameters<typeof MemberManager>[0]['initial']}/>;}
