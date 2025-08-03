Libraries & Core Infrastructure
evm/contracts/libraries/
├── AddressLib.sol       ✅ Generic address utilities
├── ImmutablesLib.sol    ✅ Generic swap parameter handling  
├── TimelocksLib.sol     ✅ Generic timelock management
└── ProxyHashLib.sol     ✅ Generic proxy deployment

Base Contracts & Interfaces
evm/contracts/
├── BaseEscrow.sol           ✅ Core escrow logic is generic
├── Escrow.sol              ✅ Proxy deployment pattern is generic
└── interfaces/
    ├── IBaseEscrow.sol     ✅ Generic atomic swap interface
    └── IEscrow.sol         ✅ Generic escrow interface

Development Infrastructure
├── hardhat.config.ts       ✅ Hardhat configuration
├── tsconfig.json           ✅ TypeScript configuration  
├── package.json            ✅ Dependencies (mostly reusable)
└── typechain-types/        ✅ Auto-generated (will update)
1. Set up the evm folder
# Install core dependencies
npm install --save \
  @openzeppelin/contracts \
  @1inch/limit-order-protocol \
  ethers \
  hardhat

# Install dev dependencies
npm install --save-dev \
  @nomicfoundation/hardhat-toolbox \
  typescript \
  @types/node \
  ts-node \
  dotenv
