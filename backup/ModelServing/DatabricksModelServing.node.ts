import type {
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

export class DatabricksModelServing implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Databricks Mosaic Model Serving',
        name: 'databricksModelServing',
        icon: 'file:databricks.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Interact with Databricks Model Serving API',
        defaults: {
            name: 'Databricks Mosaic Model Serving',
        },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [
            {
                name: 'databricksApi',
                required: true,
            },
        ],
        requestDefaults: {
            baseURL: '={{$credentials.domain}}',
            headers: {
                Authorization: '={{$credentials.token}}',
            },
        },
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Serving Endpoint',
                        value: 'servingEndpoint',
                    },
                ],
                default: 'servingEndpoint',
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            'servingEndpoint',
                        ],
                    },
                },
                options: [
                    {
                        name: 'Query',
                        value: 'query',
                        description: 'Query a model serving endpoint',
                        action: 'Query a model serving endpoint',
                    },
                ],
                default: 'query',
            },
        ],
    };
}