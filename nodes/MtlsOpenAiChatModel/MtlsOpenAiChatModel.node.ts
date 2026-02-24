import {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
	createHttpsAgent,
	buildCustomHeaders,
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
				AI: ['Language Models', 'Root Nodes'],
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

		// Build HTTPS agent for mTLS from credential SSL fields
		const httpsAgent = createHttpsAgent(credentials);

		// Build custom headers from node options
		const customHeaders = buildCustomHeaders(options.customHeaders);

		// Configure client options
		const clientOptions: ClientOptions = {};
		if (httpsAgent) {
			clientOptions.httpAgent = httpsAgent;
		}
		if (Object.keys(customHeaders).length > 0) {
			clientOptions.defaultHeaders = customHeaders;
		}

		// Build ChatOpenAI configuration
		const chatModelConfig: ConstructorParameters<typeof ChatOpenAI>[0] = {
			modelName: model,
			openAIApiKey: credentials.apiKey || 'not-needed',
			configuration: {
				baseURL: credentials.baseUrl,
				...clientOptions,
			},
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
