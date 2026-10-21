import { redirect } from 'next/navigation';
import { currentContributor } from '@/lib/local-access';
import AccountSettings from '@/components/contributor/AccountSettings';
export const metadata={title:'账号设置'};
export default async function AccountPage(){const user=await currentContributor();if(!user)redirect('/contributor/login');return <AccountSettings username={user.username} role={user.role}/>;}
