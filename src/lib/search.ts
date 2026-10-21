export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export const matchesSearch = (query: string, ...values: (string | number | null | undefined)[]) => {
  const haystack = normalize(values.filter(v => v != null).join(' '));
  return normalize(query).split(' ').every(term => haystack.includes(term));
};
