import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import ContentReviewMessages from '@/components/contributor/ContentReviewMessages';
export const metadata={title:'提交与审核记录'};
export default async function SubmissionsPage(){const {user}=await localPage(),store=contributorStore(user);return <main className="contributor-home"><h1>提交记录</h1><ContentReviewMessages messages={store.requests.list(user)}/></main>;}
