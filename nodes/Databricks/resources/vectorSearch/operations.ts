import type { INodeProperties } from 'n8n-workflow';

export const vectorSearchOperations: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
        show: {
            resource: ['vectorSearch'],
        },
    },
    options: [
        {
            name: 'Create Index',
            value: 'createIndex',
            description: 'Create a new vector search index',
            action: 'Create a vector search index',
        },
        {
            name: 'Delete Index',
            value: 'deleteIndex',
            description: 'Delete a vector search index',
            action: 'Delete a vector search index',
        },
        {
            name: 'Get Index',
            value: 'getIndex',
            description: 'Get details of a vector search index',
            action: 'Get a vector search index',
        },
        {
            name: 'List Indexes',
            value: 'listIndexes',
            description: 'List all vector search indexes',
            action: 'List vector search indexes',
        },
        {
            name: 'Query Index',
            value: 'queryIndex',
            description: 'Query a vector search index',
            action: 'Query a vector search index',
            routing: {
                request: {
                    method: 'POST',
                    url: '/api/2.0/vector-search/indexes/{{$parameter.indexName}}/query',
                    body: {
                        query_vector: '={{$parameter.queryVector}}',
                        columns: [],
                        num_results: '={{$parameter.numResults || 10}}',
                        score_threshold: '={{$parameter.scoreThreshold || 0}}',
                        filter_expression: '={{$parameter.filterExpression}}'
                    },
                },
            },
        },
        {
            name: 'Scan Index',
            value: 'scanIndex',
            description: 'Scan a vector search index',
            action: 'Scan a vector search index',
        },
        {
            name: 'Upsert Data',
            value: 'upsertData',
            description: 'Upsert data into a vector search index',
            action: 'Upsert data into a vector search index',
        },
    ],
    default: 'listIndexes',
};