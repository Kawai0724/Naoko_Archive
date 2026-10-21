import AccessForm from '@/components/contributor/AccessForm';
export const metadata={title:'接受共建邀请',referrer:'no-referrer'};
export default async function JoinPage({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;if(!token||!/^[\w-]{43}$/.test(token))return <main className="contributor-home"><h1>邀请无效</h1><p>请向管理员获取邀请链接。</p></main>;return <AccessForm inviteToken={token}/>;}
