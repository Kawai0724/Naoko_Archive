export const MAX_AUDIO_BYTES=4*1024*1024*1024;
export const LOSSLESS_AUDIO_ACCEPT='.flac,.wav,.wave,.aif,.aiff,.m4a';
export const audioFileTitle=(name:string)=>name.replace(/\.[^.]+$/,'').trim()||'未命名曲目';
export const audioFileSize=(bytes:number|null)=>bytes==null?'':bytes>=1024**3?`${(bytes/1024**3).toFixed(2)} GB`:`${(bytes/1024**2).toFixed(1)} MB`;
