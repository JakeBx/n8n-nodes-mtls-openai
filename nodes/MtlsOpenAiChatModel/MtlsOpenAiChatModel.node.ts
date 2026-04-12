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
import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
	createHttpsAgent,
	createMtlsFetch,
	buildCustomHeaders,
	debugLog,
	type IMtlsOpenAiApiCredentials,
} from '../utils/sslHelper';

export class MtlsOpenAiChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'mTLS OpenAI Chat Model',
		name: 'mtlsOpenAiChatModel',
		icon: 'file:mtls-openai.svg',
		group: ['transform'],
		version: 1,
		description: 'OpenAI-compatible Chat Model with mTLS x509 client certificate authentication for enterprise auth proxies',
		defaults: {
			name: 'mTLS OpenAI Chat Model',
		},
		usableAsTool: true,
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Chat Models'],
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
		outputs: ['ai_languageModel' as const],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'mtlsOpenAiApi',
				required: true,
				// Run a real mTLS-authenticated test rather than a plain HTTP request
				testedBy: 'testMtlsOpenAiCredentials',
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'gpt-3.5-turbo',
				description: 'The model to use for chat completions',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
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
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						type: 'number',
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberStepSize: 0.1,
						},
						default: 0,
						description: 'Penalty for token frequency in the text so far',
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						typeOptions: {
							minValue: -1,
						},
						default: -1,
						description: 'Maximum number of tokens to generate (-1 for model default)',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						type: 'number',
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberStepSize: 0.1,
						},
						default: 0,
						description: 'Penalty for token presence in the text so far',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 2,
							numberStepSize: 0.1,
						},
						default: 0.7,
						description: 'Sampling temperature (0 = deterministic, 2 = most random)',
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
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberStepSize: 0.1,
						},
						default: 1,
						description: 'Nucleus sampling parameter',
					},
				],
			},
		],
	};

	methods = {
		credentialTest: {
			/**
			 * Validates the mTLS credential by making a native https.request() with the
			 * client certificate/key attached. This enforces actual mTLS authentication
			 * — unlike ICredentialTestRequest which cannot attach a custom https.Agent.
			 */
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
						// Drain the response body so the socket is released
						res.resume();
						// Any HTTP response (even 401/403) means mTLS + network are working
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
		const model = this.getNodeParameter('model', itemIndex, 'gpt-3.5-turbo') as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			temperature?: number;
			maxTokens?: number;
			topP?: number;
			frequencyPenalty?: number;
			presencePenalty?: number;
			timeout?: number;
			customHeaders?: { values?: Array<{ name: string; value: string }> };
		};

		// Build custom fetch for mTLS — bypasses the OpenAI SDK's httpAgent option
		// which is silently dropped by Node.js 22 native fetch (undici).
		const mtlsFetch = createMtlsFetch(credentials);
		debugLog('ChatModel supplyData: mtlsFetch created =', !!mtlsFetch,
			'| baseUrl hostname =', new URL(credentials.baseUrl).hostname);

		// Build custom headers from node options
		const customHeaders = buildCustomHeaders(options.customHeaders);

		// Assemble only the ClientOptions fields that are actually set
		const configuration: ClientOptions = { baseURL: credentials.baseUrl };
		if (mtlsFetch) configuration.fetch = mtlsFetch;
		if (Object.keys(customHeaders).length > 0) configuration.defaultHeaders = customHeaders;

		// Build ChatOpenAI configuration
		const chatModelConfig: ConstructorParameters<typeof ChatOpenAI>[0] = {
			modelName: model,
			openAIApiKey: credentials.apiKey || 'not-needed',
			configuration,
		};

		if (options.temperature !== undefined) {
			chatModelConfig.temperature = options.temperature;
		}
		if (options.maxTokens !== undefined && options.maxTokens !== -1) {
			chatModelConfig.maxTokens = options.maxTokens;
		}
		if (options.topP !== undefined) {
			chatModelConfig.topP = options.topP;
		}
		if (options.frequencyPenalty !== undefined) {
			chatModelConfig.frequencyPenalty = options.frequencyPenalty;
		}
		if (options.presencePenalty !== undefined) {
			chatModelConfig.presencePenalty = options.presencePenalty;
		}
		if (options.timeout !== undefined) {
			chatModelConfig.timeout = options.timeout;
		}

		const chatModel = new ChatOpenAI(chatModelConfig);

		return {
			response: chatModel,
		};
	}
}
