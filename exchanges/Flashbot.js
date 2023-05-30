import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
import Web3EthContract from "web3-eth-contract";
//import { BigNumber } from "ethers";
import ethers from "ethers";
import { createRequire } from "module";
import Logger from "../utils/Logger.js";
const require = createRequire(import.meta.url);
const artifactFlashloan = require("../artifacts/Flashloan.json");
import BigNumber from "bignumber.js";
dotenv.config();

export default class {
  constructor(config, utils) {
    this.utils = utils;
    this.config = config;

    this.authSigner = this.getWallet();
    this.provider = this.getProvider();
    this.contractFlashloan = this.getContract();
  }

  getContract() {
    Web3EthContract.setProvider(process.env.PROVIDER_MAINNET);
    return new Web3EthContract(
      artifactFlashloan.abi,
      process.env.CONTRACT_FLASH
    );
  }

  getGwei() {}

  getMaxPriorityfees() {}

  getProvider() {
    return new ethers.providers.JsonRpcProvider(process.env.PROVIDER_MAINNET);
  }

  getWallet() {
    return new ethers.Wallet(process.env.SECRET_KEY, this.provider);
  }

  getMaxPrioFees(ethProfit) {
    // Convertir le montant en Wei
    // const amountInWei = this.utils.web3.utils.toWei(
    //   ethProfit.toString(),
    //   "ether"
    // );
    // const ethAmount = new BigNumber(ethProfit.toString());
    // const percentage = new BigNumber("0.01");
    // const weiAmount = ethAmount.times(1e18); // Conversion en wei
    // const deduction = weiAmount.times(1 - percentage);

    // const deductionInteger = new BigNumber(
    //   parseInt(deduction.mul(0.01).toFixed(0))
    // );

    // Quantité d'ETH en Gwei
    const ethAmount = new BigNumber(ethProfit);
    const ethInGwei = ethAmount.mul(10 ** 9);

    // Pourcentage à déduire (0.01%)
    const percentage = new BigNumber("0.01");
    const maxPriorityFee = ethInGwei.mul(percentage).div(100).toFixed(8);

    // Calcul de la nouvelle quantité d'ETH en Gwei
    const remainingEthInGwei = ethInGwei.minus(maxPriorityFee);

    // Conversion du résultat en ETH
    const remainingEth = remainingEthInGwei.div(10 ** 9);

    return { maxPriorityFee, remainingEth };

    // return deduction.toString();
    // Calculer la Max Priority Fee (1%)
    // return amountInWei;
    //const result = weiAmount.times(ethAmount);

    //return result;
  }

  async createBundle() {
    this.flashbotsProvider = await FlashbotsBundleProvider.create(
      this.provider,
      this.authSigner,
      this.config.relay,
      this.config.chain
    );
  }

  async createTx(bytes, gasLimit) {
    return {
      to: this.config.contractAddr,
      type: 2,
      maxFeePerGas: this.getMaxFeePerGas(),
      maxPriorityFeePerGas: PRIORITY_FEE,
      gasLimit,
      data: this.contractFlashloan.methods.requestFlashLoan(bytes).encodeABI(), //this.contractFlashloan.methods.requestFlashloan(bytes).encodeABI(),
      /// value: ethers.utils.parseEther("0"),
      chainId: this.config.chainId,
    };
  }

  async getEstimateGasMargin(bytes) {
    const gas = await this.contractFlashloan.methods
      .requestFlashLoan(bytes)
      .estimateGas();
    const marginGas = Math.ceil(gas * 1.1);
    const gasCostEth = this.utils.convert(marginGas);

    Logger.debug("GAS: ", gasCostEth);
    ///  Logger.debug("GAS  + margin: ", marginGas);

    return marginGas; // 10%
  }

  calculateProfit() {}

  async signBundle(transaction) {
    // const flashbotsProvider = await FlashbotsBundleProvider.create(
    //   this.provider,
    //   this.authSigner,
    //   "https://relay-goerli.flashbots.net",
    //   "goerli"
    // );
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
      }
      return sendBundles;
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
          //Logger.trace(JSON.stringify(res, null, 2));
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
