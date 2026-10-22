import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {AlbumStore,StoreError} from '../src/lib/album-store';
import {IdentityStore} from '../src/lib/identity-store';
import {ContributorStore} from '../src/lib/contributor-store';
import {CatalogOrderStore} from '../src/lib/catalog-order-store';
import {readCatalogOrder} from '../src/lib/catalog-order';
import {emptyAlbum,emptyEdition,partialDate} from '../src/lib/albums';
const password='catalog-order-test-password';
function setup(t:TestContext){
  const directory=mkdtempSync(path.join(tmpdir(),'naoko-catalog-order-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);
  store.db.exec('DELETE FROM albums; DELETE FROM revisions');
  identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
  const first=identity.register('catalog_editor',password,''),second=identity.register('catalog_other',password,'');
  for(const account of [first,second])identity.reviewRegistration(admin,account.user.id,'approved',1,'');
  const a=new ContributorStore(store,identity.session(first.token)!),b=new ContributorStore(store,identity.session(second.token)!),s=new ContributorStore(store,admin);
  function publish(title:string,date:string){let album=a.save({...emptyAlbum(),title,firstReleaseDate:partialDate(date),editions:[{...emptyEdition(),editionName:'later',releaseDate:partialDate('1987')},{...emptyEdition(),editionName:'early',releaseDate:partialDate('1980')}]},'submit');const request=a.requests.pending(album.id)!;album=s.requests.review(admin,request.id,'approved',request.revision).album;return album;}
  const albums=[publish('LOVE','1980'),publish('Scarlet','1986'),publish('Later','1990')],order=new CatalogOrderStore(store);
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const submit=(user=a.user,ids=order.state().albums.map(a=>a.id).reverse(),mode:'manual'|'release-date'='manual',reason='')=>{const state=order.state();return order.submit(user,mode,ids,state.revision,state.fingerprint,reason);};
  const review=(id:string,decision:'approved'|'rejected'='approved')=>{const request=order.list(admin).find(r=>r.id===id)!;order.review(admin,id,decision,request.revision,'');};
  return{directory,store,identity,admin,a,b,s,albums,order,publish,submit,review};
}
test('catalogue defaults to release chronology without initializing new tables on public reads',t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'naoko-catalog-default-')),store=new AlbumStore(directory);
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  assert.deepEqual(readCatalogOrder(store.db),{mode:'release-date',ids:[],revision:0});store.published();store.list();
  assert.equal(store.db.prepare("SELECT name FROM sqlite_master WHERE name='catalog_order'").get(),undefined);
});
test('catalogue ordering is a separate reviewed setting: pending stays private, approval persists, and album snapshots and edition covers stay untouched',t=>{
  const{directory,store,admin,a,albums,order,submit,review}=setup(t),original=store.db.prepare('SELECT * FROM albums ORDER BY id').all();
  assert.deepEqual(store.published().map(a=>a.title),['LOVE','Scarlet','Later']);
  const id=submit(a.user,albums.map(a=>a.id).reverse(),'manual','优先展示后期作品'),request=order.list(admin)[0];
  assert.equal(request.username,'catalog_editor');assert.equal(request.reason,'优先展示后期作品');assert.deepEqual(request.before.albums.map(a=>a.title),['LOVE','Scarlet','Later']);assert.deepEqual(request.after.albums.map(a=>a.title),['Later','Scarlet','LOVE']);
  assert.deepEqual(store.published().map(a=>a.title),['LOVE','Scarlet','Later']);review(id);
  assert.deepEqual(store.published().map(a=>a.title),['Later','Scarlet','LOVE']);assert.deepEqual(store.list().map(a=>a.title),['Later','Scarlet','LOVE']);assert.deepEqual(store.db.prepare('SELECT * FROM albums ORDER BY id').all(),original);
  const reopened=new AlbumStore(directory);assert.equal(readCatalogOrder(reopened.db).mode,'manual');assert.deepEqual(reopened.published().map(a=>a.title),['Later','Scarlet','LOVE']);reopened.close();
  assert.throws(()=>submit(admin,[], 'release-date'),/只能调整/);
  const restore=submit(admin,order.state().albums.map(a=>a.id),'release-date');review(restore);assert.equal(store.published()[0].title,'LOVE');
});
test('manual and chronological changes from administrators also require review; new approved albums append without changing saved manual ranks',t=>{
  const{store,admin,order,submit,review,publish}=setup(t);review(submit(admin));
  publish('New early album','1979');assert.deepEqual(store.published().map(a=>a.title),['Later','Scarlet','LOVE','New early album']);
  const id=submit(admin,order.state().albums.map(a=>a.id),'release-date');assert.equal(order.list(admin).find(r=>r.id===id)?.status,'pending');assert.equal(store.published()[0].title,'Later');review(id);
  assert.deepEqual(store.published().map(a=>a.title),['New early album','LOVE','Scarlet','Later']);
});
test('catalogue requests validate the exact approved set and isolate private drafts and other contributors requests',t=>{
  const{store,a,b,admin,order,submit}=setup(t);const draft=b.save({...emptyAlbum(),title:'Private draft'},'draft'),state=order.state(),ids=state.albums.map(a=>a.id);
  assert.ok(!JSON.stringify(state).includes(draft.title));
  for(const invalid of [[ids[0],ids[0],ids[2]],ids.slice(1),[...ids,draft.id],[...ids,'forged']])assert.throws(()=>order.submit(a.user,'manual',invalid,state.revision,state.fingerprint,''),StoreError);
  assert.throws(()=>order.submit(a.user,'other' as 'manual',ids,state.revision,state.fingerprint,''),/无效/);assert.throws(()=>order.submit(a.user,'manual',ids,state.revision,state.fingerprint,'x'.repeat(2001)),/无效/);
  assert.throws(()=>order.submit(a.user,'release-date',ids,state.revision,state.fingerprint,''),/未改变/);
  const id=submit(a.user);assert.deepEqual(order.list(b.user),[]);assert.equal(order.list(a.user).length,1);assert.equal(order.list(admin).length,1);
  assert.throws(()=>submit(a.user),/待审核/);assert.throws(()=>order.review(b.user,id,'approved',1,''),e=>e instanceof StoreError&&e.status===403);
  assert.deepEqual(store.published().map(a=>a.title),['LOVE','Scarlet','Later']);
});
test('stale order revisions and changed published snapshots cannot overwrite a newer catalogue; rejected requests can be resubmitted',t=>{
  const{a,b,order,submit,review,publish}=setup(t),state=order.state(),first=submit(a.user),second=submit(b.user);review(first);
  assert.throws(()=>review(second),/已更新/);review(second,'rejected');
  assert.throws(()=>order.submit(b.user,'release-date',state.albums.map(a=>a.id),state.revision,state.fingerprint,''),e=>e instanceof StoreError&&e.status===409);
  const fresh=submit(b.user,order.state().albums.map(a=>a.id),'release-date');publish('New record','1982');assert.throws(()=>review(fresh),/已更新/);review(fresh,'rejected');
  review(submit(b.user,order.state().albums.map(a=>a.id),'release-date'));assert.equal(order.state().mode,'release-date');
});
test('pending catalogue requests reject stale review revisions and are not reusable after rejection or approval',t=>{
  const{admin,order,submit,review}=setup(t),id=submit();assert.throws(()=>order.review(admin,id,'approved',0,''),/已更新/);review(id,'rejected');assert.throws(()=>review(id),/已更新/);
  const next=submit();review(next);assert.throws(()=>review(next),/已更新/);assert.equal(order.state().revision,1);
});
test('failed audit writes roll back both catalogue approvals and request submission atomically',t=>{
  const{store,admin,a,order,submit,review}=setup(t);store.db.exec("CREATE TRIGGER fail_catalog_audit BEFORE INSERT ON contributor_audit WHEN NEW.action LIKE 'catalog-order-%' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");
  assert.throws(()=>submit(),/test audit failure/);assert.deepEqual(order.list(a.user),[]);store.db.exec('DROP TRIGGER fail_catalog_audit');const id=submit();
  store.db.exec("CREATE TRIGGER fail_catalog_audit BEFORE INSERT ON contributor_audit WHEN NEW.action='catalog-order-approved' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");assert.throws(()=>review(id),/test audit failure/);assert.equal(order.state().revision,0);assert.equal(order.list(admin)[0].status,'pending');assert.equal(store.published()[0].title,'LOVE');
  store.db.exec('DROP TRIGGER fail_catalog_audit');review(id);assert.equal(order.state().revision,1);
});
test('disabled users and stale or forged administrator roles cannot submit or review catalogue ordering',t=>{
  const{identity,admin,a,order,submit}=setup(t),id=submit();identity.disable(admin,a.user.id,true);
  assert.throws(()=>order.list(a.user),e=>e instanceof StoreError&&e.status===403);assert.throws(()=>submit(a.user),e=>e instanceof StoreError&&e.status===403);assert.throws(()=>order.review({...a.user,role:'admin'},id,'approved',1,''),e=>e instanceof StoreError&&e.status===403);
});
