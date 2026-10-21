import { redirect } from 'next/navigation';
import { currentContributor } from '@/lib/local-access';
import { identityStore } from '@/lib/contributor-auth';
import ApplicationStatus from '@/components/contributor/ApplicationStatus';
export const metadata={title:'注册申请状态'};
export default async function ApplicationPage(){const user=await currentContributor();if(!user)redirect('/contributor/login');if(user.accountStatus==='approved')redirect('/contributor');const application=identityStore().application(user);if(!application)redirect('/contributor');return <ApplicationStatus key={application.revision} initial={application}/>;}
