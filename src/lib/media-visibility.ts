import type { ContributorUser } from './identity-store';
import type { PublicAlbum } from './types';

// This projection is for reviewed albums only; draft media keeps owner checks.
export function visibleAlbumMedia(album:PublicAlbum,viewer:ContributorUser|null):PublicAlbum{
  const approved=viewer?.accountStatus==='approved';
  return {...album,
    imagesRequireLogin:!approved&&album.media.some(m=>m.type==='scan'),
    media:album.media.filter(m=>m.type==='cover'||approved&&(m.type==='scan'||viewer.role==='admin')),
  };
}
