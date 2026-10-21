import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import AlbumList from '@/components/contributor/AlbumList';
export const metadata={title:'提交与审核记录'};
export default async function SubmissionsPage(){const access=await localPage();return <AlbumList initial={albumStore().list()} {...access} submissions/>;}
