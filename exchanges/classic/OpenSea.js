import axios from 'axios';
import _ from 'lodash';
import opensea from 'opensea-js';

const headersTwo = {
    'authority': 'api.uniswap.org',
    'accept': '*/*',
    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': ' application/json',
    'origin': 'https://app.uniswap.org',
    'referer': 'https://app.uniswap.org/',
    'sec-ch-ua': "\"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"108\", \"Google Chrome\";v=\"108\"",
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': "macOS",
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
}
export default class {

    constructor(utils) {
        this.exchange = 'opensea';
        this.collections = {
            [this.exchange]: {}
        }
        this.utils = utils;

        this.seaport = new opensea.OpenSeaPort(this.utils.getProvider(), {
            networkName: opensea.Network.Main,
            apiKey: process.env.KEY_OPENSEA
        });
    }

 
    async request(url, data = {}, method, headers) {
        const opt = {
            url,
            data,
            method,
            headers
        };
        return axios(opt);
    }


    async getNftsOnCollection(collectionAddr) {

        const headers = {
            "content-type": "application/json",
            "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "Referer": "https://sudoswap.xyz/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        }
        const addr = collectionAddr.toLowerCase()
        const body = `{\"query\":\"\\n      {\\n        collection(id: \\\"${addr}\\\") {\\n          pairs(first: 900, skip: 0) {\\n    id\\n    collection {\\n      id\\n    }\\n    owner {\\n      id\\n    }\\n    token {\\n      id\\n      name\\n      symbol\\n      decimals\\n    }\\n    type\\n    assetRecipient\\n    bondingCurve\\n    delta\\n    fee\\n    spotPrice\\n    nftIds\\n    ethBalance\\n    tokenBalance\\n    ethVolume}\\n        }\\n      }\"}`;

        try {
            const rep = await this.request('https://api.thegraph.com/subgraphs/name/zeframlou/sudoswap', body, 'POST', headers)
            return rep.data.data.collection.pairs.reduce((acc, el) => {
                if (!_.isEmpty(el.nftIds)) {
                    acc.push({
                        ids: el.nftIds,
                        fee: el.fee,
                        spotPrice: el.spotPrice,
                        ownerId: el.owner.id
                    })
                }
                return acc;
            }, [])
        } catch (error) {
            return error;
        }
    }

    async getNftProfitable(){

    }

    async getNftsOnCollection(collection) {
        const option = `{\"operationName\":\"Asset\",\"variables\":{\"orderBy\":\"PRICE\",\"asc\":true,\"filter\":{\"listed\":true,\"marketplaces\":[\"OPENSEA\"],\"tokenSearchQuery\":\"\"},\"first\":25,\"address\":\"${collection.toLowerCase()}\"},\"query\":\"query Asset($address: String!, $orderBy: NftAssetSortableField, $asc: Boolean, $filter: NftAssetsFilterInput, $first: Int, $after: String, $last: Int, $before: String) {\\n  nftAssets(\\n    address: $address\\n    orderBy: $orderBy\\n    asc: $asc\\n    filter: $filter\\n    first: $first\\n    after: $after\\n    last: $last\\n    before: $before\\n  ) {\\n    edges {\\n      node {\\n        id\\n        name\\n        ownerAddress\\n        image {\\n          url\\n          __typename\\n        }\\n        smallImage {\\n          url\\n          __typename\\n        }\\n        originalImage {\\n          url\\n          __typename\\n        }\\n        tokenId\\n        description\\n        animationUrl\\n        suspiciousFlag\\n        collection {\\n          name\\n          isVerified\\n          image {\\n            url\\n            __typename\\n          }\\n          creator {\\n            address\\n            profileImage {\\n              url\\n              __typename\\n            }\\n            isVerified\\n            __typename\\n          }\\n          nftContracts {\\n            address\\n            standard\\n            __typename\\n          }\\n          __typename\\n        }\\n        listings(first: 1) {\\n          edges {\\n            node {\\n              address\\n              createdAt\\n              endAt\\n              id\\n              maker\\n              marketplace\\n              marketplaceUrl\\n              orderHash\\n              price {\\n                currency\\n                value\\n                __typename\\n              }\\n              quantity\\n              startAt\\n              status\\n              taker\\n              tokenId\\n              type\\n              protocolParameters\\n              __typename\\n            }\\n            cursor\\n            __typename\\n          }\\n          __typename\\n        }\\n        rarities {\\n          provider\\n          rank\\n          score\\n          __typename\\n        }\\n        metadataUrl\\n        __typename\\n      }\\n      cursor\\n      __typename\\n    }\\n    totalCount\\n    pageInfo {\\n      endCursor\\n      hasNextPage\\n      hasPreviousPage\\n      startCursor\\n      __typename\\n    }\\n    __typename\\n  }\\n}\"}`;

        const test = await this.request('https://api.uniswap.org/v1/graphql', option, "POST", headersTwo)
        return test.data.data.nftAssets.edges.reduce((acc, el) => {
                acc.push({
                    tokenId: el.node.tokenId,
                    id: el.node.id,
                    price: el.node.listings.edges[0].node.price.value
                })
            return acc;
        }, []);

    }

    createOrder(order) {
        const basicOrderParameters = {
            considerationToken: order.protocolData.parameters.consideration[0].token,
            considerationIdentifier: Number(this.utils.getBigNumber('0')),
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
            signature: undefined
        }

        basicOrderParameters.offerer = this.utils.getAddr(order.maker.address);
        basicOrderParameters.offerToken = order.protocolData.parameters.offer[0].token;
        basicOrderParameters.offerIdentifier = this.utils.getBigNumber(order.protocolData.parameters.offer[0].identifierOrCriteria);
        basicOrderParameters.startTime = order.listingTime;
        basicOrderParameters.endTime = order.expirationTime;
        basicOrderParameters.salt = order.protocolData.parameters.salt;
        basicOrderParameters.totalOriginalAdditionalRecipients = order.protocolData.parameters.totalOriginalConsiderationItems - 1
        basicOrderParameters.signature = order.protocolData.signature;
        for (let consider of order.protocolData.parameters.consideration) {
            if (consider.recipient === basicOrderParameters.offerer) {
                basicOrderParameters.considerationAmount = this.utils.getBigNumber(consider.startAmount);
                continue;
            }
             basicOrderParameters.additionalRecipients.push({
                  amount: this.utils.getBigNumber(consider.startAmount),
                  recipient: consider.recipient
              },
              );
        }

        return basicOrderParameters;
    }

    getSignature(order) {
        const payload = {
            orderHash: order.orderHash,
            protocol: order.protocolAddress,
            wallet: order.maker.address
        }
        const options = {
            method: 'POST',
            url: 'https://api.opensea.io/v2/listings/fulfillment_data',
            headers: {
                'X-API-KEY': process.env.KEY_OPENSEA,
                'content-type': 'application/json'
            },
            data: {
                listing: {
                    hash: payload.orderHash,
                    chain: 'ethereum',
                    protocol_address: payload.protocol
                },
                fulfiller: { address: payload.wallet }
            }
        };

        return axios
            .request(options)

    }

    async getOrder(side, tokenId, assetContractAddress) {

        return this.seaport.api.getOrder({
            side,
            assetContractAddress,
            tokenId,
        })
    }


    async getParams(tokenId, collectionAddr) {
        const order = await this.getOrder('ask', tokenId, collectionAddr)
        
       const orderPayload = this.createOrder(order)
       const signature = await this.getSignature(order);
       const sg = signature.data.fulfillment_data.transaction.input_data.parameters.signature;

       orderPayload.signature = sg;
        const model =
        {
            "basicOrderParameters": {
                "considerationToken": 'address',
                "considerationIdentifier": 'uint256',
                "considerationAmount": 'uint256',
                "offerer": 'address',
                "zone": 'address',
                "offerToken": 'address',
                "offerIdentifier": 'uint256',
                "offerAmount": 'uint256',
                "basicOrderType": 'uint8',
                "startTime": 'uint256',
                "endTime": 'uint256',
                "zoneHash": 'bytes32',
                "salt": 'uint256',
                "offererConduitKey": 'bytes32',
                "fulfillerConduitKey": 'bytes32',
                "totalOriginalAdditionalRecipients": 'uint256',
                "additionalRecipients[]": {
                    "amount": "uint256",
                    "recipient": "address"
                },
                "signature": 'bytes'
            }
        };
    return this.utils.encodeAbi(model, orderPayload)
    }


}