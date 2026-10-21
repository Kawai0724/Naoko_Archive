import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import { pageAlbum } from '@/lib/contributor-page';
import AlbumBasicsEditor from '@/components/contributor/AlbumBasicsEditor';
export const metadata={title:'编辑专辑基本资料'};
export default async function Page({params}:{params:Promise<{id:string}>}){const access=await localPage(),{id}=await params,s=contributorStore(access.user),a=pageAlbum(s,id);if(!a||a.deletedAt)notFound();return <AlbumBasicsEditor key={id} initial={a} pendingReview={!!s.requests.pending(id)} hasPublished={!!s.store.publishedRaw(id)} {...access}/>;}
