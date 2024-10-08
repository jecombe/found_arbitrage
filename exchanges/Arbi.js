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

    this.executions = [];
    this.ping = { id: null, interval: 30000 };
    this.timeout = { id: null, timeout: 3000 };
    this.telegram = new Telegram(this);
    this.flashbot = new Flashbot(this.config, this.utils, this.telegram);
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

  sendPing() {
    const heartbeatMessage = JSON.stringify({
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: 0,
    });
    this.ping.id = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        Logger.trace("send ping");
        this.ws.send(heartbeatMessage);
        // Définit un délai pour vérifier la réception de la réponse
        this.timeout.id = setTimeout(() => {
          if (this.ws.readyState === WebSocket.OPEN) {
            Logger.fatal(
              `💩 The response to the ping was not received within 2 seconds. (Close connexion) 💩`
            );
            this.ws.close();
          }
        }, this.timeout.timeout);
      }
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
      this.sendPing();
    } catch (error) {
      Logger.error("onOpen", error);
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
      Logger.trace("PAYLOAD ===> ", payload);
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
      } is profitable for ~= ${this.utils.parseWeiToEth(netProfit)} ETH`
    );
    Logger.info(
      `Collection ${
        nftOpensea.address
      } is profitable for ~= ${this.utils.parseWeiToEth(netProfit)} ETH`
    );
  }

  async isProfitableGas(bytesParams, profit, nftOpensea) {
    // calculate price gas and call flashloan cost
    try {
      const { remainingAmountWei, transactionCostWei } =
        await this.flashbot.manageEip1559(bytesParams, profit, nftOpensea);
      if (!remainingAmountWei) return;

      if (
        Number(ethers.utils.formatEther(transactionCostWei)) <
        Number(ethers.utils.formatEther(profit))
      ) {
        //if (remainingAmountWei > 0) {
        Logger.trace(
          "Net profit: ",
          this.utils.parseWeiToEth(remainingAmountWei.toString())
        );
        this.loggerIsProfitableGas(remainingAmountWei, nftOpensea);
        const transac = await this.flashbot.tryTransaction(bytesParams);

        this.executions.push({
          tokenId: nftOpensea.tokenId,
          address: nftOpensea.address,
          price: nftOpensea.price,
        });

        Logger.info(
          `💸Transaction success full 💸\nCollection: ${
            nftOpensea.address
          }\nName: ${nftOpen.name}\nId: ${
            nftOpensea.tokenId
          }\nProfit: ${this.utils.parseWeiToEth(
            remainingAmountWei.toString()
          )}`,
          transac
        );
        this.telegram.sendMessage(
          `💸Transaction success full 💸\nCollection: ${
            nftOpensea.address
          }\nName: ${nftOpen.name}\nId: ${
            nftOpensea.tokenId
          }\nProfit: ${this.utils.parseWeiToEth(remainingAmountWei.toString())}`
        );
        await this.updateBalance();
      } else
        Logger.trace(
          `😤 Not profitable 😤\nCollection ${nftOpensea.address}\nName: ${
            nftOpensea.name
          }\nTokenId: ${
            nftOpensea.tokenId
          }\nPrice Opensea: ${this.utils.parseWeiToEth(
            nftOpensea.price
          )}\nProfit: ${this.utils.parseWeiToEth(
            profit
          )}\nTransaction price: ${ethers.utils.formatEther(
            transactionCostWei
          )}\nBytes: ${bytesParams}`
        );
      this.telegram.sendMessage(
        `😤 Not profitable 😤\nCollection ${nftOpensea.address}\nName: ${
          nftOpensea.name
        }\nTokenId: ${
          nftOpensea.tokenId
        }\nPrice Opensea: ${this.utils.parseWeiToEth(
          nftOpensea.price
        )}\nProfit: ${this.utils.parseWeiToEth(
          profit
        )}\nTransaction price: ${ethers.utils.formatEther(transactionCostWei)}`
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
      }\n💰 Opensea price: ${this.utils.parseWeiToEth(
        nftOpensea.price
      )} ETH\n💰 Sudoswap price: ${this.utils.parseWeiToEth(
        getNftPoolCollection.offerNBT
      )} ETH\nDifference: ${this.utils.parseWeiToEth(
        profit
      )}\n------------------------------------------\n 🏊 Pool Sudoswap: ${
        advantagePool.address
      } 🏊\n⚖️ Balance: ${this.utils.parseWeiToEth(
        advantagePool.balance
      )}\n💰Spot price: ${this.utils.parseWeiToEth(
        advantagePool.spotPrice
      )} ETH\n📊 Delta: ${
        advantagePool.delta
      }\n📊 Fees: ${this.utils.parseWeiToEth(
        advantagePool.fee
      )}\n------------------------------------------\n📝 Me: ${os.hostname()}\n⚖️ Balance: ${this.utils.parseWeiToEth(
        this.balance
      )}\n📈 Borrowable amount: ${this.utils.parseWeiToEth(this.borrowable)}`
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

  loggerEnoughFound(nftOpensea, profit) {
    Logger.fatal(
      `🔔 Not enough funds to purchase the collection ${
        nftOpensea.address
      } 🔔\n⚖️ balance: ${this.utils.parseWeiToEth(
        this.balance
      )} ETH\n💰 priceNft: ${this.utils.parseWeiToEth(
        nftOpensea.price
      )}ETH\n💰 borrowable: ${this.utils.parseWeiToEth(
        this.borrowable
      )} ETH\nProfit: ${this.utils.parseWeiToEth(profit)}`
    );
  }

  async getPriceSudoswap(collectionAddr) {
    try {
      const ts = await this.sudoswap.getPriceSellCollection(collectionAddr);
      const res = await ts.json();

      if (!res || !res.data) return null;
      return res.data.getNftPoolCollection;
    } catch (error) {
      Logger.error("getPriceSudoswap", error);
      return null;
    }
  }

  async itemList(json) {
    const nftOpensea = this.parseNftOpensea(json);
    try {
      const getNftPoolCollection = await this.getPriceSudoswap(
        nftOpensea.address
      );
      if (!getNftPoolCollection) return;

      if (getNftPoolCollection.offerNBT) {
        const difference = this.comparePrice(json, getNftPoolCollection);

        if (difference > 0) {
          // if (Number(nftOpensea.price) > this.borrowable) {
          //   this.loggerEnoughFound(nftOpensea, difference);
          //   return;
          // }
          Logger.info("OpenseaWs: ", json.payload.payload);

          await this.manageProfitable(
            nftOpensea,
            getNftPoolCollection,
            difference
          );
        } else {
          Logger.warn(
            `😩 Not profitable 😩\nCollection: ${nftOpensea.address}\nName: ${
              nftOpensea.name
            }\nTokenId: ${
              nftOpensea.tokenId
            }\nPrice Opensea: ${this.utils.parseWeiToEth(
              nftOpensea.price
            )}\nPrice Sudoswap: ${this.utils.parseWeiToEth(
              getNftPoolCollection.offerNBT
            )}\nProfit: ${this.utils.parseWeiToEth(difference)} ETH`
          );
        }
      }
    } catch (error) {
      Logger.error(`🚨 NFT ${nftOpensea.name} 🚨\n`, error);
      return error;
    }
  }

  stopPong() {
    clearTimeout(this.timeout.id);
  }

  async onMessage(data) {
    try {
      const json = this.decryptMessage(data);

      if (this.isPong(json.ref)) {
        this.stopAll();
        this.sendPing();
        return;
      }
      if (json.event === "item_listed") {
        await this.itemList(json);
      }
    } catch (error) {
      Logger.error("onMessage", error);
      return error;
    }
  }
  stopPing() {
    clearInterval(this.ping.id);
  }

  stopAll() {
    this.stopPong();
    this.stopPing();
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
      this.stopAll();
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

  async getBalance() {
    return this.flashbot.contractFlashloan.methods.getBalance().call();
  }
}
