import 'server-only';
import { connection } from 'next/server';
import { archiveDataEnabled,albumStore } from './album-store';
import { ChangeRequestStore } from './change-request-store';
import { siteContentFields,type ContentSnapshot } from './site-content';
export async function approvedSiteContent():Promise<ContentSnapshot>{await connection();if(archiveDataEnabled())return new ChangeRequestStore(albumStore()).content();return Object.fromEntries(Object.entries(siteContentFields).map(([k,v])=>[k,{value:v.value,revision:0}])) as ContentSnapshot;}
