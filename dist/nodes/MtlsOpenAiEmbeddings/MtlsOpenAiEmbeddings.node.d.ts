import { ICredentialTestFunctions, ICredentialsDecrypted, INodeCredentialTestResult, INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
export declare class MtlsOpenAiEmbeddings implements INodeType {
    description: INodeTypeDescription;
    methods: {
        credentialTest: {
            testMtlsOpenAiCredentials(this: ICredentialTestFunctions, credential: ICredentialsDecrypted): Promise<INodeCredentialTestResult>;
        };
    };
    supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData>;
}
//# sourceMappingURL=MtlsOpenAiEmbeddings.node.d.ts.map