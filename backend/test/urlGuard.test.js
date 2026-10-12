import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl, isPrivateIp } from '../src/utils/urlGuard.js';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const privateLookup = async () => [{ address: '10.0.0.5', family: 4 }];

test('allows normal public https url', async () => {
  const u = await assertSafeUrl('https://shop.example.com/p/1', { lookup: publicLookup });
  assert.equal(u.hostname, 'shop.example.com');
});

for (const bad of [
  'http://localhost/admin', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://10.1.2.3/',
  'http://192.168.0.1/', 'http://172.16.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[fd00::1]/',
  'file:///etc/passwd', 'ftp://example.com/', 'https://user:pass@example.com/', 'https://example.com:8080/', 'http://printer.local/',
]) {
  test(`blocks ${bad}`, async () => {
    await assert.rejects(assertSafeUrl(bad, { lookup: publicLookup }), (e) => e.status === 400);
  });
}

test('blocks hostname that resolves to a private address (DNS pointing inwards)', async () => {
  await assert.rejects(assertSafeUrl('https://evil.example.com/', { lookup: privateLookup }), (e) => e.code === 'UNSAFE_URL');
});

test('rejects garbage', async () => {
  await assert.rejects(assertSafeUrl('not a url'), (e) => e.code === 'INVALID_URL');
});

test('isPrivateIp basics', () => {
  assert.ok(isPrivateIp('100.64.0.1'));
  assert.ok(!isPrivateIp('8.8.8.8'));
});
