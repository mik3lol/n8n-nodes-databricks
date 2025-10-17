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
                operation: ['getIndex', 'queryIndex'],
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
                operation: ['listIndexes'],
            },
        },
        default: '',
        description: 'Name of the vector search endpoint',
    },
    {
        displayName: 'Query Type',
        name: 'queryType',
        type: 'options',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        options: [
            {
                name: 'Text Query',
                value: 'text',
                description: 'Query using text (automatically converted to vectors)',
            },
            {
                name: 'Vector Query',
                value: 'vector',
                description: 'Query using pre-computed vector embeddings',
            },
        ],
        default: 'text',
        description: 'Type of query to perform',
    },
    {
        displayName: 'Query Text',
        name: 'queryText',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
                queryType: ['text'],
            },
        },
        default: '',
        description: 'Text to search for (will be automatically converted to embeddings)',
        placeholder: 'What is machine learning?',
    },
    {
        displayName: 'Query Vector',
        name: 'queryVector',
        type: 'json',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
                queryType: ['vector'],
            },
        },
        default: '[]',
        description: 'Vector embeddings to search for similar vectors (array of numbers)',
        placeholder: '[0.1, 0.2, 0.3, ...]',
    },
    {
        displayName: 'Search Mode',
        name: 'searchMode',
        type: 'options',
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        options: [
            {
                name: 'Hybrid',
                value: 'HYBRID',
                description: 'Combines semantic (vector) and keyword search for best results',
            },
            {
                name: 'ANN (Approximate Nearest Neighbor)',
                value: 'ANN',
                description: 'Pure vector similarity search',
            },
        ],
        default: 'HYBRID',
        description: 'Search algorithm to use',
    },
    {
        displayName: 'Columns to Return',
        name: 'columns',
        type: 'string',
        required: true,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        default: '',
        description: 'Comma-separated list of column names to return in results (e.g., "content,url,title")',
        placeholder: 'content, url',
    },
    {
        displayName: 'Number of Results',
        name: 'numResults',
        type: 'number',
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        default: 10,
        description: 'Maximum number of results to return',
    },
    {
        displayName: 'Enable Reranking',
        name: 'enableReranking',
        type: 'boolean',
        default: false,
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        description: 'Whether to rerank results using a reranker model for improved relevance',
    },
    {
        displayName: 'Reranker Model',
        name: 'rerankerModel',
        type: 'string',
        required: true,
        default: 'databricks_reranker',
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
                enableReranking: [true],
            },
        },
        description: 'Name of the reranker model to use',
    },
    {
        displayName: 'Columns to Rerank',
        name: 'columnsToRerank',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'content',
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
                enableReranking: [true],
            },
        },
        description: 'Comma-separated list of columns to use for reranking (e.g., "content,title")',
    },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
            show: {
                resource: ['vectorSearch'],
                operation: ['queryIndex'],
            },
        },
        options: [
            {
                displayName: 'Filter Expression',
                name: 'filterExpression',
                type: 'string',
                default: '',
                description: 'SQL-like filter expression to apply to the results (e.g., "category = \'docs\' AND published = true")',
                placeholder: 'category = "documentation"',
            },
            {
                displayName: 'Score Threshold',
                name: 'scoreThreshold',
                type: 'number',
                default: 0,
                description: 'Minimum relevance score threshold for results. Must be ≥ 0 and ≤ 1.',
                typeOptions: {
                    minValue: 0,
                    maxValue: 1,
                    numberPrecision: 2,
                },
            },
        ],
    },
];