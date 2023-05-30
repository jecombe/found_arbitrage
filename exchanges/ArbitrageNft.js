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

export default class {
  constructor(params) {
    this.tokenLoan = params.tokenLoan;
    this.addrFlashloan = params.addrFlashloan;
    this.amount = params.amount;
    this.utils = new Utils();
    this.telegram = new Telegram();
    this.config = this.createConfig(params);
    this.balance = null;
    this.flashloanFees = params.flashloanFees;
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

  async isProfitableGas(bytesParams, profit, collectionName) {
    // calculate price gas and call flashloan cost
    try {
      const netProfit = await this.flashbot.manageEip1559(
        bytesParams,
        profit,
        collectionName
      );

      Logger.debug("Net profit: ", netProfit.toString());

      if (netProfit > 0) {
        this.telegram.sendMessage(
          `Collection ${collectionName} is profitable for ~= ${netProfit} ETH`
        );
        Logger.info(
          `Collection ${collectionName} is profitable for ~= ${netProfit} ETH`
        );
        await this.flashbot.tryTransaction(bytesParams);
      } else Logger.trace(`Collection ${collectionName} is not profitable`);
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

  async manageProfit(
    difference,
    amm,
    collectionAddr,
    priceInEth,
    exchangeToBuy,
    nfts
  ) {
    try {
      const pools = await amm.getPoolInfos(collectionAddr, priceInEth);
      if (_.isEmpty(pools)) {
        Logger.debug(
          `POOL ON COLLECTION ${amm.collections[collectionAddr].name} IS EMPTY BECAUSE ANY POOLS HAVE CORRECT BALANCES`
        );
        return;
      }

      const bytesAllParams = await this.getParamsEncoding(
        exchangeToBuy,
        nfts[0],
        collectionAddr,
        pools[0].poolAddress,
        amm
      );
      console.log(bytesAllParams);

      if (!bytesAllParams) return false;

      return this.isProfitableGas(
        bytesAllParams,
        difference,
        amm.collections[collectionAddr].name
      );
    } catch (error) {
      Logger.error("manageProfit", error);
      return error;
    }
  }

  async getEmpruntable() {
    // Taux de commission en décimal

    // Conversion de la balance en ETH
    const balanceEth = ethers.utils.formatEther(this.balance);

    // Calcul du montant empruntable en ETH
    return parseFloat(balanceEth) / (1 + this.flashloanFees);
  }

  async comparePrices(nfts, amm, collectionAddr, exchangeToBuy) {
    const priceInEth = Number(
      this.utils.convertToEth(amm.collections[collectionAddr].sellQuote)
    );
    const difference = Number(priceInEth) - Number(nfts[0].price);
    Logger.trace(`Gross profit: ${Number(difference).toFixed(18)} ETH`);
    // if (difference > 0) {
    try {
      Logger.info(
        `Maybe profitable arbitrage ${nfts[0].tokenId} on collection ${amm.collections[collectionAddr].name} buy on ${exchangeToBuy.exchange}: ${nfts[0].price} sell to ${amm.exchange}: ${priceInEth} DIFFERENCE: ${difference}`
      );
      if (nfts[0].price > this.borrowable) {
        Logger.fatal(`priceInEth > this.borrowable ${this.borrowable}`);
        return;
      }
      await this.manageProfit(
        difference,
        amm,
        collectionAddr,
        priceInEth,
        exchangeToBuy,
        nfts
      );
    } catch (error) {
      this.telegram.sendMessage(`ERROR: COMPARE PRICE ENCODING`);

      Logger.error("COMPARE PRICE ENCODING", error);
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

  async getBalance() {
    return this.flashbot.contractFlashloan.methods.getBalance().call();
  }

  async start() {
    Logger.trace("START ARBITRAGE");
    this.balance = await this.getBalance();
    this.borrowable = await this.getEmpruntable();
    this.telegram.sendMessage(`Start arbitrage ${new Date()}`);
    this.exchanges.forEach((element) => {
      this.manageArbitrage(element);
    });
  }
}
