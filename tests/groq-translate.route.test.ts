import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('@/ai/groq', () => ({
  groq: { chat: { completions: { create } } },
}));

import { POST } from '@/app/api/groq-translate/route';

function makeRequest(body: unknown, init: { raw?: string; contentType?: string } = {}) {
  return new Request('http://localhost/api/groq-translate', {
    method: 'POST',
    headers: {
      'content-type': init.contentType ?? 'application/json',
      'x-forwarded-for': `test-${Math.random()}`,
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

describe('POST /api/groq-translate', () => {
  beforeEach(() => create.mockReset());

  it('rejects non-JSON content types', async () => {
    const res = await POST(makeRequest({}, { contentType: 'text/plain' }));
    expect(res.status).toBe(415);
  });

  it('rejects malformed JSON', async () => {
    const res = await POST(makeRequest(null, { raw: 'not json' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await POST(makeRequest({ text: 'hello' }));
    expect(res.status).toBe(400);
  });

  it('returns the translation on success', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'नमस्ते' }, finish_reason: 'stop' }],
    });

    const res = await POST(makeRequest({ text: 'hello', targetLanguage: 'Hindi' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.translation).toBe('नमस्ते');
  });

  it('maps the unreadable marker to a 422', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '[[UNREADABLE]]' }, finish_reason: 'stop' }],
    });

    const res = await POST(makeRequest({ text: '|| ~~', targetLanguage: 'Hindi' }));
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.code).toBe('UNREADABLE_TEXT');
  });

  it('passes provider rate limits through as 429', async () => {
    create.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

    const res = await POST(makeRequest({ text: 'hello', targetLanguage: 'Hindi' }));
    expect(res.status).toBe(429);
  });
});