// Client-side implementation of the DB slugify_vn() function.
// Must produce identical output — used for slug preview before DB insertion.
export function slugifyVn(input: string): string {
  return input
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics (unaccent equivalent)
    .replace(/[Đ]/g, 'D')
    .replace(/[đ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function generateUniqueSlug(
  base: string,
  slugExists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugifyVn(base)
  if (!(await slugExists(baseSlug))) return baseSlug

  let suffix = 2
  while (await slugExists(`${baseSlug}-${suffix}`)) {
    suffix++
  }
  return `${baseSlug}-${suffix}`
}
