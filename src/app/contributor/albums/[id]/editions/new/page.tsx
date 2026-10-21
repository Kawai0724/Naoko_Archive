import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import { emptyEdition } from '@/lib/albums';
import AlbumEditor from '@/components/contributor/AlbumEditor';
export const metadata={title:'添加发行版本'};
export default async function Page({params}:{params:Promise<{id:string}>}){const access=await localPage(),{id}=await params,s=albumStore(),a=s.get(id);if(!a||a.deletedAt)notFound();const edition=emptyEdition();return <AlbumEditor key={edition.id} initial={{...a,editions:[...a.editions,edition]}} editionId={edition.id} isNewEdition history={s.revisions(id)} hasPublished={!!s.publishedRaw(id)} {...access}/>;}
