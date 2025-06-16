import type { INodeProperties } from 'n8n-workflow';

export const databricksSqlOperations: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
        show: {
            resource: ['databricksSql'],
        },
    },
    options: [
        {
            name: 'Execute Query',
            value: 'executeQuery',
            description: 'Execute a SQL query',
            action: 'Execute a SQL query',
            routing: {
                request: {
                    method: 'POST',
                    url: '/api/2.0/sql/statements',
                    body: {
                        warehouse_id: '={{$parameter.warehouseId}}',
                        statement: '={{$parameter.query}}',
                    },
                },
            },
        },
    ],
    default: 'executeQuery',
};