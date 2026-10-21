import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,readdirSync,existsSync,rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { AlbumStore,StoreError } from '../src/lib/album-store';
import { emptyAlbum,emptyTrack,emptyMedia } from '../src/lib/albums';
import { inspectLossless,receiveAudio } from '../src/lib/lossless-audio';
import { MAX_AUDIO_BYTES } from '../src/lib/audio-options';
const fixture=(name:string)=>path.join(process.cwd(),'tests/fixtures/lossless',name);
function setup(t:TestContext){const directory=mkdtempSync(path.join(tmpdir(),'naoko-audio-test-')),store=new AlbumStore(directory);t.after(()=>{try{store.close();}catch{}rmSync(directory,{recursive:true,force:true});});return {store,directory};}
async function receive(directory:string,name='test.flac'){
  const bytes=readFileSync(fixture(name));
  const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes.subarray(0,30));controller.enqueue(bytes.subarray(30));controller.close();}});
  return receiveAudio(directory,body,name,bytes.length);
}
test('four real lossless formats expose actual codec and audio specifications',async()=>{
  for(const [name,codec] of [['test.flac','FLAC'],['test.wav','PCM'],['test.aiff','PCM'],['test.m4a','ALAC']]){
    const f=await inspectLossless(fixture(name),name);assert.equal(f.codec,codec);assert.equal(f.bitDepth,16);assert.equal(f.sampleRate,44100);assert.equal(f.channels,2);assert.ok(f.durationSeconds>0);
  }
});
test('AAC in an M4A container and misleading extensions are rejected',async()=>{
  await assert.rejects(inspectLossless(fixture('lossy.m4a'),'test.m4a'),/ALAC/);
  await assert.rejects(inspectLossless(fixture('test.wav'),'renamed.flac'),/无损格式/);
  await assert.rejects(inspectLossless(fixture('test.flac'),'renamed.mp3'),/仅支持/);
});
test('stream receiver enforces byte limit and cleans truncated, empty and invalid files',async t=>{
  const {directory}=setup(t),data=readFileSync(fixture('test.wav'));
  const body=()=>new ReadableStream<Uint8Array>({start(c){c.enqueue(data);c.close();}});
  await assert.rejects(receiveAudio(directory,body(),'test.wav',MAX_AUDIO_BYTES+1),/4 GB/);
  await assert.rejects(receiveAudio(directory,body(),'test.wav',data.length+1),/不完整/);
  await assert.rejects(receiveAudio(directory,new ReadableStream({start(c){c.close();}}),'empty.flac',0),/不能为空/);
  assert.deepEqual(readdirSync(path.join(directory,'private-media','.incoming')),[]);
});
test('whole album storage persists with authoritative metadata and becomes available with its approved album',async t=>{
  const {store,directory}=setup(t);let a=store.save({...emptyAlbum(),title:'TEST whole album'},'draft');
  const prepared=await receive(directory);a=store.attachAudio(a.id,a.revision,prepared,'album');const m=a.media[0];
  assert.equal(m.audioScope,'album');assert.equal(m.relatedTrackId,null);assert.equal(m.codec,'FLAC');assert.equal(m.bitDepth,16);assert.equal(m.sampleRate,44100);assert.equal(m.rightsStatus,'private');
  assert.ok(!existsSync(prepared.temporaryPath));const f=store.audioFile(m.storageKey!);assert.deepEqual(readFileSync(f.path),readFileSync(fixture('test.flac')));
  assert.throws(()=>store.file(m.storageKey!),e=>e instanceof StoreError&&e.status===403);
  a=store.save({...a,media:[{...m,codec:'forged',sampleRate:1,rightsStatus:'licensed-public',publicationConfirmed:true}]},'submit',a.id,a.revision);
  assert.equal(a.media[0].codec,'FLAC');assert.equal(a.media[0].sampleRate,44100);assert.equal(a.media[0].rightsStatus,'private');
  a=store.transition(a.id,'approve',a.revision,true);assert.equal(store.published().find(x=>x.id===a.id)?.media.length,1);
  store.close();const reopened=new AlbumStore(directory);assert.equal(reopened.get(a.id)?.media[0].storageKey,m.storageKey);reopened.close();
});
test('track upload links only an existing stable track without creating or renaming tracks',async t=>{
  const {store,directory}=setup(t),track=emptyTrack(1);track.title='TEST existing song';let a=store.save({...emptyAlbum(),tracks:[track]},'draft');
  const rejected=await receive(directory);assert.throws(()=>store.attachAudio(a.id,a.revision,rejected,'new-track'),/曲目/);assert.ok(!existsSync(rejected.temporaryPath));assert.equal(store.get(a.id)?.tracks.length,1);
  a=store.attachAudio(a.id,a.revision,await receive(directory),track.id);assert.equal(a.tracks.length,1);assert.equal(a.tracks[0].title,'TEST existing song');assert.equal(a.media[0].relatedTrackId,a.tracks[0].id);assert.equal(a.media[0].audioScope,'track');assert.equal(a.tracks[0].durationSeconds,2);
  const id=a.tracks[0].id;a=store.attachAudio(a.id,a.revision,await receive(directory,'test.wav'),id);assert.equal(a.tracks.length,1);assert.equal(a.media[1].relatedTrackId,id);
  a.tracks[0].title='TEST renamed';a=store.save(a,'draft',a.id,a.revision);assert.equal(a.media[1].relatedTrackId,id);
  const unattached=store.save({...a,tracks:[],media:a.media.map(m=>({...m,relatedTrackId:null}))},'draft',a.id,a.revision);assert.ok(unattached.media.every(m=>m.audioScope==='track'&&m.relatedTrackId===null));
});
test('audio replacement preserves the reviewed snapshot; stale upload leaves no orphan file',async t=>{
  const {store,directory}=setup(t);let a=store.save({...emptyAlbum(),title:'TEST snapshot'},'draft');
  a=store.attachAudio(a.id,a.revision,await receive(directory),'album');a=store.save(a,'submit',a.id,a.revision);a=store.transition(a.id,'approve',a.revision,true);
  const oldKey=a.media[0].storageKey!,id=a.media[0].id;a=store.attachAudio(a.id,a.revision,await receive(directory,'test.m4a'),'album',id);
  assert.equal(a.media.length,1);assert.equal(a.media[0].id,id);assert.equal(a.media[0].codec,'ALAC');assert.equal(store.publishedRaw(a.id)?.media[0].storageKey,oldKey);assert.ok(existsSync(store.audioFile(oldKey).path));
  const p=await receive(directory),files=readdirSync(path.join(directory,'private-media')).filter(n=>n!=='.incoming');
  assert.throws(()=>store.attachAudio(a.id,a.revision-1,p,'album'),e=>e instanceof StoreError&&e.status===409);assert.ok(!existsSync(p.temporaryPath));assert.deepEqual(readdirSync(path.join(directory,'private-media')).filter(n=>n!=='.incoming'),files);
});
test('audio cannot masquerade as a cover or point to another album or a missing track',async t=>{
  const {store,directory}=setup(t);let a=store.save(emptyAlbum(),'draft');a=store.attachAudio(a.id,a.revision,await receive(directory),'album');
  assert.throws(()=>store.save({...a,media:[{...a.media[0],type:'cover'}]},'draft',a.id,a.revision),/引用无效/);
  const other=store.save(emptyAlbum(),'draft');assert.throws(()=>store.save({...other,media:[a.media[0]]},'draft',other.id,other.revision),/引用无效/);
  const p=await receive(directory);assert.throws(()=>store.attachAudio(a.id,a.revision,p,'missing-track'),e=>e instanceof StoreError&&e.status===400);assert.ok(!existsSync(p.temporaryPath));
});
