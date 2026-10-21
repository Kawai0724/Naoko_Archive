import { notFound } from 'next/navigation';
import { ContributorStore } from './contributor-store';
import { StoreError } from './album-store';
export function pageAlbum(scope:ContributorStore,id:string){try{return scope.get(id);}catch(e){if(e instanceof StoreError&&e.status===404)notFound();throw e;}}
