import { ICredentialTestFunctions, ICredentialsDecrypted, INodeCredentialTestResult, INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
export declare class MtlsOpenAiChatModel implements INodeType {
    description: INodeTypeDescription;
    methods: {
        credentialTest: {
            /**
             * Validates the mTLS credential by making a native https.request() with the
             * client certificate/key attached. This enforces actual mTLS authentication
             * — unlike ICredentialTestRequest which cannot attach a custom https.Agent.
             */
            testMtlsOpenAiCredentials(this: ICredentialTestFunctions, credential: ICredentialsDecrypted): Promise<INodeCredentialTestResult>;
        };
    };
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
}
//# sourceMappingURL=MtlsOpenAiChatModel.node.d.ts.map