import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import AlbumEditor from '@/components/contributor/AlbumEditor';
export const metadata={title:'编辑发行版本'};
export default async function Page({params,searchParams}:{params:Promise<{id:string;editionId:string}>;searchParams:Promise<{section?:string}>}){const access=await localPage(),{id,editionId}=await params,{section}=await searchParams,s=albumStore(),a=s.get(id);if(!a||a.deletedAt||!a.editions.some(e=>e.id===editionId))notFound();return <AlbumEditor key={editionId} initial={a} editionId={editionId} initialSection={section==='audio'?4:section==='cover'?3:0} history={s.revisions(id)} hasPublished={!!s.publishedRaw(id)} {...access}/>;}
