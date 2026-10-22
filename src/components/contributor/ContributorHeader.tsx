'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ContributorHeader({children}:{children:React.ReactNode}){
  const accountPage=usePathname()==='/contributor/account';
  return <header className="contributor-header"><Link href="/archive">← 返回档案馆</Link>{!accountPage&&children}</header>;
}
