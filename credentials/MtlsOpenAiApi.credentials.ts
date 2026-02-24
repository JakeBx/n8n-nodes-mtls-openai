import {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MtlsOpenAiApi implements ICredentialType {
	name = 'mtlsOpenAiApi';
	displayName = 'mTLS OpenAI API';
	icon = 'fa:lock' as const;
	documentationUrl = 'https://github.com/JakeBx/n8n-nodes-mtls-openai';

	// Tests basic connectivity to the endpoint. Note: this test does NOT verify
	// mTLS client certificates — certificate validation is performed at runtime
	// when the node makes requests.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/models',
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey || "n8n-test"}}',
			},
		},
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://your-server:443/v1',
			placeholder: 'https://your-server:443/v1',
			description: 'Base URL of the OpenAI-compatible API endpoint',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'sk-...',
			description: 'API key for OpenAI-compatible services that require it. Leave empty if not needed.',
		},
		// ── mTLS / SSL Certificate Fields ──
		// All sensitive fields use password:true for UI masking.
		// Credentials are always encrypted at rest by n8n.
		{
			displayName: 'CA Certificate',
			name: 'caCertificate',
			type: 'string',
			typeOptions: {
				password: true,
				rows: 5,
			},
			default: '',
			description: 'PEM-encoded CA certificate for server verification (paste full contents of ca.crt)',
		},
		{
			displayName: 'Client Certificate',
			name: 'clientCertificate',
			type: 'string',
			typeOptions: {
				password: true,
				rows: 5,
			},
			default: '',
			description: 'PEM-encoded client certificate for mTLS authentication (paste full contents of client.crt)',
		},
		{
			displayName: 'Client Key',
			name: 'clientKey',
			type: 'string',
			typeOptions: {
				password: true,
				rows: 5,
			},
			default: '',
			description: 'PEM-encoded client private key for mTLS authentication (paste full contents of client.key)',
		},
		{
			displayName: 'Passphrase',
			name: 'passphrase',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Passphrase for the client private key (if encrypted)',
		},
	];
}
