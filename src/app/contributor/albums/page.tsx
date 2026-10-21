import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import AlbumList from '@/components/contributor/AlbumList';
export const metadata={title:'唱片资料管理'};
export default async function AlbumsPage(){const access=await localPage();return <AlbumList initial={albumStore().list()} {...access}/>;}
