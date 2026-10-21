import { createWriteStream } from 'node:fs';
import { mkdir,stat,unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable,Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseFile } from 'music-metadata';
import { MAX_AUDIO_BYTES } from './audio-options';

export class AudioUploadError extends Error{constructor(message:string,public status=400){super(message);}}
export interface AudioFacts {codec:'FLAC'|'PCM'|'ALAC';extension:'flac'|'wav'|'aiff'|'m4a';mimeType:string;size:number;bitDepth:number;sampleRate:number;channels:number;durationSeconds:number}
export interface PreparedAudio{temporaryPath:string;name:string;facts:AudioFacts}
export async function inspectLossless(filePath:string,name:string):Promise<AudioFacts>{
  const ext=path.extname(name).toLowerCase(),size=(await stat(filePath)).size;
  if(!['.flac','.wav','.wave','.aif','.aiff','.m4a'].includes(ext))throw new AudioUploadError('仅支持 FLAC、PCM WAV、AIFF 和 ALAC（.m4a）无损音源');
  if(!size||size>MAX_AUDIO_BYTES)throw new AudioUploadError('音源不能为空，每个文件不得超过 4 GB',size?413:400);
  try{
    const {format:f}=await parseFile(filePath,{duration:true,skipCovers:true});
    const codec=f.codec??'',container=f.container??'';
    const kind=codec==='FLAC'&&container==='FLAC'&&ext==='.flac'?'flac':codec==='PCM'&&container==='WAVE'&&['.wav','.wave'].includes(ext)?'wav':codec==='PCM'&&container==='AIFF'&&['.aif','.aiff'].includes(ext)?'aiff':codec==='ALAC'&&container.startsWith('M4A')&&ext==='.m4a'?'m4a':null;
    if(!kind||f.lossless!==true||f.hasAudio!==true||f.hasVideo===true)throw new AudioUploadError('文件的实际编码不是支持的无损格式；M4A 必须为 ALAC，不能为 AAC');
    const values=[f.bitsPerSample,f.sampleRate,f.numberOfChannels,f.duration];
    if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))throw new AudioUploadError('音源缺少有效的位深、采样率、声道或时长信息');
    return {codec:codec as AudioFacts['codec'],extension:kind,mimeType:{flac:'audio/flac',wav:'audio/wav',aiff:'audio/aiff',m4a:'audio/mp4'}[kind],size,bitDepth:f.bitsPerSample!,sampleRate:f.sampleRate!,channels:f.numberOfChannels!,durationSeconds:f.duration!};
  }catch(e){if(e instanceof AudioUploadError)throw e;throw new AudioUploadError('无法读取音源，请选择完整的 FLAC、PCM WAV、AIFF 或 ALAC 文件');}
}
export async function receiveAudio(directory:string,body:ReadableStream<Uint8Array>|null,name:string,length:number,signal?:AbortSignal):Promise<PreparedAudio>{
  if(!body)throw new AudioUploadError('请选择音源文件');
  if(!name||name.length>500||/[\0/\\]/.test(name))throw new AudioUploadError('文件名无效');
  if(length>MAX_AUDIO_BYTES)throw new AudioUploadError('每个音源文件不得超过 4 GB',413);
  const dir=path.join(directory,'private-media','.incoming');await mkdir(dir,{recursive:true,mode:0o700});
  const temporaryPath=path.join(dir,`${randomUUID()}.upload`);let size=0;
  try{
    const limit=new Transform({transform(chunk:Buffer,_encoding,done){size+=chunk.length;if(size>MAX_AUDIO_BYTES)done(new AudioUploadError('每个音源文件不得超过 4 GB',413));else done(null,chunk);}});
    await pipeline(Readable.fromWeb(body as import('node:stream/web').ReadableStream<Uint8Array>),limit,createWriteStream(temporaryPath,{mode:0o600,flags:'wx'}),{signal});
    if(length>0&&length!==size)throw new AudioUploadError('音源传输不完整，请重新上传');
    return {temporaryPath,name,facts:await inspectLossless(temporaryPath,name)};
  }catch(e){await unlink(temporaryPath).catch(()=>{});throw e;}
}
