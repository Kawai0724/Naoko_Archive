import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import AlbumList from '@/components/contributor/AlbumList';
export const metadata={title:'提交与审核记录'};
export default async function SubmissionsPage(){const access=await localPage(),store=contributorStore(access.user),albums=store.list();return <AlbumList initial={albums} deletableIds={albums.filter(a=>store.canDelete(a.id)).map(a=>a.id)} {...access} submissions/>;}
