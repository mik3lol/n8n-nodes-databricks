import type {
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import {
    databricksSqlOperations, databricksSqlParameters,
    unityCatalogOperations, unityCatalogParameters,
    modelServingOperations, modelServingParameters,
    filesOperations, filesParameters,
    vectorSearchOperations, vectorSearchParameters,
    genieOperations, genieParameters,
} from './resources';

export class Databricks implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Databricks',
        name: 'databricks',
        icon: 'file:databricks.svg',
        group: ['transform'],
        version: 1,
        usableAsTool: true,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Interact with Databricks API',
        defaults: {
            name: 'Databricks',
        },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        credentials: [
            {
                name: 'databricks',
                required: true,
            },
        ],
        requestDefaults: {
            baseURL: '={{$credentials.host}}',
            headers: {
                Authorization: '=Bearer {{$credentials.token}}',
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
                        name: 'Genie',
                        value: 'genie',
                    },
                    {
                        name: 'Databricks SQL',
                        value: 'databricksSql',
                    },
                    {
                        name: 'Unity Catalog',
                        value: 'unityCatalog',
                    },
                    {
                        name: 'Model Serving',
                        value: 'modelServing',
                    },
                    {
                        name: 'Files',
                        value: 'files',
                    },
                    {
                        name: 'Vector Search',
                        value: 'vectorSearch',
                    },
                ],
                default: 'databricksSql',
            },

            // Import all operations first, grouped by resource
            filesOperations,
            genieOperations,
            unityCatalogOperations,
            databricksSqlOperations,
            modelServingOperations,
            vectorSearchOperations,

            // Then import all parameters
            ...filesParameters,
            ...genieParameters,
            ...unityCatalogParameters,
            ...databricksSqlParameters,
            ...modelServingParameters,
            ...vectorSearchParameters,
        ],
    };    
}