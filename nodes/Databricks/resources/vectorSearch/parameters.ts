import type { INodeProperties } from 'n8n-workflow';

export const vectorSearchParameters: INodeProperties[] = [
    {
        displayName: 'Index Name',
        name: 'indexName',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['createIndex', 'deleteIndex', 'getIndex', 'queryIndex', 'scanIndex', 'upsertData'],
            },
        },
        default: '',
        description: 'Name of the vector search index',
    },
    {
        displayName: 'Endpoint Name',
        name: 'endpointName',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['createIndex'],
            },
        },
        default: '',
        description: 'Name of the serving endpoint',
    },
    {
        displayName: 'Primary Key',
        name: 'primaryKey',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['createIndex'],
            },
        },
        default: 'id',
        description: 'Primary key column name',
    },
    {
        displayName: 'Vector Column',
        name: 'vectorColumn',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['createIndex'],
            },
        },
        default: 'vector',
        description: 'Column name containing the vector data',
    },
    {
        displayName: 'Query Vector',
        name: 'queryVector',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        default: '',
        description: 'Vector to search for similar vectors',
    },
    {
        displayName: 'Number of Results',
        name: 'numResults',
        type: 'number',
        required: false,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        default: 10,
        description: 'Maximum number of results to return (default: 10)',
    },
    {
        displayName: 'Score Threshold',
        name: 'scoreThreshold',
        type: 'number',
        required: false,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        default: 0,
        description: 'Minimum relevance score threshold for results. Must be ≥ 0 and ≤ 1.',
    },
    {
        displayName: 'Filter Expression',
        name: 'filterExpression',
        type: 'string',
        required: false,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        default: '',
        description: 'SQL-like filter expression to apply to the results',
    },
    {
        displayName: 'Data',
        name: 'data',
        type: 'json',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['upsertData'],
            },
        },
        default: '',
        description: 'Data to upsert in JSON format',
    },
];