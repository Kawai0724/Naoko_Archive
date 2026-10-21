import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { contributorStore } from '@/lib/contributor-store';
import { pageAlbum } from '@/lib/contributor-page';
import EditionHub from '@/components/contributor/EditionHub';
export const metadata={title:'专辑版本目录'};
export default async function Page({params}:{params:Promise<{id:string}>}){const access=await localPage(),{id}=await params,a=pageAlbum(contributorStore(access.user),id);if(!a||a.deletedAt)notFound();return <EditionHub key={id} initial={a} token={access.token} admin={access.admin}/>;}
