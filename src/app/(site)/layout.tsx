import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '../chrome.css';
import { localPublicContext } from '@/lib/local-access';
import { publicAlbums } from '@/lib/public-albums';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const records=await publicAlbums();
  const directoryEntries=records.flatMap(a=>[
    {href:`/discography/${a.slug}`,label:a.title,parent:"/discography"},
    ...a.editions.map(e=>({href:`/discography/${a.slug}/editions/${e.id}`,label:e.editionName||"发行版本",parent:`/discography/${a.slug}`})),
  ]);
  const albums=records.map(a=>({title:a.title,subtitle:a.translatedTitle??'',year:a.firstReleaseDate?Number(a.firstReleaseDate.value.slice(0,4)):null,href:`/discography/${a.slug}`}));
  return <><a className="skip-link" href="#main-content">跳至正文</a><SiteHeader localContributor={await localPublicContext()} albums={albums} directoryEntries={directoryEntries} />{children}<SiteFooter /></>;
}
