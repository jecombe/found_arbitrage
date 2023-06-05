import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
import Web3EthContract from "web3-eth-contract";
import { BigNumber as big } from "ethers";
import ethers from "ethers";
import { createRequire } from "module";
import Logger from "../utils/Logger.js";
const require = createRequire(import.meta.url);
const artifactFlashloan = require("../artifacts/Flashloan.json");
import BigNumber from "bignumber.js";
import axios from "axios";
dotenv.config();
export const GWEI = big.from(10).pow(9);
export const PRIORITY_FEE = GWEI.mul(100);
const priorityFee = big.from(10).pow(9);
export default class {
  constructor(config, utils, telegram) {
    this.utils = utils;
    this.config = config;
    this.telegram = telegram;
    this.authSigner = this.getWallet();
    this.provider = this.getProvider();
    this.contractFlashloan = this.getContract();
    this.maxFeePerGas = null;
    this.maxPriorityFeePerGas = null;
    this.gasLimit = null;
  }

  getContract() {
    Web3EthContract.setProvider(process.env.PROVIDER_MAINNET);
    return new Web3EthContract(
      artifactFlashloan.abi,
      process.env.CONTRACT_FLASH
    );
  }

  getProvider() {
    return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_MAINNET);
  }

  getWallet() {
    return new ethers.Wallet(process.env.SECRET_KEY, this.provider);
  }

  async parseError(data) {
    try {
      const funct = data.slice(0, 10);
      const rep = await axios({
        url: "https://api.openchain.xyz/signature-database/v1/lookup",
        method: "GET",
        headers: {
          accept: "application/json",
        },
        params: {
          filter: true,
          function: funct,
        },
      });
      return rep.data.result.function[funct];
    } catch (error) {
      Logger.error("parseError: ", error);
      return undefined;
    }
  }

  async estimateGas(bytesParams, opensea, profit) {
    try {
      return big.from(await this.getEstimateGasMargin(bytesParams));
    } catch (error) {
      // const rep = strErrParser(error);
      if ("data" in error) {
        try {
          const errorParse = await this.parseError(error.data);
          Logger.error(
            `Estimate Gas errorParse: - ${opensea.name}: `,
            errorParse,
            bytesParams
          );
          this.telegram.sendMessage(
            `❗️ Estimate Gas errorParse ❗️\nName: ${opensea.name}\nError: ${
              errorParse[0].name
            }\nPrice: ${this.utils.parseWeiToEth(
              opensea.price
            )}\nProfit: ${this.utils.parseWeiToEth(profit)} 
            `
          );
        } catch (error) {
          Logger.error("EstimateGas error catch parse", error);
          return undefined;
        }
      } else {
        this.telegram.sendMessage(
          `🚨 Unknow errors 🚨\nName: ${opensea.name}\nError: ${
            errorParse[0].name
          }\nPrice: ${this.utils.parseWeiToEth(
            opensea.price
          )}\nProfit: ${this.utils.parseWeiToEth(profit)}
          `
        );
        Logger.error(`EstimateGas: - ${opensea.name} - ${bytesParams}`, error);
      }
      return undefined;
    }
  }

  async manageEip1559(bytesParams, profit, opensea) {
    try {
      await this.getBlock();
      this.gasLimit = await this.estimateGas(bytesParams, opensea, profit);

      if (!this.gasLimit)
        return { remainingAmountWei: undefined, transactionCostWei: undefined };

      const maxFeePerGasWei = this.getMaxBaseFeeInFutureBlock();
      const amountWei = new BigNumber(`${profit}`);
      this.maxPriorityFeePerGas = big.from(10).pow(9);
      this.maxFeePerGas = priorityFee.add(maxFeePerGasWei);
      const transactionCostWei = this.maxFeePerGas.mul(this.gasLimit);

      Logger.debug(
        `Transaction price net: `,
        ethers.utils.formatEther(transactionCostWei)
      );

      // Calculer le montant restant après déduction des frais de transaction
      const remainingAmountWei = amountWei.sub(transactionCostWei);
      //return ethers.utils.formatEther(remainingAmountWei);
      return {
        remainingAmountWei,
        transactionCostWei: transactionCostWei,
      };
    } catch (error) {
      Logger.error(
        `Error manageEip1559 with NFT: - ${opensea.name} - ${bytesParams}`,
        error
      );
      return { remainingAmountWei: undefined, transactionCostWei: undefined };
    }
  }

  async createBundle() {
    this.flashbotsProvider = await FlashbotsBundleProvider.create(
      this.provider,
      this.authSigner,
      this.config.relay,
      this.config.chain
    );
  }

  async createTx(bytesParams) {
    return {
      to: this.config.contractAddr,
      type: 2,
      maxFeePerGas: this.maxFeePerGas,
      maxPriorityFeePerGas: this.maxPriorityFeePerGas,
      gasLimit: this.gasLimit,
      data: this.contractFlashloan.methods
        .requestFlashLoan(bytesParams)
        .encodeABI(),
      chainId: this.config.chainId,
      // to: this.config.contractAddr,
      // type: 2,
      // maxFeePerGas: priorityFee.add(this.getMaxBaseFeeInFutureBlock()),
      // //  maxPriorityFeePerGas: PRIORITY_FEE,
      // gasLimit,
      // data: this.contractFlashloan.methods.requestFlashLoan(bytes).encodeABI(), //this.contractFlashloan.methods.requestFlashloan(bytes).encodeABI(),
      // value: 0,
      // chainId: this.config.chainId,
    };
  }

  async getEstimateGasMargin(bytes) {
    const gas = await this.contractFlashloan.methods
      .requestFlashLoan(bytes)
      .estimateGas();
    const marginGas = Math.ceil(gas * 1.1);

    return marginGas;
  }

  async signBundle(transaction) {
    try {
      await this.createBundle();

      this.signedTransactions = await this.flashbotsProvider.signBundle([
        {
          signer: this.authSigner,
          transaction,
        },
      ]);
    } catch (error) {
      Logger.error("signBundle", error);
    }
  }

  async simulateBundle() {
    let sendBundles = false;

    try {
      const simulation = await this.flashbotsProvider.simulate(
        this.signedTransactions,
        this.blockNumber + 1
      );
      if ("error" in simulation) {
        Logger.error(`Simulation Error: ${simulation.error.message}`);
      } else {
        sendBundles = true;
        Logger.info(
          `Simulation Success: ${this.blockNumber} ${JSON.stringify(
            simulation,
            null,
            2
          )}`
        );
        const gasUsed = simulation.results.reduce(
          (acc, txSimulation) => acc + txSimulation.gasUsed,
          0
        );

        const gasPrice = simulation.coinbaseDiff.div(gasUsed);
        return gasPrice;
      }
      throw new Error("Failed to simulate response");
    } catch (error) {
      Logger.error("simulateBundle", error);
      return sendBundles;
    }
  }

  async sendBundle() {
    try {
      for (var i = 1; i <= 30; i++) {
        const res = await this.flashbotsProvider.sendRawBundle(
          this.signedTransactions,
          this.blockNumber + i
        );
        if ("error" in res) {
          throw new Error(res.error.message);
        }
        const bundleResolution = await res.wait();
        if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
          Logger.info(
            `Congratulations, the transaction is successfully uploaded to the chain, and the block: ${
              this.blockNumber + i
            }`
          );
          Logger.trace(`Transaction => ${JSON.stringify(res, null, 2)}`);
          return this.blockNumber + i;
        } else if (
          bundleResolution ===
          FlashbotsBundleResolution.BlockPassedWithoutInclusion
        ) {
          Logger.warn(
            `Please try again, the transaction was not included in the block: ${
              this.blockNumber + i
            }`
          );
        } else if (
          bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh
        ) {
          Logger.fatal("Nonce too high !");
        }
        Logger.debug(`submitted for block # ${this.blockNumber + i}`);
      }
    } catch (error) {
      Logger.error("sendBundle", error);
    }
  }

  async tryTransaction(bytesParams) {
    try {
      await this.signBundle(await this.createTx(bytesParams));
      const gasPrice = await this.simulateBundle();

      this.telegram.sendMessage(
        `✅ Simulate good ! ${Number(gasPrice) / 1e18}`
      );
      Logger.info(`✅ Simulate good ! ${Number(gasPrice) / 1e18}`);
      //return this.sendBundle();
    } catch (error) {
      Logger.error("tryTransaction", error);
      this.telegram.sendMessage("erreur try transaction");
      return error;
    }
  }
  async getBlock() {
    try {
      this.blockNumber = await this.provider.getBlockNumber();

      this.block = await this.provider.getBlock(this.blockNumber);
    } catch (error) {
      Logger.error("getBlock", error);
    }
  }

  getMaxBaseFeeInFutureBlock() {
    return FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
      this.block.baseFeePerGas,
      1
    );
  }

  getMaxFeePerGas() {
    return PRIORITY_FEE.add(this.getMaxBaseFeeInFutureBlock());
  }
}
