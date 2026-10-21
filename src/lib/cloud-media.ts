import { AbstractTokenizer,EndOfStreamError,type IReadChunkOptions } from 'strtok3';
import { parseFromTokenizer } from 'music-metadata';
import { StoreError } from './album-store';
import type { AudioFacts } from './lossless-audio';
import { MAX_AUDIO_BYTES } from './audio-options';
import { MAX_IMAGE_BYTES } from './albums';

export type CloudKind='cover'|'scan'|'audio';
export function uploadFormat(name:string,mime:string,size:number,kind:CloudKind){
  if(!name||name.length>500||/[\0/\\]/.test(name)||!Number.isSafeInteger(size)||size<1)throw new StoreError('文件信息无效');
  if(kind==='audio'){
    const ext=name.split('.').at(-1)?.toLowerCase()??'',formats:Record<string,{extension:string;mime:string}>={flac:{extension:'flac',mime:'audio/flac'},wav:{extension:'wav',mime:'audio/wav'},wave:{extension:'wav',mime:'audio/wav'},aif:{extension:'aiff',mime:'audio/aiff'},aiff:{extension:'aiff',mime:'audio/aiff'},m4a:{extension:'m4a',mime:'audio/mp4'}};
    if(!formats[ext]||size>MAX_AUDIO_BYTES)throw new StoreError('请选择不超过 4 GB 的 FLAC、WAV、AIFF 或 ALAC 文件');return formats[ext];
  }
  const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!ext[mime]||size>MAX_IMAGE_BYTES)throw new StoreError('请选择不超过 10 MB 的 JPEG、PNG 或 WebP 图片');return {extension:ext[mime],mime};
}

// Skip audio payload ranges while parsing container metadata (including ALAC
// with its moov atom at EOF). Never download a 4 GB recording into the app.
export class RangeTokenizer extends AbstractTokenizer{
  fileInfo:{size:number;mimeType:string;path:string};
  private cache=new Map<number,Uint8Array>();
  private readBytes=0;
  constructor(size:number,mime:string,name:string,readonly range:(start:number,end:number)=>Promise<Uint8Array>){super({maxBufferSize:8*1024*1024});this.fileInfo={size,mimeType:mime,path:name};}
  supportsRandomAccess(){return true;}
  setPosition(n:number){this.validateLength(n,'position');if(n>this.fileInfo.size)throw new EndOfStreamError();this.position=n;}
  async readBuffer(buffer:Uint8Array,options?:IReadChunkOptions){const o=this.normalizeOptions(buffer,options),n=await this.peekBuffer(buffer,o);this.position=o.position+n;return n;}
  async peekBuffer(buffer:Uint8Array,options?:IReadChunkOptions){
    const o=this.normalizeOptions(buffer,options),length=Math.max(0,Math.min(o.length,this.fileInfo.size-o.position));
    if(length<o.length&&!o.mayBeLess)throw new EndOfStreamError();
    let copied=0;while(copied<length){
      const position=o.position+copied,block=Math.floor(position/65536)*65536;
      let bytes=this.cache.get(block);if(!bytes){
        const end=Math.min(block+65535,this.fileInfo.size-1);this.readBytes+=end-block+1;
        if(this.readBytes>8*1024*1024)throw new StoreError('音源元数据过大，无法安全校验');
        bytes=await this.range(block,end);if(bytes.length!==end-block+1)throw new StoreError('COS 文件读取不完整');this.cache.set(block,bytes);
      }
      const n=Math.min(length-copied,bytes.length-(position-block));buffer.set(bytes.subarray(position-block,position-block+n),copied);copied+=n;
    }return copied;
  }
}
export async function inspectCloudAudio(size:number,mime:string,name:string,range:(start:number,end:number)=>Promise<Uint8Array>):Promise<AudioFacts>{
  const tokenizer=new RangeTokenizer(size,mime,name,range);
  try{
    const {format:f}=await parseFromTokenizer(tokenizer,{duration:true,skipCovers:true});
    const ext=name.split('.').at(-1)?.toLowerCase(),codec=f.codec??'',container=f.container??'';
    const kind=codec==='FLAC'&&container==='FLAC'&&ext==='flac'?'flac':codec==='PCM'&&container==='WAVE'&&['wav','wave'].includes(ext??'')?'wav':codec==='PCM'&&container==='AIFF'&&['aif','aiff'].includes(ext??'')?'aiff':codec==='ALAC'&&container.startsWith('M4A')&&ext==='m4a'?'m4a':null;
    if(!kind||f.lossless!==true||f.hasAudio!==true||f.hasVideo===true)throw new StoreError('实际编码不支持；M4A 必须为 ALAC，不能为 AAC');
    if(![f.bitsPerSample,f.sampleRate,f.numberOfChannels,f.duration].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))throw new StoreError('音源缺少有效的位深、采样率、声道或时长');
    return {codec:codec as AudioFacts['codec'],extension:kind,mimeType:mime,size,bitDepth:f.bitsPerSample!,sampleRate:f.sampleRate!,channels:f.numberOfChannels!,durationSeconds:f.duration!};
  }catch(e){if(e instanceof StoreError)throw e;throw new StoreError('无法读取完整的无损音源元数据');}finally{await tokenizer.close();}
}
export function verifyImageHeader(bytes:Uint8Array,mime:string){
  const b=Buffer.from(bytes),actual=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':'';
  if(actual!==mime)throw new StoreError('图片内容与所选格式不一致');
}
