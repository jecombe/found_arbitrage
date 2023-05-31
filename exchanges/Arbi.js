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
import WebSocket from "ws";
const PONG = 0;
console.log("okokokok");
export default class {
  constructor(params) {
    this.tokenLoan = params.tokenLoan;
    this.addrFlashloan = params.addrFlashloan;
    this.amount = params.amount;
    this.utils = new Utils();
    this.telegram = new Telegram();
    this.config = this.createConfig(params);
    this.balance = null;
    this.ws = new WebSocket(
      "wss://stream.openseabeta.com/socket/websocket?token=dc917d8db4bf4a378a8fcf8a16500b90"
    );
    this.sudoswap = new Sudoswap(this.utils);
    this.opensea = new OpenSea(this.utils);
    this.flashbot = new Flashbot(this.config, this.utils, this.telegram);
  }

  subscribe() {
    return {
      topic: "collection:*",
      event: "phx_join",
      payload: {},
      ref: 2,
    };
  }

  ping() {
    return {
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: 0,
    };
  }

  async updateBalance() {
    try {
      this.balance = await this.getBalance();
      this.borrowable = await this.getEmpruntable();
    } catch (error) {
      Logger.error("updateBalance", error);
    }
  }

  async onOpen() {
    Logger.info(`🟢 Connected to WebSocket 🟢`);
    try {
      await this.updateBalance();
      this.ws.send(JSON.stringify(this.subscribe()));

      setInterval(() => {
        const heartbeatMessage = JSON.stringify(this.ping());
        this.ws.send(heartbeatMessage);
        Logger.trace(`PING`);
      }, 30000);
    } catch (error) {
      Logger.error("onOpen", erro);
    }
  }

  decryptMessage(data) {
    try {
      const message = data.toString();
      return JSON.parse(message);
    } catch (error) {
      return error;
    }
  }

  isPong(ref) {
    return ref === PONG;
  }

  comparePrice(json, getNftPoolCollection) {
    const openSeaPrice = Number(json.payload.payload.base_price);
    const sudoswapPrice = Number(getNftPoolCollection.offerNBT);

    return openSeaPrice - sudoswapPrice;
  }

  async searchPool(collectionAddr, price) {
    return this.sudoswap.getPoolData(collectionAddr, price);
  }

  async getParamsEncoding(tokenId, collection, poolAddr, amount) {
    //await sleep(1000);
    try {
      const exchangeClassic = await this.opensea.getParams(tokenId, collection);
      if (!exchangeClassic) return;
      const exchangeAmm = this.sudoswap.getParams(poolAddr, [tokenId]);

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
        amount,
        exchangeClassic,
        exchangeAmm,
        collection,
      };
      return this.utils.encodeAbi(model, payload);
    } catch (error) {
      return error;
    }
  }

  searchAdvantagePool(pools) {
    let objetMax = null;
    let valeurMax = -Infinity;

    for (let i = 0; i < pools.length; i++) {
      const objet = pools[i];
      const nombre = parseInt(objet.spotPrice);

      if (nombre > valeurMax) {
        valeurMax = nombre;
        objetMax = objet;
      }
    }

    return objetMax;
  }

  loggerIsProfitableGas(netProfit, nftOpensea) {
    this.telegram.sendMessage(
      `Collection ${
        nftOpensea.address
      } is profitable for ~= ${this.parseWeiToEth(netProfit)} ETH`
    );
    Logger.info(
      `Collection ${
        nftOpensea.address
      } is profitable for ~= ${this.parseWeiToEth(netProfit)} ETH`
    );
  }

  async isProfitableGas(bytesParams, profit, nftOpensea) {
    // calculate price gas and call flashloan cost
    try {
      const netProfit = await this.flashbot.manageEip1559(
        bytesParams,
        profit,
        nftOpensea.name
      );

      if (!netProfit) return;

      if (netProfit > 0) {
        Logger.trace("Net profit: ", this.parseWeiToEth(netProfit.toString()));
        this.loggerIsProfitableGas(netProfit, nftOpensea);
        const transac = await this.flashbot.tryTransaction(bytesParams);
        Logger.info("Transaction success full", transac);
        this.telegram.sendMessage("Transaction success full");
        await this.updateBalance();
      } else Logger.trace(`Collection ${nftOpensea.address} is not profitable`);
    } catch (error) {
      Logger.error("isProfitableGas", error);
    }
  }

  loggerManageProfitable(
    nftOpensea,
    advantagePool,
    profit,
    getNftPoolCollection
  ) {
    Logger.debug(
      `💸 NFT ${
        nftOpensea.name
      } 💸\n------------------------------------------\n 🖼️ Collection: ${
        nftOpensea.address
      } 🖼️\nTokenId: ${
        nftOpensea.tokenId
      }\n💰 Opensea price: ${this.parseWeiToEth(
        nftOpensea.price
      )}\n💰 Sudoswap price: ${this.parseWeiToEth(
        getNftPoolCollection.offerNBT
      )}\nDifference: ${this.parseWeiToEth(
        profit
      )}\n------------------------------------------\n 🏊‍♂️ Pool Sudoswap: ${
        advantagePool.address
      } 🏊‍♂️\n⚖️ Balance: ${advantagePool.balance}\n💰Spot price: ${
        advantagePool.spotPrice
      }\n Delta: ${advantagePool.delta}\nFees: ${advantagePool.fee}`
    );
  }

  async manageProfitable(nftOpensea, getNftPoolCollection, profit) {
    try {
      const pools = await this.searchPool(
        nftOpensea.address,
        getNftPoolCollection.offerNBT
      );
      if (_.isEmpty(pools)) {
        Logger.warn(`💸 NFT ${nftOpensea.name} 💸\n ⚠ Pool is empty ⚠`);
        return;
      }

      const advantagePool = this.searchAdvantagePool(pools);
      this.loggerManageProfitable(
        nftOpensea,
        advantagePool,
        profit,
        getNftPoolCollection
      );
      const bytesAllParams = await this.getParamsEncoding(
        nftOpensea.tokenId,
        nftOpensea.address,
        advantagePool.address,
        nftOpensea.price
      );

      if (!bytesAllParams) return null;

      this.isProfitableGas(bytesAllParams, profit, nftOpensea);
    } catch (error) {
      Logger.error("manageProfitable", error);
      return undefined;
    }
  }

  parseNftOpensea(json) {
    const { item } = json.payload.payload;

    const [, address, tokenId] = item.nft_id.split("/");
    return {
      name: item.metadata.name,
      address,
      tokenId,
      price: json.payload.payload.base_price,
    };
  }

  parseWeiToEth(wei) {
    return ethers.utils.formatEther(wei.toString());
  }

  async itemList(json) {
    const nftOpensea = this.parseNftOpensea(json);
    try {
      const ts = await this.sudoswap.getPriceSellCollection(nftOpensea.address);
      const res = await ts.json();

      const { getNftPoolCollection } = res.data;
      if (getNftPoolCollection !== null) {
        if (getNftPoolCollection.offerNBT) {
          const difference = this.comparePrice(json, getNftPoolCollection);
          if (difference > 0) {
            await this.manageProfitable(
              nftOpensea,
              getNftPoolCollection,
              difference
            );
          }
        }
      }
    } catch (error) {
      Logger.error(`🚨 NFT ${nftOpensea.name} 🚨\n`, error);
      return error;
    }
  }

  async onMessage(data) {
    try {
      const json = this.decryptMessage(data);

      if (this.isPong(data.ref)) retur;
      if (json.event === "item_listed") {
        await this.itemList(json);
      }
    } catch (error) {
      Logger.error(error);
      return error;
    }
  }

  startWs() {
    this.telegram.sendMessage(`Start server ${new Date()}`);

    this.ws.on("open", async () => {
      await this.onOpen();
    });

    this.ws.on("message", async (data) => {
      try {
        await this.onMessage(data);
      } catch (error) {
        console.log(error);
      }
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    this.ws.on("close", () => {
      Logger.fatal(`❗️WebSocket connection closed❗️\nTrying to reconnect...`);
      setTimeout(() => {
        this.startWs();
      }, 30000);
    });
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
        pools[0].address,
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

    if (nfts[0].price > this.borrowable) {
      Logger.fatal(
        `Not enough funds to purchase the collection ${
          amm.collections[collectionAddr].name
        }: \nbalance: ${ethers.utils.formatEther(
          this.balance
        )} ETH\npriceNft: ${nfts[0].price}\nborrowable: ${this.borrowable}`
      );
      return;
    }

    try {
      Logger.info(
        `🚨 Maybe profitable arbitrage ! 🚨\nNftId: ${nfts[0].tokenId}\nCollection ${amm.collections[collectionAddr].name}\n${exchangeToBuy.exchange} price: ${nfts[0].price} ETH\n${amm.exchange} price: ${priceInEth} ETH\nDifference: ${difference} ETH`
      );

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
      await sleep(30000);

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
