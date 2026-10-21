export type RightsStatus = 'metadata-only' | 'private' | 'licensed-public';
export type ReleaseType = 'album' | 'single' | 'ep' | 'compilation' | 'live' | 'other';
export type MediaType = 'audio' | 'image' | 'video';
export interface ArchiveMedia {
  id: string; type: MediaType; path?: string; rightsStatus: RightsStatus;
  sourceUrl?: string; sourceLabel?: string; isDemo: boolean;
}
export interface ArchiveSource { sourceUrl?: string; sourceLabel?: string; isDemo: boolean }
export interface Release extends ArchiveSource {
  slug: string; title: string; titleZh: string; year: number; releaseDate: string;
  type: ReleaseType; cover: string; coverAlt: string; description: string;
  catalogNumber: string | null; label: string;
  tracks: { number: number; title: string; duration: string | null; note?: string }[];
  media: ArchiveMedia[];
}
export interface PhotoBook extends ArchiveSource {
  slug: string; title: string; subtitle: string; category: '写真集' | '杂志' | '歌词册';
  year: number | null; publishedDate: string | null; publisher: string | null; isbn: string | null;
  cover: string; images: { src: string; alt: string; caption: string }[];
  description: string; media: ArchiveMedia[];
}
export interface Video extends ArchiveSource {
  slug: string; title: string; category: '电视节目' | '演唱会' | '采访';
  year: number | null; date: string | null; program: string | null; thumbnail: string;
  description: string; relatedReleaseSlugs: string[]; media: ArchiveMedia[];
}

// Canonical editable model; Release above is the legacy catalog view model.
export type EntryStatus = 'draft' | 'pending-review' | 'published';
export type PartialDate = { value: string; precision: 'year' | 'month' | 'day' } | null;
export interface Credit { id: string; name: string }
export interface AlbumTrack {
  id: string; position: string; title: string; translatedTitle: string | null;
  durationSeconds: number | null; durationText: string;
  lyricists: Credit[]; composers: Credit[]; arrangers: Credit[];
  lyricsText: string | null; lyricsSource: string | null;
  lyricsRightsStatus: RightsStatus; lyricsPublicationConfirmed: boolean; notes: string | null;
}
export interface PurchaseLink { id: string; merchantName: string; url: string; note: string | null }
export interface AlbumEdition {
  id: string; editionName: string | null; catalogNumber: string | null; label: string | null;
  format: string | null; releaseDate: PartialDate; releaseRegion: string | null;
  barcode: string | null; notes: string | null; purchaseLinks: PurchaseLink[];
  trackIds: string[];
  tracks: AlbumTrack[]; description: string | null; sources: SourceReference[]; editorNotes: string | null;
}
export interface AlbumMedia {
  id: string; albumId: string; relatedEditionId: string | null; relatedTrackId: string | null;
  type: 'cover' | 'scan' | 'audio'; displayName: string | null; storageKey: string | null;
  source: string | null; rightsStatus: RightsStatus; publicationConfirmed: boolean;
  mimeType: string | null; size: number | null; bitDepth: number | null; sampleRate: number | null;
  audioScope: 'album' | 'track' | null; codec: string | null; durationSeconds: number | null; channels: number | null;
}
export interface SourceReference { id: string; label: string; url: string | null; note: string | null }
export interface Album {
  id: string; slug: string; title: string; originalTitle: string | null; translatedTitle: string | null;
  artist: string; type: ReleaseType | null; firstReleaseDate: PartialDate;
  description: string | null; aliases: string[]; tracks: AlbumTrack[]; editions: AlbumEdition[];
  media: AlbumMedia[]; sources: SourceReference[]; status: EntryStatus; contributor: string;
  editorNotes: string | null; changeNote: string | null; createdAt: string; updatedAt: string;
  revision: number; deletedAt: string | null;
}
export interface AlbumRevision { id: number; albumId: string; action: string; contributor: string; createdAt: string; summary: string[]; snapshot: Album }
export type PublicTrack = Omit<AlbumTrack, 'lyricsText' | 'lyricsRightsStatus' | 'lyricsPublicationConfirmed'> & { lyricsText: string | null; hasPrivateLyrics: boolean };
export type PublicEdition = Omit<AlbumEdition, 'tracks' | 'editorNotes'> & { tracks: PublicTrack[] };
export type PublicAlbum = Omit<Album, 'editorNotes' | 'changeNote' | 'deletedAt' | 'media' | 'tracks' | 'editions'> & {
  editions: PublicEdition[];
  tracks: PublicTrack[]; media: { id: string; type: AlbumMedia['type']; displayName: string | null; relatedEditionId: string | null; url: string }[];
};
