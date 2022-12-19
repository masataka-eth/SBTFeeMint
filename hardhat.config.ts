import "dotenv/config"
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true
      }
    }
  },

  etherscan: {
    apiKey: {
      mainnet: process.env['ETHSCAN_API'] || '',
      goerli: process.env['ETHSCAN_API'] || '',
      polygon: process.env['POLYGONSCAN_API'] || '',
      polygonMumbai: process.env['POLYGONSCAN_API'] || '',

    },
  },
  networks: {
    localhost: {
      url: 'http://localhost:8545',
      chainId: 31337,
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
      },
    },
    goerli: {
      url: "https://eth-goerli.g.alchemy.com/v2/" + process.env.ALCHEMY_KEY,
      accounts: [`${process.env.PRIVATE_KEY}`],
    },
    mumbai: {
      url: "https://polygon-mumbai.g.alchemy.com/v2/" + process.env.ALCHEMY_KEY,
      accounts: [`${process.env.PRIVATE_KEY}`],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "JPY",
    gasPriceApi:
      "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    coinmarketcap:  process.env.COINMARKETCAP_API_KEY,
  },
};

export default config;
