import type { Metadata } from 'next';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NAOKO ARCHIVE · 河合奈保子数字档案馆', template: '%s · NAOKO ARCHIVE' },
  description: '从唱片、纸页与影像之间，重读河合奈保子的作品。非官方歌迷资料站，本地原型。',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
