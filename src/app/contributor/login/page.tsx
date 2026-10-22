import AccessForm from '@/components/contributor/AccessForm';
import { currentContributor } from '@/lib/local-access';
import { redirect } from 'next/navigation';
export default async function ContributorLogin({searchParams}:{searchParams:Promise<{closed?:string;next?:string;passwordChanged?:string}>}){const query=await searchParams,user=await currentContributor();if(user)redirect(query.next==='account'?'/contributor/account':user.accountStatus==='approved'?'/contributor':'/contributor/application');return <AccessForm accountClosed={query.closed==='1'} passwordChanged={query.passwordChanged==='1'} returnToAccount={query.next==='account'}/>;}
