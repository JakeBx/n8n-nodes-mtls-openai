import { MtlsOpenAiApi } from '../credentials/MtlsOpenAiApi.credentials';

describe('MtlsOpenAiApi Credentials', () => {
	let credentials: MtlsOpenAiApi;

	beforeEach(() => {
		credentials = new MtlsOpenAiApi();
	});

	it('should have the correct name', () => {
		expect(credentials.name).toBe('mtlsOpenAiApi');
	});

	it('should have the correct displayName', () => {
		expect(credentials.displayName).toBe('mTLS OpenAI API');
	});

	it('should have a documentationUrl', () => {
		expect(credentials.documentationUrl).toBeDefined();
		expect(typeof credentials.documentationUrl).toBe('string');
	});

	it('should have required properties', () => {
		const propNames = credentials.properties.map((p) => p.name);
		expect(propNames).toContain('baseUrl');
		expect(propNames).toContain('caCertificate');
		expect(propNames).toContain('clientCertificate');
		expect(propNames).toContain('clientKey');
	});

	it('should have an apiKey property with empty default', () => {
		const apiKeyProp = credentials.properties.find((p) => p.name === 'apiKey');
		expect(apiKeyProp).toBeDefined();
		expect(apiKeyProp?.default).toBe('');
	});

	it('should have a passphrase property', () => {
		const passphraseProp = credentials.properties.find((p) => p.name === 'passphrase');
		expect(passphraseProp).toBeDefined();
		expect(passphraseProp?.default).toBe('');
	});

	it('should use generic default base URL', () => {
		const baseUrlProp = credentials.properties.find((p) => p.name === 'baseUrl');
		expect(baseUrlProp?.default).toBe('https://your-server:443/v1');
	});

	it('should mark baseUrl as required', () => {
		const baseUrlProp = credentials.properties.find((p) => p.name === 'baseUrl');
		expect(baseUrlProp?.required).toBe(true);
	});

	it('should mask sensitive fields with password typeOption', () => {
		const sensitiveFields = ['apiKey', 'caCertificate', 'clientCertificate', 'clientKey', 'passphrase'];
		for (const fieldName of sensitiveFields) {
			const prop = credentials.properties.find((p) => p.name === fieldName);
			expect(prop?.typeOptions?.password).toBe(true);
		}
	});
});
