# n8n-nodes-databricks

This is an n8n community node that provides comprehensive integration with Databricks APIs, including Genie AI, SQL, Unity Catalog, Model Serving, Files, and Vector Search capabilities.

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

## Features

- 🤖 **Genie AI Assistant**: Start conversations, send messages, and execute SQL queries through Databricks' AI assistant
- 📂 **File Operations**: Upload, download, list, and manage files in Databricks volumes (up to 5 GiB)
- 🗄️ **Databricks SQL**: Execute SQL queries and manage statements
- 📚 **Unity Catalog**: Manage catalogs, schemas, tables, and volumes
- 🤖 **Model Serving**: Query AI models and manage endpoints
- 🔍 **Vector Search**: Perform vector similarity searches

## Prerequisites

You need the following installed on your development machine:

* [git](https://git-scm.com/downloads)
* Node.js and pnpm. Minimum version Node 18. You can find instructions on how to install both using nvm (Node Version Manager) for Linux, Mac, and WSL [here](https://github.com/nvm-sh/nvm). For Windows users, refer to Microsoft's guide to [Install NodeJS on Windows](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows).
* Install n8n with:
  ```
  pnpm install n8n -g
  ```
* A Databricks workspace with a personal access token

## Installation

### For Development

1. Clone this repository:
   ```bash
   git clone https://github.com/<your-org>/n8n-nodes-databricks.git
   cd n8n-nodes-databricks
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the node:
   ```bash
   pnpm build
   ```

4. Link to your n8n installation:
   ```bash
   npm link
   cd ~/.n8n/custom
   npm link n8n-nodes-databricks
   ```

### From npm (Coming Soon)

```bash
npm install n8n-nodes-databricks
```

## Credentials

To use this node, you need to configure Databricks credentials:

1. **Host**: Your Databricks workspace URL (e.g., `https://adb-1234567890123456.7.azuredatabricks.net`)
2. **Token**: Your Databricks personal access token

To generate a token:
1. Log into your Databricks workspace
2. Go to User Settings → Access Tokens
3. Click "Generate New Token"
4. Copy and save the token securely

## Architecture

### 📊 Project Structure

```
n8n-nodes-databricks/
│
├── 🎯 Main Node Entry Point
│   └── nodes/Databricks/Databricks.node.ts
│       ├── Class: Databricks (implements INodeType)
│       ├── Properties:
│       │   ├── displayName: 'Databricks'
│       │   ├── version: 1
│       │   ├── usableAsTool: true (can be used as an AI agent tool)
│       │   └── requestDefaults: { baseURL, Authorization }
│       │
│       ├── Node Configuration:
│       │   ├── Resource selector (dropdown):
│       │   │   ├── Genie (AI Assistant)
│       │   │   ├── Databricks SQL
│       │   │   ├── Unity Catalog
│       │   │   ├── Model Serving
│       │   │   ├── Files
│       │   │   └── Vector Search
│       │   │
│       │   ├── Operations (per resource)
│       │   └── Parameters (per resource)
│       │
│       └── Execute Method:
│           ├── Process each input item
│           ├── Handle special cases (custom logic)
│           └── Error handling with continueOnFail support
│
├── 📁 Resource Definitions
│   └── nodes/Databricks/resources/
│       ├── index.ts (exports all operations & parameters)
│       │
│       ├── 🤖 genie/
│       │   ├── operations.ts
│       │   │   └── Operations: [6 operations]
│       │   │       ├── startConversation
│       │   │       ├── createMessage
│       │   │       ├── getMessage
│       │   │       ├── executeMessageQuery
│       │   │       ├── getQueryResults
│       │   │       └── getSpace
│       │   │
│       │   └── parameters.ts
│       │       └── Parameters: spaceId, conversationId, messageId, etc.
│       │
│       ├── 📂 files/
│       │   ├── operations.ts
│       │   │   └── Operations: [7 operations]
│       │   │       ├── uploadFile (PUT binary data)
│       │   │       ├── downloadFile (GET file content)
│       │   │       ├── deleteFile (DELETE)
│       │   │       ├── getFileInfo (HEAD metadata)
│       │   │       ├── listDirectory (GET directory contents)
│       │   │       ├── createDirectory (PUT)
│       │   │       └── deleteDirectory (DELETE)
│       │   │
│       │   └── parameters.ts
│       │
│       ├── 🗄️ databricksSql/
│       ├── 📚 unityCatalog/
│       ├── 🤖 modelServing/
│       └── 🔍 vectorSearch/
│
├── 🔐 Credentials
│   └── credentials/Databricks.credentials.ts
│       └── DatabricksCredentials interface:
│           ├── host: string (Databricks workspace URL)
│           └── token: string (Personal access token)
│
└── 🎨 Assets
    ├── databricks.svg (light mode icon)
    └── databricks.dark.svg (dark mode icon)
```

### 🔄 Execution Flow

```
User Input (n8n workflow)
    ↓
1. User selects RESOURCE (e.g., "Genie")
    ↓
2. User selects OPERATION (e.g., "Start Conversation")
    ↓
3. UI displays relevant PARAMETERS (using displayOptions.show)
    ↓
4. User fills in parameters (spaceId, initialMessage, etc.)
    ↓
5. Execute method is called
    ↓
6. Two execution paths:
    │
    ├─→ Path A: Declarative Routing (most operations)
    │   ├── n8n uses 'routing' config from operations.ts
    │   ├── Automatically builds HTTP request
    │   ├── Substitutes parameters using {{$parameter.xxx}}
    │   └── Sends request with credentials from requestDefaults
    │
    └─→ Path B: Custom Logic (special cases)
        ├── Files.uploadFile → Custom binary data handling
        └── Genie operations → Custom switch statement
            ├── Build URL dynamically
            ├── Create request body
            ├── Call this.helpers.httpRequest()
            └── Return response
    ↓
7. Return INodeExecutionData[][]
```

### 🧩 Key Architectural Patterns

#### 1. Resource-Based Organization
Each Databricks API category is a separate "resource" with its own operations and parameters.

#### 2. Declarative Routing
Most operations use n8n's declarative `routing` configuration:
```typescript
routing: {
  request: {
    method: 'POST',
    url: '=/api/2.0/genie/spaces/{{$parameter.spaceId}}/conversations',
    body: {
      initial_message: '={{$parameter.initialMessage}}'
    }
  }
}
```

#### 3. Conditional Parameter Display
Parameters appear/hide based on selected resource and operation:
```typescript
displayOptions: {
  show: {
    resource: ['genie'],
    operation: ['startConversation']
  }
}
```

#### 4. Two Execution Modes
- **Declarative**: n8n handles HTTP requests automatically (most operations)
- **Imperative**: Custom logic in execute() method (files upload, genie operations)

#### 5. Error Handling
Comprehensive error handling with three types:
- **API Errors**: Status code + error details
- **Network Errors**: Connection failures
- **Other Errors**: General exceptions

All support `continueOnFail` mode for resilient workflows.

## Development

### Building the Node

```bash
pnpm build
```

### Linting

```bash
pnpm lint
# or auto-fix
pnpm lintfix
```

### Testing

```bash
pnpm test
```

## Usage Examples

### Example 1: Start a Genie Conversation

1. Add the Databricks node to your workflow
2. Select Resource: **Genie**
3. Select Operation: **Start Conversation**
4. Enter your **Space ID**
5. Enter your **Initial Message**: "Show me sales data for last quarter"

### Example 2: Upload a File to Databricks Volume

1. Add the Databricks node after a node that provides binary data
2. Select Resource: **Files**
3. Select Operation: **Upload File**
4. Configure:
   - Data Field Name: `data`
   - Catalog: `main`
   - Schema: `default`
   - Volume: `my_volume`
   - Path: `reports/report.pdf`

### Example 3: Query Vector Search

1. Add the Databricks node to your workflow
2. Select Resource: **Vector Search**
3. Select Operation: **Query Index**
4. Configure your query parameters

## Adding New Operations

To extend this node with new operations:

1. Navigate to the appropriate resource folder in `nodes/Databricks/resources/`
2. Add the new operation to `operations.ts`:
   ```typescript
   {
     name: 'My New Operation',
     value: 'myNewOperation',
     description: 'Description of what it does',
     action: 'Perform my new operation',
     routing: {
       request: {
         method: 'GET',
         url: '=/api/2.0/path/{{$parameter.id}}'
       }
     }
   }
   ```
3. Add required parameters to `parameters.ts`
4. Rebuild and test

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/<your-org>/n8n-nodes-databricks).

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Databricks API Documentation](https://docs.databricks.com/api/)
- [n8n Community](https://community.n8n.io/)

## License

[MIT](LICENSE.md)
