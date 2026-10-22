export const MEMBER_BIO_LIMIT=80;
// Count Unicode characters rather than UTF-16 units so an emoji counts as one.
export const bioLength=(bio:string)=>Array.from(bio.trim()).length;
// Bound legacy biographies in directory responses without rewriting stored text.
export const memberBio=(bio:string)=>Array.from(bio.trim()).slice(0,MEMBER_BIO_LIMIT).join('');
