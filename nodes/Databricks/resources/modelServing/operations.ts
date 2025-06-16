import type { INodeProperties } from 'n8n-workflow';

export const modelServingOperations: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
        show: {
            resource: ['modelServing'],
        },
    },
    options: [
        {
            name: 'Query Endpoint',
            value: 'queryEndpoint',
            description: 'Query a serving endpoint',
            action: 'Query a serving endpoint',
            routing: {
                request: {
                    method: 'POST',
                    url: '/api/2.0/serving-endpoints/{{$parameter.endpointName}}/invocations',
                    body: {
                        inputs: '={{$parameter.inputs}}',
                    },
                },
            },
        },
    ],
    default: 'queryEndpoint',
};