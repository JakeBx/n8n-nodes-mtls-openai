/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mock https at module level (Node 22 makes https.request non-configurable)
// ---------------------------------------------------------------------------

/** Minimal mock of ClientRequest (extends EventEmitter for 'error' events). */
class MockClientRequest extends EventEmitter {
	write = jest.fn();
	end = jest.fn();
	destroy = jest.fn();
}

/** Minimal mock of IncomingMessage (extends EventEmitter for 'data'/'end'/'error'). */
class MockIncomingMessage extends EventEmitter {
	statusCode: number;
	headers: Record<string, string | string[]>;
	constructor(statusCode: number, headers: Record<string, string | string[]> = {}) {
		super();
		this.statusCode = statusCode;
		this.headers = headers;
	}
}

// These will be set by individual tests via beforeEach
let mockReq: MockClientRequest;
let mockRes: MockIncomingMessage;
let mockRequestFn: jest.Mock;

jest.mock('https', () => {
	const actual = jest.requireActual('https');
	return {
		...actual,
		// Keep the real Agent class so createHttpsAgent works
		Agent: actual.Agent,
		// Replace request with our controllable mock
		request: (...args: any[]) => mockRequestFn(...args),
	};
});

import { createHttpsAgent, createMtlsFetch, buildCustomHeaders, debugLog } from '../nodes/utils/sslHelper';
import type { IMtlsOpenAiApiCredentials } from '../nodes/utils/sslHelper';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MTLS_CREDS: IMtlsOpenAiApiCredentials = {
	baseUrl: 'https://example.com/v1',
	caCertificate: '-----BEGIN CERTIFICATE-----\nCA_CONTENT\n-----END CERTIFICATE-----',
	clientCertificate: '-----BEGIN CERTIFICATE-----\nCLIENT_CONTENT\n-----END CERTIFICATE-----',
	clientKey: '-----BEGIN RSA PRIVATE KEY-----\nKEY_CONTENT\n-----END RSA PRIVATE KEY-----',
};

const EMPTY_CREDS: IMtlsOpenAiApiCredentials = {
	baseUrl: 'https://example.com',
	caCertificate: '',
	clientCertificate: '',
	clientKey: '',
	passphrase: '',
};

// ---------------------------------------------------------------------------
// Default mock setup: each test gets a fresh mockReq/mockRes pair
// ---------------------------------------------------------------------------

function setupDefaultRequestMock(): void {
	mockReq = new MockClientRequest();
	mockRes = new MockIncomingMessage(200, { 'content-type': 'application/json' });

	mockRequestFn = jest.fn((_opts: any, callback?: (res: any) => void) => {
		if (callback) {
			process.nextTick(() => callback(mockRes));
			process.nextTick(() => {
				mockRes.emit('data', Buffer.from('{"ok":true}'));
				mockRes.emit('end');
			});
		}
		return mockReq;
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sslHelper', () => {
	describe('createHttpsAgent', () => {
		it('should return undefined when no certificate credentials provided', () => {
			const agent = createHttpsAgent(EMPTY_CREDS);
			expect(agent).toBeUndefined();
		});

		it('should return undefined when certificate fields are only whitespace', () => {
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
				caCertificate: '   ',
				clientCertificate: '  \n  ',
				clientKey: '\t',
			};
			const agent = createHttpsAgent(creds);
			expect(agent).toBeUndefined();
		});

		it('should return undefined when certificate fields are undefined', () => {
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
			};
			const agent = createHttpsAgent(creds);
			expect(agent).toBeUndefined();
		});

		it('should return an Agent when CA certificate is provided', () => {
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
				caCertificate: '-----BEGIN CERTIFICATE-----\nMIIBxTCCAW...\n-----END CERTIFICATE-----',
				clientCertificate: '',
				clientKey: '',
				passphrase: '',
			};
			const agent = createHttpsAgent(creds);
			expect(agent).toBeDefined();
		});

		it('should return an Agent when all credentials are provided', () => {
			const agent = createHttpsAgent(MTLS_CREDS);
			expect(agent).toBeDefined();
		});

		it('should handle collapsed single-line PEM certificates (normalizePem integration)', () => {
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
				caCertificate:
					'-----BEGIN CERTIFICATE-----MIIBxTCCAWugAwIBAgIUBase64Content-----END CERTIFICATE-----',
			};
			expect(() => createHttpsAgent(creds)).not.toThrow();
			const agent = createHttpsAgent(creds);
			expect(agent).toBeDefined();
		});

		// --- checkServerIdentity env-var gate tests ---

		describe('checkServerIdentity bypass via MTLS_SKIP_HOSTNAME_VERIFICATION', () => {
			const originalEnv = process.env;

			beforeEach(() => {
				process.env = { ...originalEnv };
			});

			afterEach(() => {
				process.env = originalEnv;
			});

			it('should NOT set checkServerIdentity when env var is not set', () => {
				delete process.env.MTLS_SKIP_HOSTNAME_VERIFICATION;
				const creds: IMtlsOpenAiApiCredentials = {
					baseUrl: 'https://example.com',
					caCertificate: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
				};
				const agent = createHttpsAgent(creds)!;
				expect(agent).toBeDefined();
				expect((agent as any).options.checkServerIdentity).toBeUndefined();
			});

			it('should NOT set checkServerIdentity when env var is "false"', () => {
				process.env.MTLS_SKIP_HOSTNAME_VERIFICATION = 'false';
				const creds: IMtlsOpenAiApiCredentials = {
					baseUrl: 'https://example.com',
					caCertificate: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
				};
				const agent = createHttpsAgent(creds)!;
				expect(agent).toBeDefined();
				expect((agent as any).options.checkServerIdentity).toBeUndefined();
			});

			it('should set checkServerIdentity bypass when env var is "true"', () => {
				process.env.MTLS_SKIP_HOSTNAME_VERIFICATION = 'true';
				const creds: IMtlsOpenAiApiCredentials = {
					baseUrl: 'https://example.com',
					caCertificate: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
				};
				const agent = createHttpsAgent(creds)!;
				expect(agent).toBeDefined();
				const checkFn = (agent as any).options.checkServerIdentity;
				expect(typeof checkFn).toBe('function');
				expect(checkFn()).toBeUndefined();
			});

			it('should set checkServerIdentity bypass when env var is "TRUE" (case-insensitive)', () => {
				process.env.MTLS_SKIP_HOSTNAME_VERIFICATION = 'TRUE';
				const creds: IMtlsOpenAiApiCredentials = {
					baseUrl: 'https://example.com',
					caCertificate: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
				};
				const agent = createHttpsAgent(creds)!;
				expect(agent).toBeDefined();
				const checkFn = (agent as any).options.checkServerIdentity;
				expect(typeof checkFn).toBe('function');
				expect(checkFn()).toBeUndefined();
			});

			it('should NOT set checkServerIdentity when no CA cert is provided even if env var is "true"', () => {
				process.env.MTLS_SKIP_HOSTNAME_VERIFICATION = 'true';
				const creds: IMtlsOpenAiApiCredentials = {
					baseUrl: 'https://example.com',
					caCertificate: '',
					clientCertificate: '-----BEGIN CERTIFICATE-----\nCLIENT\n-----END CERTIFICATE-----',
					clientKey: '-----BEGIN RSA PRIVATE KEY-----\nKEY\n-----END RSA PRIVATE KEY-----',
				};
				const agent = createHttpsAgent(creds)!;
				expect(agent).toBeDefined();
				expect((agent as any).options.checkServerIdentity).toBeUndefined();
			});
		});
	});

	// -----------------------------------------------------------------------
	// createMtlsFetch
	// -----------------------------------------------------------------------

	describe('createMtlsFetch', () => {
		it('should return undefined when no certificate fields are configured', () => {
			const result = createMtlsFetch(EMPTY_CREDS);
			expect(result).toBeUndefined();
		});

		it('should return a function when certificate fields are configured', () => {
			const result = createMtlsFetch(MTLS_CREDS);
			expect(typeof result).toBe('function');
		});

		describe('returned fetch function', () => {
			beforeEach(() => {
				setupDefaultRequestMock();
			});

			it('should call https.request with correct hostname and path', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const resp = await fetchFn('https://api.example.com/v1/chat/completions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: '{}',
				});

				expect(mockRequestFn).toHaveBeenCalledTimes(1);
				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.hostname).toBe('api.example.com');
				expect(opts.path).toBe('/v1/chat/completions');
				expect(opts.method).toBe('POST');
				expect(resp).toBeInstanceOf(Response);
			});

			it('should default method to GET when not specified', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com/v1/models');

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.method).toBe('GET');
			});

			it('should forward Headers instance entries', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const headers = new Headers();
				headers.set('x-custom', 'value1');
				headers.set('authorization', 'Bearer test');
				await fetchFn('https://api.example.com/v1/models', { headers });

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.headers['x-custom']).toBe('value1');
				expect(opts.headers['authorization']).toBe('Bearer test');
			});

			it('should forward array-of-pairs headers', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const headers: [string, string][] = [
					['X-Pair-1', 'val1'],
					['X-Pair-2', 'val2'],
				];
				await fetchFn('https://api.example.com/v1/models', { headers });

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.headers['X-Pair-1']).toBe('val1');
				expect(opts.headers['X-Pair-2']).toBe('val2');
			});

			it('should forward plain-object headers', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com/v1/models', {
					headers: { 'X-Plain': 'plain-value' },
				});

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.headers['X-Plain']).toBe('plain-value');
			});

			it('should write string body via req.write', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com/v1/chat/completions', {
					method: 'POST',
					body: '{"prompt":"test"}',
				});

				expect(mockReq.write).toHaveBeenCalledWith('{"prompt":"test"}');
				expect(mockReq.end).toHaveBeenCalled();
			});

			it('should write Buffer body via req.write', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const buf = Buffer.from('binary data');
				await fetchFn('https://api.example.com/v1/audio', {
					method: 'POST',
					body: buf as unknown as RequestInit['body'],
				});

				expect(mockReq.write).toHaveBeenCalledWith(buf);
				expect(mockReq.end).toHaveBeenCalled();
			});

			it('should write ArrayBuffer body via req.write as Buffer', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const ab = new ArrayBuffer(4);
				new Uint8Array(ab).set([1, 2, 3, 4]);
				await fetchFn('https://api.example.com/v1/data', {
					method: 'POST',
					body: ab as unknown as RequestInit['body'],
				});

				expect(mockReq.write).toHaveBeenCalledTimes(1);
				const written = mockReq.write.mock.calls[0][0];
				expect(Buffer.isBuffer(written)).toBe(true);
				expect([...written]).toEqual([1, 2, 3, 4]);
				expect(mockReq.end).toHaveBeenCalled();
			});

			it('should pipe ReadableStream body chunks via req.write', async () => {
				const chunks = [
					new Uint8Array([1, 2]),
					new Uint8Array([3, 4]),
				];
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						for (const chunk of chunks) {
							controller.enqueue(chunk);
						}
						controller.close();
					},
				});

				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com/v1/upload', {
					method: 'POST',
					body: stream as unknown as RequestInit['body'],
				});

				expect(mockReq.write).toHaveBeenCalledTimes(2);
				expect([...mockReq.write.mock.calls[0][0]]).toEqual([1, 2]);
				expect([...mockReq.write.mock.calls[1][0]]).toEqual([3, 4]);
				expect(mockReq.end).toHaveBeenCalledTimes(1);
			});

			it('should return Response with correct status code', async () => {
				mockRes.statusCode = 201;
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const resp = await fetchFn('https://api.example.com/v1/models');

				expect(resp.status).toBe(201);
			});

			it('should return Response with forwarded headers', async () => {
				mockRes.headers = {
					'content-type': 'application/json',
					'x-request-id': 'abc-123',
				};
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const resp = await fetchFn('https://api.example.com/v1/models');

				expect(resp.headers.get('content-type')).toBe('application/json');
				expect(resp.headers.get('x-request-id')).toBe('abc-123');
			});

			it('should reject promise on request error', async () => {
				mockRequestFn = jest.fn((_opts: any, _callback?: any) => {
					const req = new MockClientRequest();
					process.nextTick(() => {
						req.emit('error', new Error('ECONNREFUSED'));
					});
					return req;
				});

				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await expect(
					fetchFn('https://api.example.com/v1/models'),
				).rejects.toThrow('ECONNREFUSED');
			});

			it('should include query string in path', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com/v1/models?limit=10&offset=0');

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.path).toBe('/v1/models?limit=10&offset=0');
			});

			it('should use port from URL', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com:8443/v1/models');

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.port).toBe('8443');
			});

			it('should default to port 443 when not specified', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				await fetchFn('https://api.example.com/v1/models');

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.port).toBe('443');
			});

			it('should accept URL object as input', async () => {
				const fetchFn = createMtlsFetch(MTLS_CREDS)!;
				const url = new URL('https://api.example.com/v1/models');
				await fetchFn(url);

				const opts = mockRequestFn.mock.calls[0][0];
				expect(opts.hostname).toBe('api.example.com');
			});
		});
	});

	// -----------------------------------------------------------------------
	// debugLog
	// -----------------------------------------------------------------------

	describe('debugLog', () => {
		const originalEnv = process.env;
		let debugSpy: jest.SpyInstance;

		beforeEach(() => {
			process.env = { ...originalEnv };
			debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
		});

		afterEach(() => {
			process.env = originalEnv;
			debugSpy.mockRestore();
		});

		it('should not log when N8N_LOG_LEVEL is not set', () => {
			delete process.env.N8N_LOG_LEVEL;
			debugLog('test message');
			expect(debugSpy).not.toHaveBeenCalled();
		});

		it('should not log when N8N_LOG_LEVEL is "info"', () => {
			process.env.N8N_LOG_LEVEL = 'info';
			debugLog('test message');
			expect(debugSpy).not.toHaveBeenCalled();
		});

		it('should log when N8N_LOG_LEVEL is "debug"', () => {
			process.env.N8N_LOG_LEVEL = 'debug';
			debugLog('test message', 42);
			expect(debugSpy).toHaveBeenCalledWith('[mTLS]', 'test message', 42);
		});

		it('should log only to console.debug (not console.log)', () => {
			process.env.N8N_LOG_LEVEL = 'debug';
			const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
			debugLog('test');
			expect(logSpy).not.toHaveBeenCalled();
			logSpy.mockRestore();
		});
	});

	// -----------------------------------------------------------------------
	// buildCustomHeaders (unchanged — existing tests)
	// -----------------------------------------------------------------------

	describe('buildCustomHeaders', () => {
		it('should return empty object for undefined input', () => {
			expect(buildCustomHeaders(undefined)).toEqual({});
		});

		it('should return empty object when values array is undefined', () => {
			expect(buildCustomHeaders({})).toEqual({});
		});

		it('should return empty object when values array is empty', () => {
			expect(buildCustomHeaders({ values: [] })).toEqual({});
		});

		it('should build headers from values array', () => {
			const result = buildCustomHeaders({
				values: [
					{ name: 'X-Custom-Header', value: 'custom-value' },
					{ name: 'Authorization', value: 'Bearer token123' },
				],
			});
			expect(result).toEqual({
				'X-Custom-Header': 'custom-value',
				Authorization: 'Bearer token123',
			});
		});

		it('should skip entries with empty name', () => {
			const result = buildCustomHeaders({
				values: [
					{ name: '', value: 'should-be-skipped' },
					{ name: 'X-Valid', value: 'valid-value' },
				],
			});
			expect(result).toEqual({ 'X-Valid': 'valid-value' });
		});

		it('should allow empty value for a header', () => {
			const result = buildCustomHeaders({
				values: [{ name: 'X-Empty', value: '' }],
			});
			expect(result).toEqual({ 'X-Empty': '' });
		});
	});
});
