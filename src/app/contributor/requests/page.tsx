import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import { ChangeRequestStore } from '@/lib/change-request-store';
import SiteChangeForm from '@/components/contributor/SiteChangeForm';
export const metadata={title:'网站修改申请'};
export default async function RequestsPage(){const {user}=await localPage(),store=new ChangeRequestStore(albumStore());return <SiteChangeForm content={store.content()} requests={store.list(user)}/>;}
