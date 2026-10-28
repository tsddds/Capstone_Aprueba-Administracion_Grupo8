import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totp, verifyTotp } from '../../src/lib/totp.js';
import { paginate } from '../../src/lib/admin-pagination.js';
test('RFC 6238 SHA1 vectors and replay protection', () => {
  const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for (const [time,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])
    assert.equal(totp(secret,Math.floor(time/30),8),expected);
  assert.equal(verifyTotp(secret,'287082',59000),1);
  assert.equal(verifyTotp(secret,'287082',59000,1),null);
  assert.equal(verifyTotp(secret,'123456',59000),null);
});
test('Cursor pagination is deterministic for ties and rejects incompatible cursors', () => {
  const rows=[{id:'b',name:'A'},{id:'a',name:'A'},{id:'c',name:'B'}];
  const opts={fields:['name'],defaultSort:'name'};
  const first=paginate([...rows],{limit:'1'},opts);
  assert.equal(first.items[0].id,'a');
  assert.equal(paginate([...rows],{limit:'1',cursor:first.pagination.nextCursor},opts).items[0].id,'b');
  assert.throws(()=>paginate(rows,{limit:'0'},opts));
  assert.throws(()=>paginate(rows,{sort:'-name',cursor:first.pagination.nextCursor},opts));
});
