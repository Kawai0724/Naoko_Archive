import type { PhotoBook } from '@/lib/types';
const gallery = [
  {src:'/placeholders/print-1.svg',alt:'原创湖岸几何版式，非历史写真',caption:'01 / 湖岸 · 原创版式演示'},
  {src:'/placeholders/print-2.svg',alt:'原创树影几何版式，非历史写真',caption:'02 / 树影 · 原创版式演示'},
  {src:'/placeholders/print-3.svg',alt:'原创留白文字版式，非历史写真',caption:'03 / 余白 · 原创版式演示'},
];
export const photobooks: PhotoBook[] = [
  {slug:'paper-and-light',title:'纸上，光的形状',subtitle:'一份关于观看与留白的版式习作',category:'写真集',year:null,publishedDate:null,publisher:null,isbn:null,cover:gallery[0].src,images:gallery,description:'这是写真阅读器的原创演示图集，并非河合奈保子的历史出版物。以几何图形、纸张与留白展示未来扫描资料的阅读方式。真实写真和出版信息仍待整理。',media:gallery.map((g,i)=>({id:`print-${i}`,type:'image',path:g.src,rightsStatus:'licensed-public',isDemo:true})),sourceLabel:'本站原创 SVG · 演示占位',isDemo:true},
  {slug:'magazine-study',title:'杂志页的留白',subtitle:'杂志资料阅读方式演示',category:'杂志',year:null,publishedDate:null,publisher:null,isbn:null,cover:gallery[1].src,images:[gallery[1],gallery[2]],description:'原创杂志版式演示。实际刊名、期号、出版日期与扫描页均待整理，当前不对应任何真实刊物。',media:[],sourceLabel:'本站原创 SVG · 演示占位',isDemo:true},
  {slug:'liner-notes-study',title:'唱片内页习作',subtitle:'歌词册与印刷物的目录位置',category:'歌词册',year:null,publishedDate:null,publisher:null,isbn:null,cover:gallery[2].src,images:[gallery[2],gallery[0]],description:'用于展示唱片附属印刷物的阅读布局。没有收录商业歌曲歌词或原版扫描；真实资料待整理。',media:[],sourceLabel:'本站原创 SVG · 演示占位',isDemo:true},
];
