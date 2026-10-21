import { notFound } from 'next/navigation';
import { publicAlbums } from '@/lib/public-albums';
import { localPublicContext,localPage } from '@/lib/local-access';
import AlbumDisplay from '@/components/AlbumDisplay';
export const metadata={title:'发行版本'};
export default async function Page({params}:{params:Promise<{slug:string;editionId:string}>}){const {slug,editionId}=await params,a=(await publicAlbums()).find(a=>a.slug===slug);if(!a||!a.editions.some(e=>e.id===editionId))notFound();return <AlbumDisplay album={a} editionId={editionId} local={await localPublicContext()} coverToken={await localPublicContext()?(await localPage()).token:undefined}/>;}
