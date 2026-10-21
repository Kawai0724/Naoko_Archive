import { redirect } from 'next/navigation';
import { currentContributor } from '@/lib/local-access';
import RegistrationForm from '@/components/contributor/RegistrationForm';
export const metadata={title:'申请注册'};
export default async function RegistrationPage(){const user=await currentContributor();if(user)redirect(user.accountStatus==='approved'?'/contributor':'/contributor/application');return <RegistrationForm/>;}
