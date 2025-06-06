export const InferenceInputDescription = {
    displayName: 'Inference Input',
    name: 'inferenceInput',
    type: 'object',
    default: {},
    required: true,
    properties: [
        {
            displayName: 'Input Data',
            name: 'inputData',
            type: 'json',
            default: '',
            placeholder: 'Enter the input data for inference',
            description: 'The input data that will be sent to the model for inference.',
        },
        {
            displayName: 'Model Version',
            name: 'modelVersion',
            type: 'string',
            default: 'latest',
            placeholder: 'Enter the model version',
            description: 'The version of the model to use for inference. Defaults to the latest version.',
        },
        {
            displayName: 'Request ID',
            name: 'requestId',
            type: 'string',
            default: '',
            placeholder: 'Enter a unique request ID',
            description: 'A unique identifier for the inference request.',
        },
    ],
};