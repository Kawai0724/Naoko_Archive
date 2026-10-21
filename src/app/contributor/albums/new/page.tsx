import { localPage } from '@/lib/local-access';
import { emptyAlbum } from '@/lib/albums';
import AlbumBasicsEditor from '@/components/contributor/AlbumBasicsEditor';
export const metadata={title:'添加专辑'};
export default async function NewAlbumPage(){const access=await localPage();return <AlbumBasicsEditor initial={emptyAlbum()} {...access}/>;}
