/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';
import { Embeddings } from '@langchain/core/embeddings';

import { logWrapper } from '@utils/logWrapper';
import { getConnectionHintNoticeField } from '@utils/sharedFields';

interface DatabricksEmbeddingsResponse {
	predictions: number[][];
}

class DatabricksEmbeddings extends Embeddings {
	private apiKey: string;
	private host: string;
	private endpoint: string;

	constructor(fields: { 
		apiKey: string; 
		host: string; 
		endpoint: string;
	}) {
		super({});
		this.apiKey = fields.apiKey;
		this.host = fields.host;
		this.endpoint = fields.endpoint;
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		const response = await fetch(`${this.host}/api/2.0/serving-endpoints/${this.endpoint}/invocations`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				inputs: texts,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Databricks API error (${response.status}): ${error}`);
		}

		const result = await response.json() as DatabricksEmbeddingsResponse;
		return result.predictions;
	}

	async embedQuery(text: string): Promise<number[]> {
		const embeddings = await this.embedDocuments([text]);
		return embeddings[0];
	}
}

export class EmbeddingsDatabricks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Databricks',
		name: 'embeddingsDatabricks',
		icon: { light: 'file:databricks.svg', dark: 'file:databricks.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Use Databricks Foundation Models for Embeddings',
		defaults: {
			name: 'Embeddings Databricks',
		},
		credentials: [
			{
				name: 'databricksApi',
				required: true,
			},
		],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.databricks.com/machine-learning/foundation-models/',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]),
			{
				displayName:
					'Make sure to use the same dimensionality for your vector store as the model you select.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Serving Endpoint',
				name: 'servingEndpoint',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the model serving endpoint to use for embeddings',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.debug('Supply data for embeddings Databricks');
		const servingEndpoint = this.getNodeParameter('servingEndpoint', itemIndex) as string;
		const credentials = await this.getCredentials('databricksApi');

		// Initialize Databricks embeddings with model serving endpoint
		const embeddings = new DatabricksEmbeddings({
			apiKey: credentials.token as string,
			host: credentials.host as string,
			endpoint: servingEndpoint,
		});

		return {
			response: logWrapper(embeddings, this),
		};
	}
}