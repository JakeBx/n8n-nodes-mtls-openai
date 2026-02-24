import { createHttpsAgent, buildCustomHeaders } from '../nodes/utils/sslHelper';
import type { IMtlsOpenAiApiCredentials } from '../nodes/utils/sslHelper';

describe('sslHelper', () => {
	describe('createHttpsAgent', () => {
		it('should return undefined when no certificate credentials provided', () => {
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
				caCertificate: '',
				clientCertificate: '',
				clientKey: '',
				passphrase: '',
			};
			const agent = createHttpsAgent(creds);
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
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
				caCertificate: '-----BEGIN CERTIFICATE-----\nCA_CONTENT\n-----END CERTIFICATE-----',
				clientCertificate: '-----BEGIN CERTIFICATE-----\nCLIENT_CONTENT\n-----END CERTIFICATE-----',
				clientKey: '-----BEGIN RSA PRIVATE KEY-----\nKEY_CONTENT\n-----END RSA PRIVATE KEY-----',
				passphrase: 'test-passphrase',
			};
			const agent = createHttpsAgent(creds);
			expect(agent).toBeDefined();
		});

		it('should handle collapsed single-line PEM certificates (normalizePem integration)', () => {
			const creds: IMtlsOpenAiApiCredentials = {
				baseUrl: 'https://example.com',
				caCertificate:
					'-----BEGIN CERTIFICATE-----MIIBxTCCAWugAwIBAgIUBase64Content-----END CERTIFICATE-----',
			};
			// Should not throw when normalizing collapsed PEM
			expect(() => createHttpsAgent(creds)).not.toThrow();
			const agent = createHttpsAgent(creds);
			expect(agent).toBeDefined();
		});
	});

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
