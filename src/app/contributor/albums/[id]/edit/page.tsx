import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import AlbumBasicsEditor from '@/components/contributor/AlbumBasicsEditor';
export const metadata={title:'编辑专辑基本资料'};
export default async function Page({params}:{params:Promise<{id:string}>}){const access=await localPage(),{id}=await params,s=albumStore(),a=s.get(id);if(!a||a.deletedAt)notFound();return <AlbumBasicsEditor key={id} initial={a} hasPublished={!!s.publishedRaw(id)} {...access}/>;}
