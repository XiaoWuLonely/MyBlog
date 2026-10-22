function safelyDecodeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeContentSlug(slug: string) {
  return safelyDecodeSlug(slug.trim());
}
