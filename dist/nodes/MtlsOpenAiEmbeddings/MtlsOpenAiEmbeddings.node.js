"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MtlsOpenAiEmbeddings = void 0;
const https = __importStar(require("https"));
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
        this.methods = {
            credentialTest: {
                async testMtlsOpenAiCredentials(credential) {
                    const creds = credential.data;
                    if (!creds.baseUrl) {
                        return { status: 'Error', message: 'Base URL is required' };
                    }
                    const agent = (0, sslHelper_1.createHttpsAgent)(creds);
                    return new Promise((resolve) => {
                        let url;
                        try {
                            url = new URL(`${creds.baseUrl}/models`);
                        }
                        catch {
                            resolve({ status: 'Error', message: `Invalid Base URL: ${creds.baseUrl}` });
                            return;
                        }
                        const options = {
                            hostname: url.hostname,
                            port: url.port || 443,
                            path: url.pathname + url.search,
                            method: 'GET',
                            agent,
                            headers: {
                                Authorization: `Bearer ${creds.apiKey || 'n8n-test'}`,
                            },
                            timeout: 10000,
                        };
                        const req = https.request(options, (res) => {
                            var _a;
                            res.resume();
                            if (((_a = res.statusCode) !== null && _a !== void 0 ? _a : 0) < 500) {
                                resolve({ status: 'OK', message: 'mTLS connection successful' });
                            }
                            else {
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
                        req.on('error', (err) => {
                            resolve({ status: 'Error', message: err.message });
                        });
                        req.end();
                    });
                },
            },
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