export function databaseUrlForConnection(value?: string) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith('.tidbcloud.com')) return value;
    if (!url.searchParams.has('sslaccept')) url.searchParams.set('sslaccept', 'strict');
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '20');
    return url.toString();
  } catch {
    // Prisma mantiene el diagnóstico de URLs inválidas.
    return value;
  }
}
