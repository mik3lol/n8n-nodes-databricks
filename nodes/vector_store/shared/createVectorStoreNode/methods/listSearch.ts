// import { Pinecone } from '@pinecone-database/pinecone';
// import { QdrantClient } from '@qdrant/js-client-rest';
import { ApplicationError, type ILoadOptionsFunctions } from 'n8n-workflow';

// export async function pineconeIndexSearch(this: ILoadOptionsFunctions) {
// 	const credentials = await this.getCredentials('pineconeApi');

// 	const client = new Pinecone({
// 		apiKey: credentials.apiKey as string,
// 	});

// 	const indexes = await client.listIndexes();

// 	const results = (indexes.indexes ?? []).map((index) => ({
// 		name: index.name,
// 		value: index.name,
// 	}));

// 	return { results };
// }

// export async function supabaseTableNameSearch(this: ILoadOptionsFunctions) {
// 	const credentials = await this.getCredentials('supabaseApi');

// 	const results = [];

// 	if (typeof credentials.host !== 'string') {
// 		throw new ApplicationError('Expected Supabase credentials host to be a string');
// 	}

// 	const { paths } = (await this.helpers.requestWithAuthentication.call(this, 'supabaseApi', {
// 		headers: {
// 			Prefer: 'return=representation',
// 		},
// 		method: 'GET',
// 		uri: `${credentials.host}/rest/v1/`,
// 		json: true,
// 	})) as { paths: IDataObject };

// 	for (const path of Object.keys(paths)) {
// 		//omit introspection path
// 		if (path === '/') continue;

// 		results.push({
// 			name: path.replace('/', ''),
// 			value: path.replace('/', ''),
// 		});
// 	}

// 	return { results };
// }

// export async function qdrantCollectionsSearch(this: ILoadOptionsFunctions) {
// 	const credentials = await this.getCredentials('qdrantApi');

// 	const client = new QdrantClient({
// 		url: credentials.qdrantUrl as string,
// 		apiKey: credentials.apiKey as string,
// 	});

// 	const response = await client.getCollections();

// 	const results = response.collections.map((collection) => ({
// 		name: collection.name,
// 		value: collection.name,
// 	}));

// 	return { results };
// }

// Define an interface for the expected structure of a Databricks Vector Index item in the API response
interface DatabricksVectorIndex {
    name: string;
    // Add other relevant fields from the API response if needed
    endpoint_name: string;
    index_type: string;
}

// Define an interface for the expected API response structure
interface DatabricksListVectorIndexesResponse {
    vector_indexes?: DatabricksVectorIndex[];
    next_page_token?: string;
    // Add other fields if the API includes them
}

export async function databricksVectorIndexSearch(this: ILoadOptionsFunctions) {
    const credentials = await this.getCredentials('databricksApi');

    if (typeof credentials.host !== 'string' || !credentials.host) {
        throw new ApplicationError('Databricks API host is missing or not a string in credentials');
    }
    if (typeof credentials.token !== 'string' || !credentials.token) {
        throw new ApplicationError('Databricks API token is missing or not a string in credentials');
    }

    // Ensure host doesn't end with a slash for proper URL joining
    const host = credentials.host.replace(/\/$/, '');
    const endpoint = '/api/2.0/vector-search/indexes';
    const requestUrl = `${host}${endpoint}`;

    const response = await this.helpers.requestWithAuthentication.call(this, 'databricksApi', {
        method: 'GET',
        url: requestUrl, // Use 'url' instead of 'uri' for requestWithAuthentication
        headers: {
            'Accept': 'application/json',
        },
        json: true, // Automatically parses the JSON response
    }) as DatabricksListVectorIndexesResponse; // Type assertion for the response

    // Handle potential pagination if needed in the future using response.next_page_token

    const indexes = response.vector_indexes ?? [];

    const results = indexes.map((index) => ({
        name: index.name,
        value: index.name,
        // You could add description: `Endpoint: ${index.endpoint_name}` if desired
    }));

    return { results };
}
