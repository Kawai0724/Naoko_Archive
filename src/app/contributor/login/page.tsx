import AccessForm from '@/components/contributor/AccessForm';
import { currentContributor } from '@/lib/local-access';
import { redirect } from 'next/navigation';
export default async function ContributorLogin({searchParams}:{searchParams:Promise<{closed?:string}>}){const user=await currentContributor();if(user)redirect(user.accountStatus==='approved'?'/contributor':'/contributor/application');const query=await searchParams;return <AccessForm accountClosed={query.closed==='1'}/>;}
