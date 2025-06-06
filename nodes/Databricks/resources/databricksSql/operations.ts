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
                        catalog: '={{$parameter.additionalFields?.catalog}}',
                        schema: '={{$parameter.additionalFields?.schema}}',
                        wait_timeout: '={{$parameter.additionalFields?.timeout}}',
                    },
                },
            },
        },
        {
            name: 'List Tables',
            value: 'listTables',
            description: 'List available tables',
            action: 'List available tables',
            routing: {
                request: {
                    method: 'GET',
                    url: '/api/2.1/unity-catalog/tables',
                    qs: {
                        catalog_name: '={{$parameter.additionalFields?.catalog}}',
                        schema_name: '={{$parameter.additionalFields?.schema}}',
                        max_results: '={{$parameter.additionalFields?.maxResults}}',
                        page_token: '={{$parameter.additionalFields?.pageToken}}'
                    },
                },
            },
        },
    ],
    default: 'executeQuery',
};