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
exports.MtlsOpenAiChatModel = void 0;
const https = __importStar(require("https"));
const openai_1 = require("@langchain/openai");
const sslHelper_1 = require("../utils/sslHelper");
class MtlsOpenAiChatModel {
    constructor() {
        this.description = {
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
            outputs: ['ai_languageModel'],
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
        this.methods = {
            credentialTest: {
                /**
                 * Validates the mTLS credential by making a native https.request() with the
                 * client certificate/key attached. This enforces actual mTLS authentication
                 * — unlike ICredentialTestRequest which cannot attach a custom https.Agent.
                 */
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
                            // Drain the response body so the socket is released
                            res.resume();
                            // Any HTTP response (even 401/403) means mTLS + network are working
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
        const model = this.getNodeParameter('model', itemIndex, 'gpt-3.5-turbo');
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
        // Build ChatOpenAI configuration
        const chatModelConfig = {
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
        const chatModel = new openai_1.ChatOpenAI(chatModelConfig);
        return {
            response: chatModel,
        };
    }
}
exports.MtlsOpenAiChatModel = MtlsOpenAiChatModel;
//# sourceMappingURL=MtlsOpenAiChatModel.node.js.map