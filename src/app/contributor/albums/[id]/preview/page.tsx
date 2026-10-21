import Link from 'next/link';
import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import { pageAlbum } from '@/lib/contributor-page';
import { publicAlbum } from '@/lib/albums';
import { editionCover } from '@/lib/edition-hierarchy';
import AlbumDisplay from '@/components/AlbumDisplay';
import PrivateImage from '@/components/contributor/PrivateImage';
export const metadata={title:'工作稿预览'};
export default async function Page({params}:{params:Promise<{id:string;editionId?:string}>}){const access=await localPage(),{id,editionId}=await params,a=pageAlbum(contributorStore(access.user),id);if(!a||a.deletedAt||(editionId&&!a.editions.some(e=>e.id===editionId)))notFound();const view=publicAlbum(a);view.media=view.media.map(m=>{const original=a.media.find(file=>file.id===m.id)!;return {...m,url:`/api/contributor/${m.type==='audio'?'audio':'media'}/${original.storageKey!.split('/').map(encodeURIComponent).join('/')}`};});const covers=Object.fromEntries(a.editions.map(e=>{const cover=editionCover(a.media,e.id);return [e.id,cover?.storageKey?<PrivateImage storageKey={cover.storageKey} token={access.token} className="edition-detail-image"/>:null];}));return <><div className="preview-banner"><strong>草稿预览</strong><Link href={editionId?`/contributor/albums/${id}/editions/${editionId}/edit`:`/contributor/albums/${id}`}>← 返回{editionId?'版本编辑器':'版本目录'}</Link></div><AlbumDisplay album={view} editionId={editionId} privateCovers={covers} preview local/></>;}
