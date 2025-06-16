import {
    type IDataObject,
    // type INodeType,
    // type INodeTypeDescription,
} from 'n8n-workflow';
import { createVectorStoreNode } from '../shared/createVectorStoreNode/createVectorStoreNode';
import { DatabricksVectorStoreLangChain } from '@utils/DatabricksVectorStoreLangChain';

interface VectorStoreFilter extends IDataObject {
    indexName: string;
    textColumn: string;
    metadataColumns: string;
    scoreThreshold?: number;
}

export class VectorStoreDatabricks extends createVectorStoreNode<DatabricksVectorStoreLangChain>({
    meta: {
        displayName: 'Databricks Vector Store',
        name: 'databricksVectorStore',
        description: 'Operations for Databricks Vector Store',
        docsUrl: 'https://docs.databricks.com/aws/en/generative-ai/vector-search',
        icon: 'file:databricks.svg',
        operationModes: ['load', 'insert', 'retrieve', 'retrieve-as-tool'],
        credentials: [
            {
                name: 'databricks',
                required: true,
            },
        ],
    },
    sharedFields: [
        {
            displayName: 'Index Name',
            name: 'indexName',
            type: 'string',
            default: '',
            required: true,
            description: 'Name of the vector search index in Databricks',
        },
        {
            displayName: 'Text Column',
            name: 'textColumn',
            type: 'string',
            default: 'text',
            required: true,
            description: 'Name of the column containing the document text',
        },
        {
            displayName: 'Metadata Columns',
            name: 'metadataColumns',
            type: 'string',
            default: '',
            description: 'Comma-separated list of columns to include as metadata',
        },
        {
            displayName: 'Score Threshold',
            name: 'scoreThreshold',
            type: 'number',
            default: 0.8,
            description: 'Minimum similarity score threshold',
        },

    ],
    retrieveFields: [
        // ... other retrieve fields can be added here if needed
    ],
    async getVectorStoreClient(context, filter, embeddings, itemIndex) {
        const credentials = await context.getCredentials('databricks');
        const indexName = context.getNodeParameter('indexName', itemIndex) as string;
        const textColumn = context.getNodeParameter('textColumn', itemIndex) as string;
        const metadataColumns = context.getNodeParameter('metadataColumns', itemIndex) as string;
        const scoreThreshold = context.getNodeParameter('scoreThreshold', itemIndex, 0.8) as number;

        if (!indexName || !textColumn) {
            throw new Error('Missing required input properties: indexName or textColumn');
        }

        const metadataColumnsList = metadataColumns
            ? metadataColumns.split(',').map((s: string) => s.trim())
            : [];

        return await DatabricksVectorStoreLangChain.fromExistingIndex(embeddings, {
            workspaceUrl: credentials.host as string,
            token: credentials.token as string,
            indexName,
            textColumn,
            metadataColumns: metadataColumnsList,
            scoreThreshold,
        });
    },
    async populateVectorStore(context, embeddings, documents, itemIndex) {
        const credentials = await context.getCredentials('databricks');
        const inputData = context.getInputData()[itemIndex].json as VectorStoreFilter;
        
        if (!inputData?.indexName || !inputData?.textColumn) {
            throw new Error('Missing required input properties: indexName or textColumn');
        }

        const metadataColumnsList = inputData.metadataColumns ? 
            inputData.metadataColumns.split(',').map((s: string) => s.trim()) : 
            [];

        await DatabricksVectorStoreLangChain.fromDocuments(documents, embeddings, {
            workspaceUrl: credentials.host as string,
            token: credentials.token as string,
            indexName: inputData.indexName,
            textColumn: inputData.textColumn,
            metadataColumns: metadataColumnsList,
        });
    },
    async releaseVectorStoreClient() {
        // No cleanup needed for Databricks Vector Store
    },
}) {}

export default VectorStoreDatabricks;