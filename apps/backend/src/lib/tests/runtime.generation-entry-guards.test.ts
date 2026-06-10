import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';

import { applyRequestContractGuard } from '../runtime/generation-entry-guards';
import type { BackendGenerationRequest } from '../runtime/request-contract';

class MockServerResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  private readonly headers = new Map<string, string | string[]>();
  private readonly chunks: string[] = [];

  setHeader(name: string, value: string | string[]) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunk?: string) {
    if (typeof chunk === 'string' && chunk.length > 0) {
      this.chunks.push(chunk);
    }
    this.writableEnded = true;
    this.emit('finish');
  }

  jsonBody(): Record<string, unknown> {
    const raw = this.chunks.join('');
    return raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};
  }
}

const createYoutubeDescriptionRequest = (
  extractionPayload: Record<string, unknown>,
): BackendGenerationRequest => ({
  requestId: 'req-ytd-001',
  userId: 'user-001',
  projectId: 'project-001',
  artifactType: 'content',
  model: 'openrouter/auto',
  outputFormat: 'markdown',
  toolKey: 'youtube-description',
  workflowType: 'youtube_description',
  input: {
    step: 'youtube-description-generation',
    tone: 'Professional',
    briefingId: 'direct-input:youtube-description',
    extractionArtifactId: 'direct-input:youtube-description',
    briefingText: 'Video title: Demo',
    extractionPayload,
  },
});

test('request guard accepts youtube-description payload without optional hashtags and social links', () => {
  const response = new MockServerResponse();
  const request = createYoutubeDescriptionRequest({
    videoTitle: 'Strategia YouTube',
    topic: 'Growth',
    keywords: ['youtube', 'seo'],
    ctaText: 'Prenota una call',
    ctaLink: 'https://example.com/call',
    credentialsOrProof: '10 anni di esperienza',
    chaptersWithTimestamps: ['0:00 Intro', '1:10 Metodo'],
  });

  const allowed = applyRequestContractGuard(response as never, request);

  assert.equal(allowed, true);
  assert.equal(response.writableEnded, false);
});

test('request guard accepts chapter lines with timestamp token not at the beginning', () => {
  const response = new MockServerResponse();
  const request = createYoutubeDescriptionRequest({
    videoTitle: 'Strategia YouTube',
    topic: 'Growth',
    keywords: ['youtube', 'seo'],
    ctaText: 'Prenota una call',
    ctaLink: 'https://example.com/call',
    credentialsOrProof: '10 anni di esperienza',
    chaptersWithTimestamps: ['Intro 0:00', 'Metodo 1:10'],
  });

  const allowed = applyRequestContractGuard(response as never, request);

  assert.equal(allowed, true);
  assert.equal(response.writableEnded, false);
});

test('request guard accepts youtube-description payload even when optional hashtags exceed previous limit', () => {
  const response = new MockServerResponse();
  const request = createYoutubeDescriptionRequest({
    videoTitle: 'Strategia YouTube',
    topic: 'Growth',
    keywords: ['youtube', 'seo'],
    ctaText: 'Prenota una call',
    ctaLink: 'https://example.com/call',
    credentialsOrProof: '10 anni di esperienza',
    chaptersWithTimestamps: ['0:00 Intro', '1:10 Metodo'],
    hashtags: ['#1', '#2', '#3', '#4', '#5', '#6'],
  });

  const allowed = applyRequestContractGuard(response as never, request);

  assert.equal(allowed, true);
  assert.equal(response.writableEnded, false);
});
