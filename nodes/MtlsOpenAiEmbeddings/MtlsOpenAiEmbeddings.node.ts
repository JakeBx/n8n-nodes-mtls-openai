import * as https from 'https';
import {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	INodeCredentialTestResult,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { OpenAIEmbeddings, type ClientOptions } from '@langchain/openai';
import {
	createHttpsAgent,
	createMtlsFetch,
	buildCustomHeaders,
	debugLog,
	type IMtlsOpenAiApiCredentials,
} from '../utils/sslHelper';

export class MtlsOpenAiEmbeddings implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'mTLS OpenAI Embeddings',
		name: 'mtlsOpenAiEmbeddings',
		icon: 'file:mtls-openai.svg',
		group: ['transform'],
		version: 1,
		description: 'OpenAI-compatible Embeddings with mTLS x509 client certificate authentication for enterprise auth proxies',
		defaults: {
			name: 'mTLS OpenAI Embeddings',
		},
		usableAsTool: true,
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://github.com/JakeBx/n8n-nodes-mtls-openai',
					},
				],
			},
		},
		inputs: [],
		outputs: ['ai_embedding' as const],
		outputNames: ['Embeddings'],
		credentials: [
			{
				name: 'mtlsOpenAiApi',
				required: true,
				testedBy: 'testMtlsOpenAiCredentials',
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'text-embedding-ada-002',
				description: 'The model to use for generating embeddings',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 512,
						description: 'Maximum number of texts to embed in a single request',
					},
					{
						displayName: 'Custom Headers',
						name: 'customHeaders',
						type: 'fixedCollection',
						default: {},
						typeOptions: {
							multipleValues: true,
						},
						description: 'Custom HTTP headers to include with every request',
						options: [
							{
								name: 'values',
								displayName: 'Header',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Header name',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Header value',
									},
								],
							},
						],
					},
					{
						displayName: 'Strip New Lines',
						name: 'stripNewLines',
						type: 'boolean',
						default: true,
						description: 'Whether to strip newline characters from input text before embedding',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 300000,
						description: 'Request timeout in milliseconds (default 5 minutes for CPU inference)',
					},
				],
			},
		],
	};

	methods = {
		credentialTest: {
			async testMtlsOpenAiCredentials(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const creds = credential.data as unknown as IMtlsOpenAiApiCredentials;

				if (!creds.baseUrl) {
					return { status: 'Error', message: 'Base URL is required' };
				}

				const agent = createHttpsAgent(creds);

				return new Promise((resolve) => {
					let url: URL;
					try {
						url = new URL(`${creds.baseUrl}/models`);
					} catch {
						resolve({ status: 'Error', message: `Invalid Base URL: ${creds.baseUrl}` });
						return;
					}

					const options: https.RequestOptions = {
						hostname: url.hostname,
						port: url.port || 443,
						path: url.pathname + url.search,
						method: 'GET',
						agent,
						headers: {
							Authorization: `Bearer ${creds.apiKey || 'n8n-test'}`,
						},
						timeout: 10_000,
					};

					const req = https.request(options, (res) => {
						res.resume();
						if ((res.statusCode ?? 0) < 500) {
							resolve({ status: 'OK', message: 'mTLS connection successful' });
						} else {
							resolve({
								status: 'Error',
								message: `Server returned HTTP ${res.statusCode}`,
							});
						}
					});

					req.on('timeout', () => {
						req.destroy();
						resolve({ status: 'Error', message: 'Connection timed out' });
					});

					req.on('error', (err: Error) => {
						resolve({ status: 'Error', message: err.message });
					});

					req.end();
				});
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials<IMtlsOpenAiApiCredentials>('mtlsOpenAiApi');
		const model = this.getNodeParameter('model', itemIndex, 'text-embedding-ada-002') as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			batchSize?: number;
			stripNewLines?: boolean;
			timeout?: number;
			customHeaders?: { values?: Array<{ name: string; value: string }> };
		};

		// Build custom fetch for mTLS — bypasses the OpenAI SDK's httpAgent option
		// which is silently dropped by Node.js 22 native fetch (undici).
		const mtlsFetch = createMtlsFetch(credentials);
		debugLog('Embeddings supplyData: mtlsFetch created =', !!mtlsFetch,
			'| baseUrl hostname =', new URL(credentials.baseUrl).hostname);

		// Build custom headers from node options
		const customHeaders = buildCustomHeaders(options.customHeaders);

		// Assemble only the ClientOptions fields that are actually set
		const configuration: ClientOptions = { baseURL: credentials.baseUrl };
		if (mtlsFetch) configuration.fetch = mtlsFetch;
		if (Object.keys(customHeaders).length > 0) configuration.defaultHeaders = customHeaders;

		// Build OpenAIEmbeddings configuration
		const embeddingsConfig: ConstructorParameters<typeof OpenAIEmbeddings>[0] = {
			modelName: model,
			openAIApiKey: credentials.apiKey || 'not-needed',
			configuration,
		};

		if (options.batchSize !== undefined) {
			embeddingsConfig.batchSize = options.batchSize;
		}
		if (options.stripNewLines !== undefined) {
			embeddingsConfig.stripNewLines = options.stripNewLines;
		}
		if (options.timeout !== undefined) {
			embeddingsConfig.timeout = options.timeout;
		}

		const embeddings = new OpenAIEmbeddings(embeddingsConfig);

		return {
			response: embeddings,
		};
	}
}
