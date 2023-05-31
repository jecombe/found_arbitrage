import _ from "lodash";
import Sudoswap from "./amm/Sudoswap.js";
import OpenSea from "./classic/OpenSea.js";
import Logger from "../utils/Logger.js";
import Utils from "../utils/Utils.js";
import ethers from "ethers";
import os from "os";
import { spawn } from "child_process";
import { BigNumber } from "ethers";
import { createRequire } from "module";
import Flashbot from "./Flashbot.js";
import Telegram from "../utils/Telegram.js";
const require = createRequire(import.meta.url);
const artifactFlashloan = require("../artifacts/Flashloan.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import WebSocket from "ws";
const PONG = 0;
export default class {
  constructor(params) {
    this.tokenLoan = params.tokenLoan;
    this.addrFlashloan = params.addrFlashloan;
    this.amount = params.amount;
    this.utils = new Utils();
    this.config = this.createConfig(params);
    this.balance = null;
    this.flashloanFees = params.flashloanFees;

    this.sudoswap = new Sudoswap(this.utils);
    this.opensea = new OpenSea(this.utils);
    this.flashbot = new Flashbot(this.config, this.utils, this.telegram);
    this.telegram = new Telegram(this);
    this.executions = [];
    this.ping = { id: null, interval: 30000 };
    this.telegram.sendMessage(`Start server ${new Date()}`);
  }

  subscribe() {
    return {
      topic: "collection:*",
      event: "phx_join",
      payload: {},
      ref: 2,
    };
  }

  stop() {
    Logger.warn("User Stop");

    const command = spawn("stop arbitrage");
  }

  startPing() {
    const heartbeatMessage = JSON.stringify({
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: 0,
    });
    this.ping.id = setInterval(() => {
      Logger.trace(`PING`);
      this.ws.send(heartbeatMessage);
    }, this.ping.interval);
  }
  getEmpruntable() {
    // Taux de commission en décimal

    // Conversion de la balance en ETH

    // Calcul du montant empruntable en ETH
    return this.balance / (1 + this.flashloanFees);
  }

  async updateBalance() {
    try {
      this.balance = BigNumber.from(await this.getBalance());
      const borrow = this.getEmpruntable();
      this.borrowable = BigNumber.from(borrow.toString());
    } catch (error) {
      Logger.error("updateBalance", error);
    }
  }

  async onOpen() {
    Logger.info(`🟢 Connected to WebSocket 🟢`);
    try {
      await this.updateBalance();
      this.ws.send(JSON.stringify(this.subscribe()));
      this.startPing();
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

    return sudoswapPrice - openSeaPrice;
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
        this.executions.push({
          tokenId: nftOpensea.tokenId,
          address: nftOpensea.address,
          price: nftOpensea.price,
        });
        this.telegram.sendMessage("Transaction success full");
        await this.updateBalance();
      } else
        Logger.trace(
          `Collection ${nftOpensea.address} with tokenId: ${nftOpensea.tokenId} is not profitable`
        );
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
      )} ETH\n💰 Sudoswap price: ${this.parseWeiToEth(
        getNftPoolCollection.offerNBT
      )} ETH\nDifference: ${this.parseWeiToEth(
        profit
      )}\n------------------------------------------\n 🏊 Pool Sudoswap: ${
        advantagePool.address
      } 🏊\n⚖️ Balance: ${this.parseWeiToEth(
        advantagePool.balance
      )}\n💰Spot price: ${this.parseWeiToEth(
        advantagePool.spotPrice
      )} ETH\n📊 Delta: ${advantagePool.delta}\n📊 Fees: ${this.parseWeiToEth(
        advantagePool.fee
      )}\n------------------------------------------\n📝 Me: ${os.hostname()}\n⚖️ Balance: ${this.parseWeiToEth(
        this.balance
      )}\n📈 Borrowable amount: ${this.parseWeiToEth(this.borrowable)}`
    );
  }

  async manageProfitable(nftOpensea, getNftPoolCollection, profit) {
    try {
      const pools = await this.searchPool(
        nftOpensea.address,
        getNftPoolCollection.offerNBT
      );
      if (_.isEmpty(pools)) {
        Logger.warn(`❌ NFT ${nftOpensea.name} pool is empty ❌`);
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

  loggerEnoughFound(nftOpensea) {
    Logger.fatal(
      `🔔 Not enough funds to purchase the collection ${
        nftOpensea.address
      } 🔔\n⚖️ balance: ${this.parseWeiToEth(
        this.balance
      )} ETH\n💰 priceNft: ${this.parseWeiToEth(
        nftOpensea.price
      )}\n💰 borrowable: ${this.parseWeiToEth(this.borrowable)} ETH`
    );
  }

  async getPriceSudoswap(collectionAddr) {
    try {
      const ts = await this.sudoswap.getPriceSellCollection(collectionAddr);
      const res = await ts.json();

      if (!res || !res.data) return null;
      //if (res.data.getNftPoolCollection.offerNBT) return null;
      return res.data.getNftPoolCollection;
    } catch (error) {
      Logger.error("getPriceSudoswap", error);
      return null;
    }
  }

  async itemList(json) {
    const nftOpensea = this.parseNftOpensea(json);
    if (Number(nftOpensea.price) > this.borrowable) {
      return;
    }
    try {
      // const { getNftPoolCollection }
      const getNftPoolCollection = await this.getPriceSudoswap(
        nftOpensea.address
      );
      if (!getNftPoolCollection) return;

      if (getNftPoolCollection.offerNBT) {
        const difference = this.comparePrice(json, getNftPoolCollection);

        if (difference > 0) {
          await this.manageProfitable(
            nftOpensea,
            getNftPoolCollection,
            difference
          );
        } else {
          Logger.warn(
            `😩 Not profitable 😩\nCollection: ${
              nftOpensea.address
            }\nProfit: ${this.parseWeiToEth(difference)} ETH`
          );
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
    const date = new Date();

    Logger.info(`Start server ${date}`);

    this.ws = new WebSocket(
      `wss://stream.openseabeta.com/socket/websocket?token=${process.env.KEY_OPENSEA}`
    );
    this.ws.on("open", async () => {
      try {
        await this.onOpen();
      } catch (error) {
        Logger.error("onOpen ", error);
      }
    });

    this.ws.on("message", async (data) => {
      try {
        await this.onMessage(data);
        this.ws.close();
      } catch (error) {
        Logger.error("onMessage ", error);
      }
    });

    this.ws.on("error", (error) => {
      Logger.error("Error onError ", error);
    });

    this.ws.on("close", () => {
      Logger.fatal(
        `❗️ WebSocket connection closed ❗️ \nTrying to reconnect...`
      );
      clearInterval(this.ping.id);

      setTimeout(() => {
        console.log("reconnect");
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

  async getBalance() {
    return this.flashbot.contractFlashloan.methods.getBalance().call();
  }
}
