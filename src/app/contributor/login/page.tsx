import AccessForm from '@/components/contributor/AccessForm';
export default async function ContributorLogin({searchParams}:{searchParams:Promise<{closed?:string}>}){const query=await searchParams;return <AccessForm accountClosed={query.closed==='1'}/>;}
