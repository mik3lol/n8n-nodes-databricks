import type { INodeProperties } from 'n8n-workflow';

import { getBatchingOptionFields } from './src/utils/sharedFields';

import { commonOptions } from './src/utils/options';

const enableStreamingOption: INodeProperties = {
    displayName: 'Enable Streaming',
    name: 'enableStreaming',
    type: 'boolean',
    default: true,
    description: 'Whether this agent will stream the response in real-time as it generates text',
};

export const getToolsAgentProperties = ({
    withStreaming,
}: { withStreaming: boolean }): INodeProperties[] => [
        {
            displayName: 'Options',
            name: 'options',
            type: 'collection',
            default: {},
            placeholder: 'Add Option',
            options: [
                ...commonOptions,
                getBatchingOptionFields(undefined, 1),
                enableStreamingOption,
            ],
        },
    ];