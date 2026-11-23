const test = require('node:test');
const assert = require('node:assert/strict');
const { looksLikeImage } = require('../../src/utils/imageSignature');

const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(12)]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad([...Buffer.from('GIF89a')]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);

test('real image headers are accepted for their own type', () => {
  assert.ok(looksLikeImage(PNG, 'image/png'));
  assert.ok(looksLikeImage(JPG, 'image/jpeg'));
  assert.ok(looksLikeImage(GIF, 'image/gif'));
  assert.ok(looksLikeImage(WEBP, 'image/webp'));
});

test('a file claiming the wrong type is rejected', () => {
  assert.equal(looksLikeImage(PNG, 'image/jpeg'), false);
  assert.equal(looksLikeImage(JPG, 'image/png'), false);
});

test('scripts, text and empty files are rejected', () => {
  assert.equal(looksLikeImage(Buffer.from('<script>alert(1)</script>'), 'image/png'), false);
  assert.equal(looksLikeImage(Buffer.from('%PDF-1.4 fake pdf content'), 'image/jpeg'), false);
  assert.equal(looksLikeImage(Buffer.alloc(0), 'image/png'), false);
  assert.equal(looksLikeImage(PNG, 'application/pdf'), false);
});
