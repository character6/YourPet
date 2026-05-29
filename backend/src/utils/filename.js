/**
 * Multer иногда сохраняет кириллицу в originalname как latin1 — исправляем.
 */
export function fixFilenameEncoding(name) {
  if (!name || /[\u0400-\u04FF]/.test(name)) {
    return name;
  }
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    if (/[\u0400-\u04FF]/.test(fixed) || fixed !== name) {
      return fixed.normalize('NFC');
    }
  } catch {
    // ignore
  }
  return name;
}

export function safeDownloadName(name, fallback = 'file') {
  const fixed = fixFilenameEncoding(name) || fallback;
  return fixed.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}
