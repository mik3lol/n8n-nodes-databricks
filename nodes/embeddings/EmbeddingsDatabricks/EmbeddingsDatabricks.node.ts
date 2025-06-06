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
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.databricks.com/aws/en/generative-ai/create-query-vector-search',
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
					'Make sure the vector store and embedding model have the same dimensionality.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Serving Endpoint',
				name: 'servingEndpoint',
				type: 'options',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/api/2.0/serving-endpoints',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'endpoints',
										},
									},
									{
										type: 'filter',
										properties: {
											pass: '={{$responseItem.config.served_entities?.some(entity => entity.external_model?.task === "llm/v1/embeddings") || $responseItem.config.served_entities?.some(entity => entity.foundation_model?.name?.match(/embedding|embed|text-embedding|vector/i))}}',
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{$responseItem.name}}',
											value: '={{$responseItem.name}}',
											description: '={{($responseItem.config.served_entities || []).map(entity => entity.external_model?.name || entity.foundation_model?.name).filter(Boolean).join(", ")}}',
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
				default: '',
				required: true,
				description: 'Name of the embeddings serving endpoint',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.debug('Supply data for embeddings Databricks');
		const servingEndpoint = this.getNodeParameter('servingEndpoint', itemIndex) as string;
		const credentials = await this.getCredentials('databricks');

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