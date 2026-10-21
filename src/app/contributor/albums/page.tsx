import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import AlbumList from '@/components/contributor/AlbumList';
export const metadata={title:'唱片资料管理'};
export default async function AlbumsPage(){const access=await localPage(),store=contributorStore(access.user),albums=store.list();return <AlbumList initial={albums} deletableIds={albums.filter(a=>store.canDelete(a.id)).map(a=>a.id)} {...access}/>;}
