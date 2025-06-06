import { createVectorStoreNode } from '../shared/createVectorStoreNode/createVectorStoreNode';
import type { VectorStore } from '@langchain/core/vectorstores';

export class DatabricksVectorStore {
  static description = createVectorStoreNode({
    meta: {
      displayName: 'Databricks Vector Store',
      name: 'databricksVectorStore',
      description: 'Operations for Databricks Vector Store',
      docsUrl: 'https://docs.databricks.com/aws/en/generative-ai/vector-search',
      icon: 'file:databricks.svg',
      // Optional: specify which operations this vector store supports
      operationModes: ['load', 'insert', 'update','retrieve', 'retrieve-as-tool'],
    },
    sharedFields: [
      // Fields shown in all operation modes
    ],
    loadFields: [
      // Fields specific to 'load' operation
    ],
    insertFields: [
      // Fields specific to 'insert' operation
    ],
    retrieveFields: [
      // Fields specific to 'retrieve' operation
    ],
    // Functions to implement
    getVectorStoreClient: async (context, filter, embeddings, itemIndex) => {
      // Create and return vector store instance
    },
    populateVectorStore: async (context, embeddings, documents, itemIndex) => {
      // Insert documents into vector store
    },
    // Optional: cleanup function - called in finally blocks after operations
    releaseVectorStoreClient: (vectorStore) => {
      // Release resources such as database connections or external clients
      // For example, in PGVector: vectorStore.client?.release();
    },
  });
}