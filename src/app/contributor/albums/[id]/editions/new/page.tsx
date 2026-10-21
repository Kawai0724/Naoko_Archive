import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import { pageAlbum } from '@/lib/contributor-page';
import { emptyEdition } from '@/lib/albums';
import AlbumEditor from '@/components/contributor/AlbumEditor';
export const metadata={title:'添加发行版本'};
export default async function Page({params}:{params:Promise<{id:string}>}){const access=await localPage(),{id}=await params,s=contributorStore(access.user),a=pageAlbum(s,id);if(!a||a.deletedAt)notFound();const edition=emptyEdition();return <AlbumEditor key={edition.id} initial={{...a,editions:[...a.editions,edition]}} editionId={edition.id} isNewEdition history={s.revisions(id)} hasPublished={!!s.store.publishedRaw(id)} {...access}/>;}
