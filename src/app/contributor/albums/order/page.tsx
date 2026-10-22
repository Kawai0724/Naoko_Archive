import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import { CatalogOrderStore } from '@/lib/catalog-order-store';
import CatalogOrderEditor from '@/components/contributor/CatalogOrderEditor';
export const metadata={title:'调整专辑顺序'};
export default async function Page(){const {user,admin}=await localPage(),store=new CatalogOrderStore(albumStore());return <CatalogOrderEditor initial={{state:store.state(),requests:store.list(user),userId:user.id,admin}}/>;}
