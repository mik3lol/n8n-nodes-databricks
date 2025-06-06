import type { INodeProperties } from 'n8n-workflow';

export const modelServingParameters: INodeProperties[] = [
    {
        displayName: 'Endpoint Name',
        name: 'endpointName',
        type: 'string',
        required: true,
        default: '',
        description: 'Name of the serving endpoint',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['getEndpoint', 'updateEndpoint', 'deleteEndpoint', 'queryEndpoint', 'getEndpointLogs'],
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
        default: '',
        description: 'Input data for model inference (in JSON format)',
        displayOptions: {
            show: {
                resource: ['modelServing'],
                operation: ['queryEndpoint'],
            },
        },
    },
];