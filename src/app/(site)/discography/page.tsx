import { albumReleaseDate } from '@/lib/albums';
import CatalogBrowser from '@/components/CatalogBrowser';
import { publicAlbums,artwork } from '@/lib/public-albums';
import { localPublicContext,localPage } from '@/lib/local-access';
export const metadata={title:'唱片目录'};
export default async function DiscographyPage(){const albums=await publicAlbums(),local=await localPublicContext(),coverToken=local?(await localPage()).token:undefined;return <CatalogBrowser kind="discography" localContributor={local} coverToken={coverToken} albumRecords={albums.map(a=>({slug:a.slug,title:a.title,titleZh:a.translatedTitle??'',year:albumReleaseDate(a)?Number(albumReleaseDate(a)!.value.slice(0,4)):null,type:a.type,cover:artwork(a).cover,coverAlt:artwork(a).alt,localCover:artwork(a).local,description:a.description??'',isDemo:false,editionCount:a.editions.length,searchText:a.editions.flatMap(e=>[e.label,e.catalogNumber]).filter(Boolean).join(' ')}))}/>;}
