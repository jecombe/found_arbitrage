import opensea from "opensea-js";
import ethers from "ethers";
import dotenv from "dotenv";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
dotenv.config();
const factoryAbi = require("./Seaport.json");
import Web3 from "web3";
import axios from "axios";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default class {
  constructor(seaportAddress) {
    this.provider = new HDWalletProvider({
      mnemonic: {
        phrase: process.env.MEMO_PHRASES,
      },
      providerOrUrl: process.env.PROVIDER_MAINNET,
    });
    this.customHttpProvider = new ethers.providers.JsonRpcProvider(
      process.env.PROVIDER_MAINNET
    );

    this.wallet = new ethers.Wallet(
      process.env.SECRET_KEY,
      this.customHttpProvider
    );

    this.seaport = new opensea.OpenSeaPort(this.provider, {
      // networkName: opensea.Network.Goerli,
      networkName: opensea.Network.Main,

      apiKey: process.env.KEY_OPENSEA,
    });
    this.contractWithSigner = new ethers.Contract(
      seaportAddress,
      factoryAbi,
      this.wallet
    );
  }

  async getOrder(side, tokenId, assetContractAddress) {
    return this.seaport.api.getOrder({
      side,
      assetContractAddress,
      tokenId,
    });
  }

  createOrder(order) {
    const basicOrderParameters = {
      considerationToken: order.protocolData.parameters.consideration[0].token,
      considerationIdentifier: Number(ethers.BigNumber.from("0").toString()),
      considerationAmount: undefined,
      offerer: undefined,
      zone: order.protocolData.parameters.zone,
      offerToken: undefined,
      offerIdentifier: undefined,
      offerAmount: 1,
      basicOrderType: 0,
      startTime: undefined,
      endTime: undefined,
      zoneHash: order.protocolData.parameters.zoneHash,
      salt: undefined,
      offererConduitKey: order.protocolData.parameters.conduitKey,
      fulfillerConduitKey: order.protocolData.parameters.conduitKey,
      totalOriginalAdditionalRecipients: undefined,
      additionalRecipients: [],
      signature: undefined,
    };

    basicOrderParameters.offerer = ethers.utils.getAddress(order.maker.address);
    basicOrderParameters.offerToken =
      order.protocolData.parameters.offer[0].token;
    basicOrderParameters.offerIdentifier = ethers.BigNumber.from(
      order.protocolData.parameters.offer[0].identifierOrCriteria
    ).toString();
    basicOrderParameters.startTime = order.listingTime;
    basicOrderParameters.endTime = order.expirationTime;
    basicOrderParameters.salt = order.protocolData.parameters.salt;
    basicOrderParameters.totalOriginalAdditionalRecipients =
      order.protocolData.parameters.totalOriginalConsiderationItems - 1;
    basicOrderParameters.signature = order.protocolData.signature;
    for (let consider of order.protocolData.parameters.consideration) {
      if (consider.recipient === basicOrderParameters.offerer) {
        basicOrderParameters.considerationAmount = ethers.BigNumber.from(
          consider.startAmount
        ).toString();
        continue;
      }
      basicOrderParameters.additionalRecipients.push({
        amount: ethers.BigNumber.from(consider.startAmount).toString(),
        recipient: consider.recipient,
      });
    }

    return basicOrderParameters;
  }

  sendOrder(orderPayload, price) {
    return this.contractWithSigner.fulfillBasicOrder(orderPayload, {
      gasLimit: 300000,
      value: ethers.BigNumber.from(price),
    });
  }

  getSignature(order) {
    const payload = {
      orderHash: order.orderHash,
      protocol: order.protocolAddress,
      wallet: order.maker.address,
    };
    const options = {
      method: "POST",
      url: "https://api.opensea.io/v2/listings/fulfillment_data",
      headers: {
        "X-API-KEY": process.env.KEY_OPENSEA,
        "content-type": "application/json",
      },
      data: {
        listing: {
          hash: payload.orderHash,
          chain: "ethereum",
          protocol_address: payload.protocol,
        },
        fulfiller: { address: payload.wallet },
      },
    };

    return axios.request(options);
  }

  createOrder2(order, signature) {
    const basicOrderParameters = {
      considerationToken: order.consideration[0].token,
      considerationIdentifier: Number(ethers.BigNumber.from("0").toString()),
      considerationAmount: undefined,
      offerer: undefined,
      zone: order.zone,
      offerToken: undefined,
      offerIdentifier: undefined,
      offerAmount: 1,
      basicOrderType: 0,
      startTime: undefined,
      endTime: undefined,
      zoneHash: order.zoneHash,
      salt: undefined,
      offererConduitKey: order.conduitKey,
      fulfillerConduitKey: order.conduitKey,
      totalOriginalAdditionalRecipients: undefined,
      additionalRecipients: [],
      signature: undefined,
    };

    basicOrderParameters.offerer = ethers.utils.getAddress(order.offerer);

    basicOrderParameters.offerToken = order.offer[0].token;
    basicOrderParameters.offerIdentifier = ethers.BigNumber.from(
      order.offer[0].identifierOrCriteria
    ).toString();
    basicOrderParameters.startTime = order.startTime;
    basicOrderParameters.endTime = order.endTime;
    basicOrderParameters.salt = order.salt;
    basicOrderParameters.totalOriginalAdditionalRecipients =
      order.totalOriginalConsiderationItems - 1;
    basicOrderParameters.signature = signature;
    for (let consider of order.consideration) {
      if (
        consider.recipient.toUpperCase() ===
        basicOrderParameters.offerer.toUpperCase()
      ) {
        basicOrderParameters.considerationAmount = ethers.BigNumber.from(
          consider.startAmount
        ).toString();
        continue;
      }
      basicOrderParameters.additionalRecipients.push({
        amount: ethers.BigNumber.from(consider.startAmount).toString(),
        recipient: consider.recipient,
      });
    }

    return basicOrderParameters;
  }

  async buy(collectionAddr, tokenId) {
    try {
      const order = await this.getOrder("ask", tokenId, collectionAddr);
      await sleep(3000);
      const signature = await this.getSignature(order);
      const res = {
        basicOrderParameters: {
          considerationToken: "address",
          considerationIdentifier: "uint256",
          considerationAmount: "uint256",
          offerer: "address",
          zone: "address",
          offerToken: "address",
          offerIdentifier: "uint256",
          offerAmount: "uint256",
          basicOrderType: "uint8",
          startTime: "uint256",
          endTime: "uint256",
          zoneHash: "bytes32",
          salt: "uint256",
          offererConduitKey: "bytes32",
          fulfillerConduitKey: "bytes32",
          totalOriginalAdditionalRecipients: "uint256",
          "additionalRecipients[]": {
            amount: "uint256",
            recipient: "address",
          },
          signature: "bytes",
        },
      };
      const web3 = new Web3();
      const exchange = {
        pair: "0xe283ce6f85f74261d8964f791f30dacbfbe93ea9",
        nftIds: ["478"],
      };
      const payload = {
        PairSwapSpecific: {
          pair: "address",
          nftIds: "uint256[]",
        },
      };
      const exchangeClassic = web3.eth.abi.encodeParameter(
        res,
        signature.data.fulfillment_data.transaction.input_data.parameters
      );
      console.log("+++++++++++++", exchangeClassic, "++++++++++");

      const exchangeAmm = web3.eth.abi.encodeParameter(payload, exchange);
      console.log();

      console.log("____________", exchangeAmm, "_____________");
      const encodeParams = {
        encodeParams: {
          token: "address",
          amount: "uint256",
          collection: "address",
          exchangeClassic: "bytes",
          exchangeAmm: "bytes",
        },
      };
      console.log("VALUE ", signature.data.fulfillment_data.transaction.value);
      const payloads = {
        token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //"0xD0dF82dE051244f04BfF3A8bB1f62E1cD39eED92", //"0xCCB14936C2E000ED8393A571D15A2672537838Ad",
        amount: `${signature.data.fulfillment_data.transaction.value}`,
        collection: "0x3bfc3134645ebe0393f90d6a19bcb20bd732964f",
        exchangeClassic,
        exchangeAmm,
      };

      console.log("payload: ", exchange, payloads);

      const encode = web3.eth.abi.encodeParameter(encodeParams, payloads);
      console.log("-", encode, "-");
      console.log(signature.data.fulfillment_data.transaction.value);
    } catch (error) {
      console.log(error, "eeeeeeee");
    }
  }
}
