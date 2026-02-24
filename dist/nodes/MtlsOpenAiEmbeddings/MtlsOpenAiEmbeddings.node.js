"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MtlsOpenAiEmbeddings = void 0;
const openai_1 = require("@langchain/openai");
const sslHelper_1 = require("../utils/sslHelper");
class MtlsOpenAiEmbeddings {
    constructor() {
        this.description = {
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
            outputs: ['ai_embedding'],
            outputNames: ['Embeddings'],
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
    }
    async supplyData(itemIndex) {
        const credentials = await this.getCredentials('mtlsOpenAiApi');
        const model = this.getNodeParameter('model', itemIndex, 'text-embedding-ada-002');
        const options = this.getNodeParameter('options', itemIndex, {});
        // Build HTTPS agent for mTLS from credential SSL fields
        const httpsAgent = (0, sslHelper_1.createHttpsAgent)(credentials);
        // Build custom headers from node options
        const customHeaders = (0, sslHelper_1.buildCustomHeaders)(options.customHeaders);
        // Configure client options
        const clientOptions = {};
        if (httpsAgent) {
            clientOptions.httpAgent = httpsAgent;
        }
        if (Object.keys(customHeaders).length > 0) {
            clientOptions.defaultHeaders = customHeaders;
        }
        // Build OpenAIEmbeddings configuration
        const embeddingsConfig = {
            modelName: model,
            openAIApiKey: credentials.apiKey || 'not-needed',
            configuration: {
                baseURL: credentials.baseUrl,
                ...clientOptions,
            },
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
        const embeddings = new openai_1.OpenAIEmbeddings(embeddingsConfig);
        return {
            response: embeddings,
        };
    }
}
exports.MtlsOpenAiEmbeddings = MtlsOpenAiEmbeddings;
//# sourceMappingURL=MtlsOpenAiEmbeddings.node.js.map