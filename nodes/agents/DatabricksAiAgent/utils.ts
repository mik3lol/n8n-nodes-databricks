// Function used in the inputs expression to figure out which inputs to

import {
    type INodeInputConfiguration,
    type INodeInputFilter,
    type NodeConnectionType,
} from 'n8n-workflow';

// display based on the agent type
export function getInputs(
    hasMainInput?: boolean,
    hasOutputParser?: boolean,
    needsFallback?: boolean,
): Array<NodeConnectionType | INodeInputConfiguration> {
    interface SpecialInput {
        type: NodeConnectionType;
        filter?: INodeInputFilter;
        displayName: string;
        required?: boolean;
    }

    const getInputData = (
        inputs: SpecialInput[],
    ): Array<NodeConnectionType | INodeInputConfiguration> => {
        return inputs.map(({ type, filter, displayName, required }) => {
            const input: INodeInputConfiguration = {
                type,
                displayName,
                required,
                maxConnections: ['ai_languageModel', 'ai_memory', 'ai_outputParser'].includes(type)
                    ? 1
                    : undefined,
            };

            if (filter) {
                input.filter = filter;
            }

            return input;
        });
    };

    let specialInputs: SpecialInput[] = [
        {
            type: 'ai_languageModel',
            displayName: 'Chat Model',
        },
        {
            type: 'ai_languageModel',
            displayName: 'Fallback Model',
        },
        {
            displayName: 'Memory',
            type: 'ai_memory',
        },
        {
            displayName: 'Tool',
            type: 'ai_tool',
        },
        {
            displayName: 'Output Parser',
            type: 'ai_outputParser',
        },
    ];

    if (hasOutputParser !== true) {
        specialInputs = specialInputs.filter((input) => input.type !== 'ai_outputParser');
    }
    if (needsFallback !== true) {
        specialInputs = specialInputs.filter((input) => input.displayName !== 'Fallback Model');
    }

    // Note cannot use NodeConnectionType.Main
    // otherwise expression won't evaluate correctly on the FE
    const mainInputs = hasMainInput ? ['main' as NodeConnectionType] : [];
    return [...mainInputs, ...getInputData(specialInputs)];
}