import { notFound } from 'next/navigation';
import { publicAlbums } from '@/lib/public-albums';
import { localPublicContext,localPage } from '@/lib/local-access';
import AlbumDisplay from '@/components/AlbumDisplay';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:(await publicAlbums()).find(a=>a.slug===slug)?.title??'唱片资料'};}
export default async function ReleasePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params,albums=await publicAlbums(),a=albums.find(a=>a.slug===slug);if(!a)notFound();return <AlbumDisplay album={a} local={await localPublicContext()} coverToken={await localPublicContext()?(await localPage()).token:undefined} related={albums.filter(r=>r.id!==a.id).slice(0,3)}/>;}
