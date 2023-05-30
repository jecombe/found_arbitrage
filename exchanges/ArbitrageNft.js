import _ from "lodash";
import Sudoswap from "./amm/Sudoswap.js";
import OpenSea from "./classic/OpenSea.js";
import Logger from "../utils/Logger.js";
import Utils from "../utils/Utils.js";
import ethers from "ethers";
import { BigNumber } from "ethers";
import { createRequire } from "module";
import Flashbot from "./Flashbot.js";
import Telegram from "../utils/Telegram.js";
const require = createRequire(import.meta.url);
const artifactFlashloan = require("../artifacts/Flashloan.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GWEI = BigNumber.from(10).pow(9);
const PRIORITY_FEE = GWEI.mul(100);

export default class {
  constructor(params) {
    this.tokenLoan = params.tokenLoan;
    this.addrFlashloan = params.addrFlashloan;
    this.amount = params.amount;
    this.utils = new Utils();
    this.telegram = new Telegram();
    this.config = this.createConfig(params);

    this.flashbot = new Flashbot(this.config, this.utils);
    this.exchanges = [
      {
        amm: new Sudoswap(this.utils),
        toCompare: [new OpenSea(this.utils)],
      },
    ];
  }

  createConfig(params) {
    if (params.chain === "goerli") {
      return {
        provider: process.env.PROVIDER_GOERLI,
        relay: process.env.RELAY_GOERLI,
        contractAddr: process.env.CONTRACT_FLASH,
        chain: "goerli",
        chainId: 5,
      };
    }
    if (params.chain === "mainnet") {
      return {
        provider: process.env.PROVIDER_MAIN,
        relay: process.env.RELAY_MAIN,
        contractAddr: process.env.CONTRACT_FLASH,
        chain: "mainnet",
        chainId: 1,
      };
    }
  }

  getProfit(profitBrut, estimateGas, maxFeePerGas, maxPriorityFeePerGas) {
    // Convertissez les valeurs en objets BigNumber
    const profitDifferenceWei = ethers.utils.parseEther(`${profitBrut}`);

    // Calculez les frais de transaction en Wei
    const transactionFee = maxFeePerGas
      .mul(estimateGas)
      .add(maxPriorityFeePerGas.mul(estimateGas));
    // Calculez les frais d'Aave
    const aaveFee = profitDifferenceWei
      .mul(ethers.utils.parseUnits("0.05", "ether"))
      .div(ethers.utils.parseUnits("1", "ether"));

    Logger.debug(
      `transaction fees total: ${ethers.utils.formatEther(transactionFee)}`
    );
    // Calculez le profit net en Wei (en déduisant les frais d'Aave)
    const profitNetWei = profitDifferenceWei.sub(transactionFee).sub(aaveFee);

    // Convertissez le profit net en ETH
    return ethers.utils.formatEther(profitNetWei);
  }

  async isProfitableGas(bytesParams, profit) {
    // calculate price gas and call flashloan cost
    try {
      await this.flashbot.getBlock();

      const profitAfterAave = profit * 0.0005; // 0.05% aave interest
      const ethAmountAfterInterest = profit - profitAfterAave;
      const estimateGas = BigNumber.from(
        await this.flashbot.getEstimateGasMargin(bytesParams)
      );
      const baseFee = this.flashbot.getMaxBaseFeeInFutureBlock();
      const { maxPriorityFee, remainingEth } = this.flashbot.getMaxPrioFees(
        ethAmountAfterInterest.toString()
      );
      const amountInWei = ethers.utils.parseEther(remainingEth.toString());
      const maxPriorityFeeInWei = ethers.utils.parseUnits(
        maxPriorityFee.toString(),
        "gwei"
      );

      // Calcul des frais totaux
      const deduction = maxPriorityFeeInWei.add(
        estimateGas.mul(baseFee.toString())
      );
      //  console.log(deduction.toString());
      const remainingAmountInWei = amountInWei.sub(deduction.toString());
      const profitNet = ethers.utils
        .formatEther(remainingAmountInWei)
        .toString();
      Logger.debug(`Initial quantity ETH: ${profit}`);
      Logger.debug(`Fees transaction: ${ethers.utils.formatEther(deduction)}`);
      Logger.debug(`Remaining ETH: ${ethers.utils.formatEther(deduction)}`);
      Logger.debug(`Net ETH profit: ${profitNet}`);
      if (profitNet > 0) {
        this.telegram.sendMessage(
          `Collection ${collectionName} is profitable for ~= ${profitNet} ETH`
        );
        Logger.info(
          `Collection ${collectionName} is profitable for ~= ${profitNet} ETH`
        );
        // const tx = await this.flashbot.createTx(bytesParams, estimateGasMargin);
        // await this.flashbot.signBundle(tx);
        // const isSimul = await this.flashbot.simulateBundle();
        // if (isSimul) await this.flashbot.sendBundle();
        // else Logger.trace("isSimulate => ", isSimul);
      } else Logger.warn(`Collection ${collectionName} is not profitable`);
    } catch (error) {
      Logger.error("isProfitableGas", error);
    }
  }

  async getParamsEncoding(exchangeToBuy, nft, collection, poolAddr, amm) {
    await sleep(1000);
    try {
      const exchangeClassic = await exchangeToBuy.getParams(
        nft.tokenId,
        collection
      );
      if (!exchangeClassic) return;
      const exchangeAmm = amm.getParams(poolAddr, [nft.tokenId]);

      const model = {
        encodeParams: {
          token: "address",
          amount: "uint256",
          collection: "address",
          exchangeClassic: "bytes",
          exchangeAmm: "bytes",
        },
      };

      const payload = {
        token: this.tokenLoan,
        amount: this.utils.convertToWei(`${nft.price}`).toString(),
        exchangeClassic,
        exchangeAmm,
        collection,
      };
      return this.utils.encodeAbi(model, payload);
    } catch (error) {
      return error;
    }
  }

  async manageProfit(difference, amm, collectionAddr, priceInEth) {
    const pools = await amm.getPoolInfos(collectionAddr, priceInEth);
    if (_.isEmpty(pools)) {
      Logger.debug(
        `POOL ON COLLECTION ${amm.collections[collectionAddr].name} IS EMPTY BECAUSE ANY POOLS HAVE CORRECT BALANCES`
      );
      return;
    }

    try {
      const bytesAllParams = await this.getParamsEncoding(
        exchangeToBuy,
        nfts[0],
        collectionAddr,
        pools[0].poolAddress,
        amm
      );

      if (!bytesAllParams) return false;

      return this.isProfitableGas(
        bytesAllParams,
        difference,
        amm.collections[collectionAddr].name
      );
    } catch (error) {
      return error;
    }
  }

  async comparePrices(nfts, amm, collectionAddr, exchangeToBuy) {
    const priceInEth = Number(
      this.utils.convertToEth(amm.collections[collectionAddr].sellQuote)
    );
    const difference = Number(priceInEth) - Number(nfts[0].price);
    Logger.trace(`Gross profit: ${Number(difference).toFixed(18)} ETH`);
    if (difference > 0) {
      try {
        Logger.info(
          `Maybe profitable arbitrage ${nfts[0].tokenId} on collection ${amm.collections[collectionAddr].name} buy on ${exchangeToBuy.exchange}: ${nfts[0].price} sell to ${amm.exchange}: ${priceInEth} DIFFERENCE: ${difference}`
        );
        await this.manageProfit(difference, amm, collectionAddr, priceInEth);
      } catch (error) {
        this.telegram.sendMessage(`ERROR: COMPARE PRICE ENCODING`);

        Logger.error("COMPARE PRICE ENCODING", error);
      }
    } else {
      Logger.fatal(
        `Not profitable arbitrage ${nfts[0].tokenId} on collection ${amm.collections[collectionAddr].name} buy on ${exchangeToBuy.exchange}: ${nfts[0].price} sell to ${amm.exchange}: ${priceInEth} DIFFERENCE: ${difference}`
      );
    }
  }

  async manageArbitrage({ amm, toCompare }) {
    try {
      await amm.getTrendingCollections(amm.collections);
      this.saveCollection = amm.collections;
      for await (const collectionAddr of Object.keys(amm.collections)) {
        for await (const exchange of toCompare) {
          await sleep(1000);
          const nfts = await exchange.getNftsOnCollection(
            collectionAddr,
            amm.collections[collectionAddr]
          );
          if (_.isEmpty(nfts))
            Logger.warn(
              `Collection ${amm.collections[collectionAddr].name} not found on ${exchange.exchange}`
            );
          else await this.comparePrices(nfts, amm, collectionAddr, exchange);
        }
      }
      Logger.info("Waiting for update...");
      await sleep(60000);

      this.manageArbitrage({ amm, toCompare });
    } catch (error) {
      this.telegram.sendMessage(`ERROR: Manage arbitrage`);
    }
  }

  async start() {
    Logger.trace("START ARBITRAGE");
    this.telegram.sendMessage(`Start arbitrage ${new Date()}`);
    this.exchanges.forEach((element) => {
      this.manageArbitrage(element);
    });
  }
}
