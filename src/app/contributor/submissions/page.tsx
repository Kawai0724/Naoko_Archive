import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import AlbumList from '@/components/contributor/AlbumList';
export const metadata={title:'提交与审核记录'};
export default async function SubmissionsPage(){const access=await localPage();return <AlbumList initial={contributorStore(access.user).list()} {...access} submissions/>;}
