import type {
    IExecuteFunctions,
    INodeExecutionData,
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

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        
        for (let i = 0; i < items.length; i++) {
            const resource = this.getNodeParameter('resource', i) as string;
            const operation = this.getNodeParameter('operation', i) as string;

            if (resource === 'files' && operation === 'uploadFile') {
                const dataFieldName = this.getNodeParameter('dataFieldName', i) as string;
                const catalog = this.getNodeParameter('catalog', i) as string;
                const schema = this.getNodeParameter('schema', i) as string;
                const volume = this.getNodeParameter('volume', i) as string;
                const path = this.getNodeParameter('path', i) as string;
                
                try {
                    // Get credentials
                    const credentials = await this.getCredentials('databricks');
                    const host = credentials.host as string;

                    // Get binary data using getBinaryDataBuffer
                    const binaryData = await this.helpers.getBinaryDataBuffer(i, dataFieldName);
                    
                    // Make the upload request
                    await this.helpers.httpRequest({
                        method: 'PUT',
                        url: `${host}/api/2.0/fs/files/Volumes/${catalog}/${schema}/${volume}/${path}`,
                        body: binaryData,
                        headers: {
                            'Authorization': `Bearer ${credentials.token}`,
                            'Content-Type': items[i].binary?.[dataFieldName]?.mimeType || 'application/octet-stream',
                        },
                        encoding: 'arraybuffer',
                    });

                    // Store the result
                    returnData.push({
                        json: { 
                            success: true,
                            message: `File uploaded successfully to ${path}`
                        }
                    });
                    
                    continue;
                } catch (error) {
                    if (!items[i].binary?.[dataFieldName]) {
                        throw new Error(`No binary data found in field "${dataFieldName}"`);
                    }
                    throw error;
                }
            }

            returnData.push({
                ...items[i],
                json: items[i].json,
            });
        }

        return [returnData];
    }
}