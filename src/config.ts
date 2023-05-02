export type NetworkEnvironment = 'localhost' | 'testnet';

interface NetworkConfig {
  relayerAddr: string;
}

export const NETWORK_CONFIG: Record<NetworkEnvironment, NetworkConfig> = {
  localhost: {
    relayerAddr: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  },
  testnet: {
    relayerAddr: '0xa79F1c8a025B4E1Bc545B0757e265827482abCe0',
  },
};
