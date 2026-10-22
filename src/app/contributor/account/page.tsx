import { redirect } from 'next/navigation';
import { currentContributor } from '@/lib/local-access';
import AccountSettings from '@/components/contributor/AccountSettings';
import { identityStore } from '@/lib/contributor-auth';
export const metadata={title:'个人账号'};
export default async function AccountPage(){const user=await currentContributor();if(!user)redirect('/contributor/login?next=account');const store=identityStore();return <AccountSettings profile={store.profile(user)} application={user.accountStatus==='approved'&&user.role==='contributor'?store.adminApplication(user):null}/>;}
