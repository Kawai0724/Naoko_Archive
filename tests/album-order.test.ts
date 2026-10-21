import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AlbumStore} from '../src/lib/album-store';
import {emptyAlbum,emptyEdition,partialDate,albumReleaseDate,compareAlbumReleaseDate} from '../src/lib/albums';
function setup(t:TestContext){const dir=mkdtempSync(path.join(tmpdir(),'naoko-order-')),store=new AlbumStore(dir);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return {dir,store};}
test('release chronology uses full dates and partial precision, ignores timestamps, and puts missing/invalid dates last with stable ties',()=>{
 const row=(id:string,date:string)=>({...emptyAlbum(),id,firstReleaseDate:partialDate(date)});
 const rows=[row('z','1986-10-21'),row('month','1986-05'),row('invalid','1986-02-30'),row('year','1986'),row('a','1986-10-21'),row('unknown',''),row('older','1985-12-31')];
 const order=()=>[...rows].sort(compareAlbumReleaseDate).map(a=>a.id);
 assert.deepEqual(order(),['older','year','month','a','z','invalid','unknown']);
 for(const a of rows){a.createdAt='2099-01-01';a.updatedAt='2100-01-01';a.title='Changed title';}assert.deepEqual(order(),['older','year','month','a','z','invalid','unknown']);
});
test('missing first release date falls back to the earliest valid edition without reordering versions or overriding an explicit album date',()=>{
 const editions=[{...emptyEdition(),releaseDate:partialDate('1999-01-01')},{...emptyEdition(),releaseDate:partialDate('1986-05-21')},{...emptyEdition(),releaseDate:partialDate('1980-02-30')}],album={...emptyAlbum(),editions};
 const order=editions.map(e=>e.id);assert.equal(albumReleaseDate(album)?.value,'1986-05-21');assert.deepEqual(album.editions.map(e=>e.id),order);
 album.firstReleaseDate=partialDate('1984');assert.equal(albumReleaseDate(album)?.value,'1984');
});
test('working and published lists sort by their own release dates and preserve order across ordinary edits and database reopening',t=>{
 const {store,dir}=setup(t);
 const add=(title:string,date:string,versionDate?:string)=>{let a=store.save({...emptyAlbum(),title,firstReleaseDate:partialDate(date),editions:versionDate?[{...emptyEdition(),releaseDate:partialDate(versionDate)}]:[]},'submit');return store.transition(a.id,'approve',a.revision,true);};
 const late=add('Late first-created','1988-12-01'),unknown=add('Unknown',''),mid=add('Version-date fallback','','1986-05-21');let early=add('Early last-created','1982-07-01');
 const ids=new Set([late.id,unknown.id,mid.id,early.id]),order=(s:AlbumStore,published=false)=>(published?s.published():s.list()).filter(a=>ids.has(a.id)).map(a=>a.id),expected=[early.id,mid.id,late.id,unknown.id];
 assert.deepEqual(order(store),expected);assert.deepEqual(order(store,true),expected);
 early=store.save({...early,description:'Unrelated edit'},'draft',early.id,early.revision);assert.deepEqual(order(store),expected);assert.deepEqual(order(store,true),expected);
 early=store.save({...early,firstReleaseDate:partialDate('1989')},'draft',early.id,early.revision);assert.deepEqual(order(store),[mid.id,late.id,early.id,unknown.id]);assert.deepEqual(order(store,true),expected);
 const reopened=new AlbumStore(dir);assert.deepEqual(order(reopened,true),expected);assert.deepEqual(order(reopened),[mid.id,late.id,early.id,unknown.id]);reopened.close();
});
