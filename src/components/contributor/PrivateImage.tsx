'use client';
import { useEffect,useState } from 'react';
export default function PrivateImage({storageKey,src,token,className='private-media-preview',alt='版本封面',width,height,loading}:{storageKey?:string;src?:string;token:string;className?:string;alt?:string;width?:number;height?:number;loading?:'lazy'|'eager'}){
  const [url,setUrl]=useState(''),[error,setError]=useState('');
  const endpoint=src??`/api/contributor/media/${storageKey?.split('/').map(encodeURIComponent).join('/')}`;
  useEffect(()=>{let active=true,objectUrl='';setUrl('');setError('');fetch(endpoint,{headers:{'x-local-editor-token':token},cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('无法读取图片');const blob=await r.blob();if(active){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[endpoint,token]);
  return <>{url&&<img className={className} src={url} alt={alt} width={width} height={height} loading={loading}/>}{error&&<span className="editor-muted">{error}</span>}</>;
}
