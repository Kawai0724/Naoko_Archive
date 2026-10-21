import { notFound } from 'next/navigation';
import { localPage } from '@/lib/local-access';
import { albumStore } from '@/lib/album-store';
import { identityStore } from '@/lib/contributor-auth';
import { ContributorStore } from '@/lib/contributor-store';
import { ChangeRequestStore } from '@/lib/change-request-store';
import ReviewDashboard from '@/components/contributor/ReviewDashboard';
export const metadata={title:'管理员后台'};
export default async function AdminPage(){const {user,admin}=await localPage();if(!admin)notFound();const store=albumStore(),scope=new ContributorStore(store,user);return <ReviewDashboard initial={{registrations:identityStore().registrationQueue(user),adminApplications:identityStore().adminApplications(user),albumRequests:scope.requests.list(user),albums:scope.list().filter(a=>!a.deletedAt&&a.status==='pending-review'),changes:new ChangeRequestStore(store).list(user)}}/>;}
