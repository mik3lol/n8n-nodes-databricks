import type { INodeProperties } from 'n8n-workflow';

export const databricksSqlParameters: INodeProperties[] = [
    {
        displayName: 'Warehouse',
        name: 'warehouseId',
        type: 'options',
        required: true,
        default: '',
        description: 'The SQL warehouse to use',
        displayOptions: {
            show: {
                resource: ['databricksSql'],
                operation: ['executeQuery'],
            },
        },
        typeOptions: {
            loadOptions: {
                routing: {
                    request: {
                        method: 'GET',
                        url: '/api/2.0/sql/warehouses',
                    },
                    output: {
                        postReceive: [
                            {
                                type: 'rootProperty',
                                properties: {
                                    property: 'warehouses',
                                },
                            },
                            {
                                type: 'setKeyValue',
                                properties: {
                                    name: '={{$responseItem.name}}',
                                    value: '={{$responseItem.id}}',
                                    description: '={{$responseItem.size || ""}}',
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
        displayName: 'Query',
        name: 'query',
        type: 'string',
        typeOptions: {
            rows: 4,
        },
        displayOptions: {
            show: {
                operation: [
                    'executeQuery',
                ],
            },
        },
        default: '',
        placeholder: 'SELECT * FROM my_table LIMIT 10',
        required: true,
        description: 'SQL query to execute',
    },
    {
        displayName: 'Query ID',
        name: 'queryId',
        type: 'string',
        required: true,
        default: '',
        description: 'The ID of the query to update',
        displayOptions: {
            show: {
                operation: [
                    'updateQuery',
                    'deleteQuery',
                ],
            },
        },
    },
];