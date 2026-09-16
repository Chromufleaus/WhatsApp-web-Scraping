const assert = require('node:assert/strict');
const { sortMessagesChronologically, buildGroupedJsonPayload } = require('../export-logic.js');

const messages = [
  { id: 'b', timestamp_iso: '2024-01-02T08:00:00.000Z', _capture_order: 2 },
  { id: 'a', timestamp_iso: '2024-01-01T08:00:00.000Z', _capture_order: 1 },
  { id: 'c', timestamp_iso: '2024-01-03T08:00:00.000Z', _capture_order: 3 }
];

assert.deepStrictEqual(
  sortMessagesChronologically(messages).map((message) => message.id),
  ['a', 'b', 'c']
);

const payload = buildGroupedJsonPayload([
  { chat_name: 'Grup A', messages: [{ id: 'a1', timestamp_iso: '2024-01-01T00:00:00Z' }] },
  { chat_name: 'Grup B', messages: [{ id: 'b1', timestamp_iso: '2024-01-02T00:00:00Z' }] }
]);

assert.equal(payload.chats[1], '____');
assert.equal(payload.chats[0].chat_name, 'Grup A');
assert.equal(payload.chats[2].chat_name, 'Grup B');
assert.equal(payload.group_count, 2);

console.log('export logic checks passed');
