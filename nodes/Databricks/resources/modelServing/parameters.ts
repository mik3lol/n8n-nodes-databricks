import type { INodeProperties } from 'n8n-workflow';

export const modelServingParameters: INodeProperties[] = [
    {
        displayName: 'Endpoint',
        name: 'endpointName',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        description: 'The model serving endpoint to query. The input format will be automatically detected from the endpoint schema.',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['queryEndpoint'],
            },
        },
        modes: [
            {
                displayName: 'From List',
                name: 'list',
                type: 'list',
                typeOptions: {
                    searchListMethod: 'getEndpoints',
                    searchable: true,
                },
            },
            {
                displayName: 'By Name',
                name: 'name',
                type: 'string',
                placeholder: 'e.g. databricks-mixtral-8x7b-instruct',
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: '^[a-zA-Z0-9_-]+$',
                            errorMessage: 'Must be a valid endpoint name (alphanumeric, hyphens, and underscores only)',
                        },
                    },
                ],
            },
            {
                displayName: 'By URL',
                name: 'url',
                type: 'string',
                placeholder: 'e.g. https://adb-xxx.cloud.databricks.com/serving-endpoints/my-endpoint',
                extractValue: {
                    type: 'regex',
                    regex: 'https://[^/]+/serving-endpoints/([a-zA-Z0-9_-]+)',
                },
            },
        ],
    },

    // Simple JSON input - schema will be fetched and validated at runtime
    {
        displayName: 'Request Body',
        name: 'requestBody',
        type: 'json',
        required: true,
        default: '{\n  "messages": [\n    {\n      "role": "user",\n      "content": "Hello!"\n    }\n  ]\n}',
        placeholder: 'Request body will be validated against the endpoint schema',
        description: 'Request body in JSON format. The node automatically detects the expected format from the endpoint\'s OpenAPI schema and validates your input at runtime.',
        hint: 'Common formats: {"messages": [...]} for chat models, {"prompt": "..."} for completions, {"input": [...]} for embeddings. If validation fails, you\'ll receive an error message with the correct format example.',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['queryEndpoint'],
            },
        },
        typeOptions: {
            rows: 10,
        },
    },
];
