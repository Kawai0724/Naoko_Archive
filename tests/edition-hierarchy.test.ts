import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { AlbumStore } from '../src/lib/album-store';
import { emptyAlbum,emptyEdition,emptyTrack,publicAlbum } from '../src/lib/albums';
import { editionCover,editionEditorAlbum,mergeEditionEditor } from '../src/lib/edition-hierarchy';
import { withLocalCoverPreviews } from '../src/lib/local-cover-preview';
import { receiveAudio } from '../src/lib/lossless-audio';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
function setup(t:TestContext){const directory=mkdtempSync(path.join(tmpdir(),'naoko-editions-')),store=new AlbumStore(directory);t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});return {store,directory};}
function twoEditions(){return {...emptyAlbum(),title:'TEST parent album',editions:[{...emptyEdition(),editionName:'TEST first',catalogNumber:'TEST-01'},{...emptyEdition(),editionName:'TEST second',catalogNumber:'TEST-02'}]};}
test('album creation is empty; version editor changes only the selected version',t=>{
  const {store}=setup(t);let a=store.save({...emptyAlbum(),title:'TEST album'},'draft');assert.equal(a.editions.length,0);
  a=store.save({...a,editions:twoEditions().editions},'draft',a.id,a.revision);const first=a.editions[0].id,second=a.editions[1].id,p=editionEditorAlbum(a,first),track=emptyTrack(1);track.title='TEST version one song';p.tracks=[track];p.editions[0].catalogNumber='TEST-CHANGED';p.description='TEST first version description';
  a=store.save(mergeEditionEditor(a,p,first),'draft',a.id,a.revision);assert.equal(a.editions[0].tracks[0].title,track.title);assert.equal(a.editions[1].tracks.length,0);assert.equal(a.editions[1].catalogNumber,'TEST-02');assert.equal(a.editions[1].id,second);assert.equal(a.description,null);assert.equal(a.tracks.length,0);
});
test('each version has six image slots; cover selection follows version order and never skips a missing first cover',t=>{
  const {store}=setup(t);let a=store.save(twoEditions(),'draft');const [first,second]=a.editions.map(e=>e.id),files=Array.from({length:6},(_,i)=>({name:`test-${i}.png`,bytes:png}));
  a=store.attachImages(a,files,a.id,a.revision,undefined,'cover',second);assert.equal(editionCover(a.media,a.editions[0].id),undefined);assert.ok(editionCover(a.media,second));
  a=store.attachImages(a,files,a.id,a.revision,undefined,'cover',first);assert.equal(a.media.length,12);assert.equal(editionCover(a.media,a.editions[0].id)?.relatedEditionId,first);
  assert.throws(()=>store.attachImages(a,files.slice(0,1),a.id,a.revision,undefined,'scan',first),/最多提交 6/);
  assert.throws(()=>store.attachImages(a,files.slice(0,1),a.id,a.revision,a.media[0].id,'cover',first),/其他版本/);
  a=store.save({...a,media:a.media.map(m=>({...m,rightsStatus:'licensed-public',publicationConfirmed:true}))},'submit',a.id,a.revision);a=store.transition(a.id,'approve',a.revision,true);
  a=store.save({...a,editions:[...a.editions].reverse()},'draft',a.id,a.revision);const published=store.publishedRaw(a.id)!;assert.equal(published.editions[0].id,first);assert.equal(editionCover(a.media,a.editions[0].id)?.relatedEditionId,second);
  a=store.save(a,'submit',a.id,a.revision);a=store.transition(a.id,'approve',a.revision,true);assert.equal(store.publishedRaw(a.id)?.editions[0].id,second);
});
test('version lyrics and editor notes are removed from public nested records',t=>{
  const {store}=setup(t),input=twoEditions(),track=emptyTrack(1);track.title='TEST track';track.lyricsText='PRIVATE_EDITION_LYRICS';input.editions[0].tracks=[track];input.editions[0].editorNotes='PRIVATE_EDITION_NOTE';let a=store.save(input,'submit');a=store.transition(a.id,'approve',a.revision,true);const view=publicAlbum(a),json=JSON.stringify(view);assert.equal(view.editions[0].tracks[0].lyricsText,null);assert.ok(!json.includes('PRIVATE_EDITION'));assert.ok(!('editorNotes' in view.editions[0]));
});
test('audio uploads link existing tracks inside one version, with no cross-version association',async t=>{
  const {store,directory}=setup(t),input=twoEditions(),track=emptyTrack(1);track.title='TEST existing version song';input.editions[0].tracks=[track];let a=store.save(input,'draft');const [first,second]=a.editions.map(e=>e.id),bytes=readFileSync(path.join(process.cwd(),'tests/fixtures/lossless/test.flac'));
  const prepared=()=>receiveAudio(directory,new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),'test.flac',bytes.length);
  a=store.attachAudio(a.id,a.revision,await prepared(),track.id,undefined,first);assert.equal(a.tracks.length,0);assert.equal(a.editions[0].tracks.length,1);assert.equal(a.editions[1].tracks.length,0);assert.equal(a.media[0].relatedEditionId,first);
  const trackId=a.editions[0].tracks[0].id;
  const invalid=await prepared();assert.throws(()=>store.attachAudio(a.id,a.revision,invalid,trackId,undefined,second),/曲目/);
  a=store.attachAudio(a.id,a.revision,await prepared(),trackId,undefined,first);assert.equal(a.editions[0].tracks.length,1);assert.equal(a.media[1].relatedTrackId,trackId);
});
test('legacy database migrates shared data once without losing files or published snapshot privacy',t=>{
  const {store,directory}=setup(t);let a=store.save(twoEditions(),'draft');a=store.attachImages(a,[{name:'old.png',bytes:png}],a.id,a.revision);const key=a.media[0].storageKey!,track=emptyTrack(1);track.title='TEST legacy song';track.lyricsText='PRIVATE_LEGACY_LYRICS';a.tracks=[track];a.editorNotes='PRIVATE_OLD_NOTE';
  const old=structuredClone(a) as unknown as Record<string,unknown>;for(const e of old.editions as Record<string,unknown>[])for(const k of ['tracks','description','sources','editorNotes'])delete e[k];
  const json=JSON.stringify(old);store.db.prepare('UPDATE albums SET working_json=?,published_json=? WHERE id=?').run(json,json,a.id);store.db.prepare('DELETE FROM archive_schema WHERE key=?').run('edition-hierarchy-v1');store.close();
  const migrated=new AlbumStore(directory),b=migrated.get(a.id)!;assert.equal(b.editions[0].editorNotes,'PRIVATE_OLD_NOTE');assert.equal(b.editions[0].tracks[0].title,track.title);assert.equal(b.editions[1].tracks[0].title,track.title);assert.equal(b.media[0].relatedEditionId,b.editions[0].id);assert.deepEqual(migrated.file(key).bytes,png);assert.ok(!JSON.stringify(migrated.published()).includes('PRIVATE_LEGACY_LYRICS'));const revision=b.revision;migrated.close();const again=new AlbumStore(directory);assert.equal(again.get(a.id)?.revision,revision);again.close();
});

test('local cover previews use each current edition cover without publishing files or draft metadata',t=>{
  const {store}=setup(t);let a=store.save(twoEditions(),'submit');a=store.transition(a.id,'approve',a.revision,true);
  const published=store.published().find(p=>p.id===a.id)!,first=a.editions[0].id,second=a.editions[1].id;
  a=store.attachImages(a,[{name:'private-first.png',bytes:png}],a.id,a.revision,undefined,'cover',first);
  a.title='PRIVATE_DRAFT_TITLE';const view=withLocalCoverPreviews(published,a),json=JSON.stringify(view);
  assert.equal(view.title,published.title);assert.ok(view.localCovers?.[first]?.url.includes(`/covers/${first}?v=${a.revision}`));assert.equal(view.localCovers?.[second],null);
  assert.equal(view.localCovers?.[first]?.alt,'private-first.png');assert.ok(!json.includes(a.media[0].storageKey!));assert.ok(!json.includes('PRIVATE_DRAFT_TITLE'));
  assert.equal(store.published().find(p=>p.id===a.id)?.media.length,0);assert.equal(a.media[0].rightsStatus,'private');assert.equal(a.media[0].publicationConfirmed,false);
  a=store.attachImages(a,[{name:'private-second.png',bytes:png}],a.id,a.revision,undefined,'cover',second);
  a.media=a.media.filter(m=>m.relatedEditionId!==first);const missing=withLocalCoverPreviews(published,a);
  assert.equal(missing.localCovers?.[first],null);assert.equal(missing.localCovers?.[second]?.alt,'private-second.png');
  assert.equal(withLocalCoverPreviews(published,{...a,deletedAt:'removed'}),published);
  assert.equal(withLocalCoverPreviews(published,{...a,id:'another-album'}),published);
});
