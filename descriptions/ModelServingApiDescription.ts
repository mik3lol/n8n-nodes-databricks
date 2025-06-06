export const modelServingApiDescription = {
    displayName: 'Databricks Model Serving API',
    name: 'databricksModelServingApi',
    documentationUrl: 'https://docs.databricks.com/api/latest/model-serving/index.html',
    properties: [
        {
            displayName: 'Endpoint',
            name: 'endpoint',
            type: 'string',
            default: '',
            required: true,
            description: 'The API endpoint for model serving.',
        },
        {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            options: [
                {
                    name: 'POST',
                    value: 'POST',
                },
                {
                    name: 'GET',
                    value: 'GET',
                },
            ],
            default: 'POST',
            required: true,
            description: 'HTTP method to use for the request.',
        },
        {
            displayName: 'Headers',
            name: 'headers',
            type: 'json',
            default: {},
            required: false,
            description: 'Custom headers to include in the request.',
        },
        {
            displayName: 'Body',
            name: 'body',
            type: 'json',
            default: {},
            required: false,
            description: 'The body of the request, if applicable.',
        },
    ],
};