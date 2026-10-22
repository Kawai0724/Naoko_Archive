import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlbumStore,StoreError } from '../src/lib/album-store';
import { IdentityStore } from '../src/lib/identity-store';
import { ContributorStore } from '../src/lib/contributor-store';
import { emptyAlbum,emptyEdition,partialDate,normalizeAlbum } from '../src/lib/albums';
import { editionEditorAlbum,mergeEditionEditor,editionCover } from '../src/lib/edition-hierarchy';

const password='edition-order-test-password';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
function edition(name:string,date:string){return {...emptyEdition(),editionName:name,catalogNumber:name,releaseDate:partialDate(date)};}
function setup(t:TestContext){
  const directory=mkdtempSync(path.join(tmpdir(),'naoko-edition-order-')),store=new AlbumStore(directory),identity=new IdentityStore(store.db);
  identity.bootstrap(password);const admin=identity.login('fly-me-to-1980',password).user;
  const user=identity.register('order_editor',password,''),other=identity.register('other_editor',password,'');
  identity.reviewRegistration(admin,user.user.id,'approved',1,'');identity.reviewRegistration(admin,other.user.id,'approved',1,'');
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  return {directory,store,a:new ContributorStore(store,identity.session(user.token)!),b:new ContributorStore(store,identity.session(other.token)!),s:new ContributorStore(store,admin)};
}
test('new albums persist chronological edition order with stable partial dates and unknown dates last',t=>{
  const {store}=setup(t),input={...emptyAlbum(),title:'Date order',editions:[edition('later','1987'),edition('unknown',''),edition('same-a','1986-05'),edition('early','1980-01-21'),edition('same-b','1986-05'),edition('invalid','1985-02-30')]};
  const original=input.editions.map(e=>e.id),saved=store.save(input,'draft');
  assert.deepEqual(input.editions.map(e=>e.id),original);
  assert.equal(saved.editionOrder,'release-date');assert.deepEqual(saved.editions.map(e=>e.editionName),['early','same-a','same-b','later','unknown','invalid']);
  const manual=store.save({...saved,editionOrder:'manual',editions:[...saved.editions].reverse()},'draft',saved.id,saved.revision);
  assert.deepEqual(manual.editions.map(e=>e.id),saved.editions.map(e=>e.id).reverse());
  assert.throws(()=>normalizeAlbum({...manual,editionOrder:'publish-now'}),/排序方式/);
});
test('adding or editing a dated edition resorts automatic mode but preserves explicit manual mode',t=>{
  const {store}=setup(t);let album=store.save({...emptyAlbum(),title:'Versions',editions:[edition('first','1986'),edition('second','1987')]},'draft');
  const first=album.editions[0].id,second=album.editions[1].id,newEdition=edition('earliest','1980');
  let source={...album,editions:[...album.editions,newEdition]},editor=editionEditorAlbum(source,newEdition.id);
  album=store.save(mergeEditionEditor(source,editor,newEdition.id),'draft',album.id,album.revision);assert.equal(album.editions[0].id,newEdition.id);
  source={...album,editionOrder:'manual'};editor=editionEditorAlbum(source,second);editor.editionOrder='manual';editor.editions[0].releaseDate=partialDate('1979');
  album=store.save(mergeEditionEditor(source,editor,second),'draft',album.id,album.revision);assert.deepEqual(album.editions.map(e=>e.id),[newEdition.id,first,second]);
  editor=editionEditorAlbum(album,second);editor.editionOrder='release-date';
  album=store.save(mergeEditionEditor(album,editor,second),'draft',album.id,album.revision);assert.equal(album.editions[0].id,second);
});
test('manual order and first cover stay private until reviewed; permissions, rejection and persistence apply',t=>{
  const {directory,store,a,b,s}=setup(t);let album=a.save({...emptyAlbum(),title:'Reviewed order',editions:[edition('later','1987'),edition('early','1980')]},'draft');
  const [early,later]=album.editions.map(e=>e.id);
  for(const id of [early,later])album=store.attachImages(album,[{name:id+'.png',bytes:png}],album.id,album.revision,undefined,'cover',id);
  album=a.save(album,'submit',album.id,album.revision,'首次整理');let request=a.requests.pending(album.id)!;
  album=s.requests.review(s.user,request.id,'approved',request.revision).album;
  const approved=JSON.stringify(store.publishedRaw(album.id)),originalCover=editionCover(album.media,early)?.storageKey;
  album=a.save({...album,editionOrder:'manual',editions:[...album.editions].reverse()},'draft',album.id,album.revision);
  assert.equal(JSON.stringify(store.publishedRaw(album.id)),approved);
  assert.throws(()=>b.save(album,'draft',album.id,album.revision),e=>e instanceof StoreError&&e.status===404);
  album=a.save(album,'submit',album.id,album.revision,'优先展示再版');request=a.requests.pending(album.id)!;
  assert.equal(request.username,'order_editor');assert.equal(request.reason,'优先展示再版');
  const order=request.changes.find(c=>c.path==='editions.order')!;assert.ok(order.before.includes('early'));assert.ok(order.after.startsWith('later'));
  assert.ok(request.changes.some(c=>c.path==='editionOrder'&&c.before==='按发行日期'&&c.after==='手动排序'));
  assert.throws(()=>a.requests.review(a.user,request.id,'approved',request.revision),/管理员/);
  assert.throws(()=>a.save(album,'draft',album.id,album.revision),/正在审核/);
  album=s.requests.review(s.user,request.id,'rejected',request.revision,'请再次核对').album;assert.equal(JSON.stringify(store.publishedRaw(album.id)),approved);
  album=a.save(album,'submit',album.id,album.revision);request=a.requests.pending(album.id)!;album=s.requests.review(s.user,request.id,'approved',request.revision).album;
  const published=store.publishedRaw(album.id)!;assert.equal(published.editionOrder,'manual');assert.equal(published.editions[0].id,later);assert.notEqual(editionCover(published.media,published.editions[0].id)?.storageKey,originalCover);
  const reopened=new AlbumStore(directory);assert.deepEqual(reopened.publishedRaw(album.id)?.editions.map(e=>e.id),[later,early]);reopened.close();
  album=s.save({...album,editionOrder:'release-date'},'submit',album.id,album.revision,'恢复日期顺序');assert.equal(album.status,'pending-review');assert.equal(store.publishedRaw(album.id)?.editions[0].id,later);
  request=s.requests.pending(album.id)!;s.requests.review(s.user,request.id,'approved',request.revision);assert.equal(store.publishedRaw(album.id)?.editions[0].id,early);
});
test('legacy snapshots retain their approved order without migration; missing mode saves as manual',t=>{
  const {store,directory}=setup(t);let album=store.save({...emptyAlbum(),title:'Legacy order',editionOrder:'manual',editions:[edition('later','1987'),edition('earlier','1980')]},'submit');album=store.transition(album.id,'approve',album.revision,true);
  delete album.editionOrder;const snapshot=JSON.stringify(album);store.db.prepare('UPDATE albums SET working_json=?,published_json=? WHERE id=?').run(snapshot,snapshot,album.id);
  const reopened=new AlbumStore(directory);assert.equal(JSON.stringify(reopened.publishedRaw(album.id)),snapshot);
  const saved=reopened.save(reopened.get(album.id),'draft',album.id,album.revision);assert.equal(saved.editionOrder,'manual');assert.deepEqual(saved.editions.map(e=>e.editionName),['later','earlier']);assert.equal(JSON.stringify(reopened.publishedRaw(album.id)),snapshot);reopened.close();
});
