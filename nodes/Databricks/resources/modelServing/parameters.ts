import type { INodeProperties } from 'n8n-workflow';

export const modelServingParameters: INodeProperties[] = [
    {
        displayName: 'Endpoint Name',
        name: 'endpointName',
        type: 'options',
        required: true,
        default: '',
        description: 'Name of the serving endpoint',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['getEndpoint', 'updateEndpoint', 'deleteEndpoint', 'queryEndpoint', 'getEndpointLogs'],
            },
        },
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
                                    property: 'endpoints', // Changed from 'serving_endpoints' to 'endpoints'
                                },
                            },
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
    },
    {
        displayName: 'Served Models',
        name: 'servedModels',
        type: 'json',
        required: true,
        default: '',
        description: 'List of models to serve (in JSON format)',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['createEndpoint', 'updateEndpoint'],
            },
        },
    },
    {
        displayName: 'Traffic Config',
        name: 'trafficConfig',
        type: 'json',
        required: true,
        default: '',
        description: 'Traffic configuration for the endpoint (in JSON format)',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['createEndpoint', 'updateEndpoint'],
            },
        },
    },
    {
        displayName: 'Input Data',
        name: 'inputs',
        type: 'json',
        required: true,
        default: '["Hello, how are you?"]',
        placeholder: '["Hello, how are you?"]',
        description: 'Input data for the model in JSON format. For most models, this should be an array of strings.',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['queryEndpoint'],
            },
        },
    },
];