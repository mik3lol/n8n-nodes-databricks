import {
    NodeConnectionTypes,
    type INodeType,
    type INodeTypeDescription,
    type ISupplyDataFunctions,
    type SupplyData,
} from 'n8n-workflow';
import { ChatOpenAI } from '@langchain/openai';
// import { N8nLlmTracing } from '../N8nLlmTracing';

export class LmChatDatabricks implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Databricks Chat Model',
        name: 'lmChatDatabricks',
        icon: 'file:databricks.svg',
        group: ['transform'],
        version: 1,
        description: 'Use Databricks hosted LLM models',
        defaults: {
            name: 'Databricks Chat Model',
        },
        codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
            resources: {
                primaryDocumentation: [
                    {
                        url: 'https://docs.databricks.com/machine-learning/model-serving/index.html',
                    },
                ],
            },
        },
        inputs: [],
        outputs: [NodeConnectionTypes.AiLanguageModel],
        outputNames: ['Model'],
        credentials: [
            {
                name: 'databricks',
                required: true,
            },
        ],
        requestDefaults: {
            baseURL: '={{$credentials.host}}',
            headers: {
                Authorization: '=Bearer {{$credentials.token}}',
            },
        },
        properties: [
            {
                displayName: 'Model',
                name: 'model',
                type: 'options',
                typeOptions: {
                    loadOptions: {
                        routing: {
                            request: {
                                method: 'GET',
                                url: '/api/2.0/serving-endpoints',
                            },
                            output: {
                                postReceive: [
                                    {
                                        type: 'rootProperty',
                                        properties: {
                                            property: 'endpoints',
                                        },
                                    },
                                    // {
                                    //     type: 'filter',
                                    //     properties: {
                                    //         pass: '={{$responseItem.config.served_entities?.some(entity => entity.external_model?.task === "llm/v1/chat") || $responseItem.config.served_entities?.some(entity => entity.foundation_model?.name?.match(/chat|gpt|llm|language/i))}}',
                                    //     },
                                    // },
                                    {
                                        type: 'setKeyValue',
                                        properties: {
                                            name: '={{$responseItem.name}}',
                                            value: '={{$responseItem.name}}',
                                            description: '={{($responseItem.config.served_entities || []).map(entity => entity.external_model?.name || entity.foundation_model?.name).filter(Boolean).join(", ")}}',
                                        },
                                    },
                                    {
                                        type: 'sort',
                                        properties: {
                                            key: 'name',
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                required: true,
                default: '',
                description: 'The model to use',
                routing: {
                    send: {
                        type: 'body',
                        property: 'model',
                    },
                },
            },
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    {
                        displayName: 'Maximum Tokens',
                        name: 'max_tokens',
                        type: 'number',
                        typeOptions: {
                            maxValue: 32768,
                        },
                        default: 512,
                        routing: {
                            send: {
                                type: 'body',
                                property: 'max_tokens',
                            },
                        },
                    },
                    {
                        displayName: 'Temperature',
                        name: 'temperature',
                        type: 'number',
                        typeOptions: {
                            maxValue: 2,
                            minValue: 0,
                            numberPrecision: 1,
                        },
                        default: 0.7,
                        routing: {
                            send: {
                                type: 'body',
                                property: 'temperature',
                            },
                        },
                    },
                    {
                        displayName: 'Top P',
                        name: 'top_p',
                        type: 'number',
                        typeOptions: {
                            maxValue: 1,
                            minValue: 0,
                            numberPrecision: 1,
                        },
                        default: 1,
                        routing: {
                            send: {
                                type: 'body',
                                property: 'top_p',
                            },
                        },
                    },
                ],
            },
        ],
    };

    async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
        const credentials = await this.getCredentials('databricks');
        const modelName = this.getNodeParameter('model', itemIndex) as string;
        
        const options = this.getNodeParameter('options', itemIndex, {}) as {
            maxTokens?: number;
            maxRetries?: number;
            timeout?: number;
            temperature?: number;
            topP?: number;
            responseFormat?: 'text' | 'json_object';
        };

        // Fix baseURL construction to use correct serving-endpoints path
        const configuration = {
            baseURL: `${credentials.host}/serving-endpoints`,
        };

        const model = new ChatOpenAI({
            openAIApiKey: `${credentials.token}`,
            modelName,
            ...options,
            timeout: options.timeout ?? 60000,
            maxRetries: options.maxRetries ?? 2,
            configuration,
            // callbacks: [new N8nLlmTracing(this)],
            modelKwargs: options.responseFormat
                ? {
                        response_format: { type: options.responseFormat },
                  }
                : undefined,
        });

        return {
            response: model,
        };
    }
}