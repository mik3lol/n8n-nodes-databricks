import { VectorStore } from '@langchain/core/vectorstores';
import { Embeddings } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';

interface DatabricksVectorStoreConfig {
    workspaceUrl: string;
    token: string;
    indexName: string;
    textColumn: string;
    metadataColumns: string[];
    scoreThreshold?: number;
}

interface DatabricksVectorSearchResponse {
    manifest: {
        column_count: number;
        columns: Array<{
            name: string;
        }>;
    };
    next_page_token?: string;
    result: {
        data_array: Array<[string, string, number[]]>; // [id, text, vector]
        row_count: number;
    };
}

export class DatabricksVectorStoreLangChain extends VectorStore {
    private config: DatabricksVectorStoreConfig;
    _vectorstoreType(): string { return "databricks"; }

    constructor(embeddings: Embeddings, config: DatabricksVectorStoreConfig) {
        super(embeddings, {});
        this.config = config;
    }

    private async makeRequest(method: string, indexName: string, body?: any) {
        const headers = {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept': 'application/json, text/plain, */*',
        };

        const url = `${this.config.workspaceUrl}/api/2.0/vector-search/indexes/${indexName}/query`;

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Databricks API error: ${error.message}`);
        }

        return response.json();
    }

    /**
     * Create a new index and populate it with documents
     */
    static async fromDocuments(
        docs: Document[],
        embeddings: Embeddings,
        config: DatabricksVectorStoreConfig
    ): Promise<DatabricksVectorStoreLangChain> {
        const instance = new this(embeddings, config);
        await instance.addDocuments(docs);
        return instance;
    }

    /**
     * Create an instance from an existing index
     */
    static async fromExistingIndex(
        embeddings: Embeddings,
        config: DatabricksVectorStoreConfig
    ): Promise<DatabricksVectorStoreLangChain> {
        return new this(embeddings, config);
    }

    /**
     * Add documents to the vector store
     */
    async addDocuments(documents: Document[]): Promise<void> {
        const texts = documents.map((doc) => doc.pageContent);
        const vectors = await this.embeddings.embedDocuments(texts);
        await this.addVectors(vectors, documents);
    }

    /**
     * Add vectors directly to the store
     */
    async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
        const rows = vectors.map((vector, i) => ({
            id: documents[i].metadata.id || `doc_${i}`,
            embedding: vector,
            [this.config.textColumn]: documents[i].pageContent,
            ...Object.fromEntries(
                this.config.metadataColumns.map(col => [col, documents[i].metadata[col]])
            ),
        }));

        await this.makeRequest('POST', this.config.indexName, {
            vectors: rows,
        });
    }

    /**
     * Delete documents
     */
    async delete(params: { ids: string[] }): Promise<void> {
        await this.makeRequest('POST', this.config.indexName, {
            ids: params.ids,
        });
    }

    /**
     * Find similar documents with scores
     */
    async similaritySearchVectorWithScore(
        query: number[],
        k: number,
        filterJson?: string,
        queryType?: 'ANN' | 'HYBRID',
        extraColumns?: string[],
        scoreThreshold?: number
    ): Promise<[Document, number][]> {
        // Normalize query if it is an array of objects with a 'response' property
        let normalizedQuery = query;
        if (Array.isArray(query) && query.length === 1 && typeof query[0] === 'object' && query[0] !== null && 'response' in query[0]) {
            normalizedQuery = (query[0] as any).response;
        }

        // Build columns array
        const columns = [this.config.textColumn, ...this.config.metadataColumns];
        if (extraColumns) {
            for (const col of extraColumns) {
                if (!columns.includes(col)) columns.push(col);
            }
        }

        // Build request body
        const body: Record<string, any> = {
            columns,
            num_results: k,
            query_vector: normalizedQuery
        };
        if (filterJson) {
            body.filters_json = filterJson;
        }
        if (queryType) {
            body.query_type = queryType;
        }
        if (scoreThreshold !== undefined) {
            body.score_threshold = scoreThreshold;
        } else if (this.config.scoreThreshold !== undefined) {
            body.score_threshold = this.config.scoreThreshold;
        }
        
        const response = await this.makeRequest('POST', this.config.indexName, body) as DatabricksVectorSearchResponse;

        // Only validate that we got a response with a result
        if (!response?.result) {
            throw new Error(`Databricks API returned invalid response structure. Full response: ${JSON.stringify(response)}`);
        }

        // If data_array doesn't exist or is empty, return empty results
        if (!response.result.data_array || !Array.isArray(response.result.data_array) || response.result.data_array.length === 0) {
            response.result.data_array = [];
        }

        // Process results from data_array where each item is [id, text, vector]
        return response.result.data_array.map(([id, text, vector]) => {
            const doc = new Document({
                pageContent: text,
                metadata: {
                    id,
                    // Add any metadata columns that were requested
                    ...(this.config.metadataColumns.length > 0 && {
                        // Convert metadata columns to key-value pairs
                        ...Object.fromEntries(
                            this.config.metadataColumns.map((col, index) => [
                                col,
                                response.result.data_array[index + 3] // +3 because id, text, vector are first
                            ])
                        )
                    })
                },
            });
            
            // Calculate cosine similarity as the score
            // This is a placeholder - you might want to implement proper scoring
            const score = 1.0; // Default score if not provided by API
            
            return [doc, score];
        });
    }
}
