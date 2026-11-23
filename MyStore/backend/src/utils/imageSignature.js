// A file's first bytes ("magic numbers") show what it really is. The browser-declared type can be faked.
const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

exports.looksLikeImage = (buf, mimetype) => {
  if (!buf || buf.length < 12) return false;
  switch (mimetype) {
    case 'image/jpeg': return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'image/png': return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif': return startsWith(buf, [0x47, 0x49, 0x46, 0x38]) && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61;
    case 'image/webp': return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
    default: return false;
  }
};
