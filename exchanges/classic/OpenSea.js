import axios from "axios";
import _ from "lodash";
import opensea from "opensea-js";
import Logger from "../../utils/Logger.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default class {
  constructor(utils) {
    this.exchange = "opensea";
    this.collections = {
      [this.exchange]: {},
    };
    this.utils = utils;
    this.array = [];

    this.seaport = new opensea.OpenSeaPort(this.utils.getProvider(), {
      networkName: opensea.Network.Main,
      apiKey: process.env.KEY_OPENSEA,
    });
    this.nfts = [];
  }

  async request(url, data = {}, method, headers) {
    const opt = {
      url,
      data,
      method,
      headers,
    };
    return axios(opt);
  }

  async getSlugCollection(addr) {
    try {
      const headers = {
        "X-API-KEY": process.env.KEY_OPENSEA,
        accept: "application/json",
      };
      const data = {};
      const rep = await this.request(
        `https://api.opensea.io/api/v1/asset_contract/${addr}`,
        data,
        "GET",
        headers
      );
      return rep.data.collection.slug;
    } catch (error) {
      Logger.error("getSlugCollection", error);
      return null;
    }
  }

  async callCollection(slugCollection) {
    const options = {
      method: "POST",
      url: "https://opensea-graphql-api.p.rapidapi.com/",
      headers: {
        "content-type": "application/json",
        "x-signed-query": process.env.RAPID_SIGNED_QUERY,
        "X-RapidAPI-Key": process.env.RAPID_API_KEY,
        "X-RapidAPI-Host": "opensea-graphql-api.p.rapidapi.com",
      },
      data: {
        id: "CollectionAssetSearchListPaginationQuery",
        query:
          "query CollectionAssetSearchListPaginationQuery(\n  $collections: [CollectionSlug!]\n  $count: Int!\n  $cursor: String\n  $numericTraits: [TraitRangeType!]\n  $owner: IdentityInputType\n  $paymentAssets: [PaymentAssetSymbol]\n  $priceFilter: PriceFilterType\n  $query: String\n  $rarityFilter: RarityFilterType\n  $resultModel: SearchResultModel\n  $safelistRequestStatuses: [SafelistRequestStatus!]\n  $shouldShowBestBid: Boolean!\n  $sortAscending: Boolean\n  $sortBy: SearchSortBy\n  $stringTraits: [TraitInputType!]\n  $toggles: [SearchToggle!]\n) {\n  ...CollectionAssetSearchListPagination_data_Hf2eP\n}\n\nfragment AccountLink_data on AccountType {\n  address\n  config\n  isCompromised\n  user {\n    publicUsername\n    id\n  }\n  displayName\n  ...ProfileImage_data\n  ...wallet_accountKey\n  ...accounts_url\n}\n\nfragment AddToCartAndQuickBuyButton_order on OrderV2Type {\n  ...useIsQuickBuyEnabled_order\n  ...ItemAddToCartButton_order\n  ...QuickBuyButton_order\n}\n\nfragment AssetContextMenu_data on AssetType {\n  relayId\n}\n\nfragment AssetMediaAnimation_asset on AssetType {\n  ...AssetMediaImage_asset\n  ...AssetMediaContainer_asset\n  ...AssetMediaPlaceholderImage_asset\n}\n\nfragment AssetMediaAudio_asset on AssetType {\n  backgroundColor\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMediaContainer_asset on AssetType {\n  backgroundColor\n  ...AssetMediaEditions_asset_1mZMwQ\n  collection {\n    ...useIsRarityEnabled_collection\n    id\n  }\n}\n\nfragment AssetMediaContainer_asset_1LNk0S on AssetType {\n  backgroundColor\n  ...AssetMediaEditions_asset_1mZMwQ\n  collection {\n    ...useIsRarityEnabled_collection\n    id\n  }\n}\n\nfragment AssetMediaContainer_asset_4a3mm5 on AssetType {\n  backgroundColor\n  ...AssetMediaEditions_asset_1mZMwQ\n  defaultRarityData {\n    ...RarityIndicator_data\n    id\n  }\n  collection {\n    ...useIsRarityEnabled_collection\n    id\n  }\n}\n\nfragment AssetMediaEditions_asset_1mZMwQ on AssetType {\n  decimals\n}\n\nfragment AssetMediaImage_asset on AssetType {\n  backgroundColor\n  imageUrl\n  collection {\n    displayData {\n      cardDisplayStyle\n    }\n    id\n  }\n}\n\nfragment AssetMediaPlaceholderImage_asset on AssetType {\n  collection {\n    displayData {\n      cardDisplayStyle\n    }\n    id\n  }\n}\n\nfragment AssetMediaVideo_asset on AssetType {\n  backgroundColor\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMediaWebgl_asset on AssetType {\n  backgroundColor\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMedia_asset on AssetType {\n  animationUrl\n  displayImageUrl\n  imageUrl\n  isDelisted\n  ...AssetMediaAnimation_asset\n  ...AssetMediaAudio_asset\n  ...AssetMediaContainer_asset_1LNk0S\n  ...AssetMediaImage_asset\n  ...AssetMediaPlaceholderImage_asset\n  ...AssetMediaVideo_asset\n  ...AssetMediaWebgl_asset\n}\n\nfragment AssetMedia_asset_1mZMwQ on AssetType {\n  animationUrl\n  displayImageUrl\n  imageUrl\n  isDelisted\n  ...AssetMediaAnimation_asset\n  ...AssetMediaAudio_asset\n  ...AssetMediaContainer_asset_1LNk0S\n  ...AssetMediaImage_asset\n  ...AssetMediaPlaceholderImage_asset\n  ...AssetMediaVideo_asset\n  ...AssetMediaWebgl_asset\n}\n\nfragment AssetMedia_asset_5MxNd on AssetType {\n  animationUrl\n  displayImageUrl\n  imageUrl\n  isDelisted\n  ...AssetMediaAnimation_asset\n  ...AssetMediaAudio_asset\n  ...AssetMediaContainer_asset_4a3mm5\n  ...AssetMediaImage_asset\n  ...AssetMediaPlaceholderImage_asset\n  ...AssetMediaVideo_asset\n  ...AssetMediaWebgl_asset\n}\n\nfragment AssetQuantity_data on AssetQuantityType {\n  asset {\n    ...Price_data\n    id\n  }\n  quantity\n}\n\nfragment AssetSearchListViewTableAssetInfo_item on ItemType {\n  __isItemType: __typename\n  __typename\n  ...PortfolioTableItemCellTooltip_item\n}\n\nfragment AssetSearchListViewTableQuickBuy_order on OrderV2Type {\n  maker {\n    address\n    id\n  }\n  item {\n    __typename\n    chain {\n      identifier\n    }\n    ...itemEvents_dataV2\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  openedAt\n  relayId\n}\n\nfragment AssetSearchList_data_4hkUTB on ItemType {\n  __isItemType: __typename\n  __typename\n  relayId\n  ...ItemCard_data_7UBUA\n  ... on AssetType {\n    collection {\n      isVerified\n      relayId\n      id\n    }\n  }\n  ... on AssetBundleType {\n    bundleCollection: collection {\n      isVerified\n      relayId\n      id\n    }\n  }\n  chain {\n    identifier\n  }\n  ...useAssetSelectionStorage_item_21vFPh\n}\n\nfragment BulkPurchaseModal_orders on OrderV2Type {\n  relayId\n  item {\n    __typename\n    relayId\n    chain {\n      identifier\n    }\n    ... on AssetType {\n      collection {\n        slug\n        isSafelisted\n        id\n      }\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  payment {\n    relayId\n    symbol\n    id\n  }\n  ...useTotalPrice_orders\n  ...useFulfillingListingsWillReactivateOrders_orders\n}\n\nfragment CollectionAssetSearchListPagination_data_Hf2eP on Query {\n  queriedAt\n  collectionItems(first: $count, after: $cursor, collections: $collections, numericTraits: $numericTraits, paymentAssets: $paymentAssets, priceFilter: $priceFilter, querystring: $query, rarityFilter: $rarityFilter, resultType: $resultModel, safelistRequestStatuses: $safelistRequestStatuses, sortAscending: $sortAscending, sortBy: $sortBy, stringTraits: $stringTraits, toggles: $toggles, owner: $owner, prioritizeBuyNow: true) {\n    edges {\n      node {\n        __typename\n        ...readItemHasBestAsk_item\n        ...AssetSearchList_data_4hkUTB\n        ...useGetEligibleItemsForSweep_items\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      cursor\n    }\n    totalCount\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment CollectionLink_assetContract on AssetContractType {\n  address\n  blockExplorerLink\n}\n\nfragment CollectionLink_collection on CollectionType {\n  name\n  slug\n  verificationStatus\n  ...collection_url\n}\n\nfragment CollectionTrackingContext_collection on CollectionType {\n  relayId\n  slug\n  isVerified\n  isCollectionOffersEnabled\n  defaultChain {\n    identifier\n  }\n}\n\nfragment CreateListingButton_item on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    ...CreateQuickSingleListingFlowModal_asset\n  }\n  ...itemEvents_dataV2\n  ...item_sellUrl\n}\n\nfragment CreateQuickSingleListingFlowModal_asset on AssetType {\n  relayId\n  chain {\n    identifier\n  }\n  ...itemEvents_dataV2\n}\n\nfragment EditListingButton_item on ItemType {\n  __isItemType: __typename\n  chain {\n    identifier\n  }\n  ...EditListingModal_item\n  ...itemEvents_dataV2\n}\n\nfragment EditListingButton_listing on OrderV2Type {\n  ...EditListingModal_listing\n}\n\nfragment EditListingModal_item on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    tokenId\n    assetContract {\n      address\n      id\n    }\n    chain {\n      identifier\n    }\n  }\n  ... on AssetBundleType {\n    slug\n  }\n}\n\nfragment EditListingModal_listing on OrderV2Type {\n  relayId\n}\n\nfragment ItemAddToCartButton_order on OrderV2Type {\n  maker {\n    address\n    id\n  }\n  item {\n    __typename\n    ... on AssetType {\n      isCurrentlyFungible\n    }\n    ...itemEvents_dataV2\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  openedAt\n  ...ShoppingCartContextProvider_inline_order\n}\n\nfragment ItemCardContent on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    relayId\n    name\n    ...AssetMedia_asset_1mZMwQ\n  }\n  ... on AssetBundleType {\n    assetQuantities(first: 18) {\n      edges {\n        node {\n          asset {\n            relayId\n            ...AssetMedia_asset\n            id\n          }\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment ItemCardContent_1mZMwQ on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    relayId\n    name\n    ...AssetMedia_asset_1mZMwQ\n  }\n  ... on AssetBundleType {\n    assetQuantities(first: 18) {\n      edges {\n        node {\n          asset {\n            relayId\n            ...AssetMedia_asset\n            id\n          }\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment ItemCardCta_item_2qvZ6X on ItemType {\n  __isItemType: __typename\n  __typename\n  orderData {\n    bestAskV2 {\n      ...AddToCartAndQuickBuyButton_order\n      ...EditListingButton_listing\n      ...QuickBuyButton_order\n      id\n    }\n  }\n  ...useItemCardCta_item_2qvZ6X\n  ...itemEvents_dataV2\n  ...CreateListingButton_item\n  ...EditListingButton_item\n}\n\nfragment ItemCardFooter_4D95uP on ItemType {\n  __isItemType: __typename\n  __typename\n  relayId\n  name\n  orderData {\n    bestBidV2 {\n      orderType\n      priceType {\n        unit\n      }\n      ...ItemCardPrice_data\n      id\n    }\n    bestAskV2 {\n      orderType\n      priceType {\n        unit\n      }\n      maker {\n        address\n        id\n      }\n      ...ItemCardPrice_data\n      id\n      ...ItemAddToCartButton_order\n      ...AssetSearchListViewTableQuickBuy_order\n      ...useIsQuickBuyEnabled_order\n    }\n  }\n  ...ItemMetadata_4hkUTB\n  ... on AssetType {\n    tokenId\n    isDelisted\n    defaultRarityData {\n      ...RarityIndicator_data\n      id\n    }\n    collection {\n      slug\n      name\n      isVerified\n      ...collection_url\n      ...useIsRarityEnabled_collection\n      id\n    }\n    largestOwner {\n      owner {\n        ...AccountLink_data\n        id\n      }\n      id\n    }\n    ...AssetSearchListViewTableAssetInfo_item\n  }\n  ... on AssetBundleType {\n    bundleCollection: collection {\n      slug\n      name\n      isVerified\n      ...collection_url\n      ...useIsRarityEnabled_collection\n      id\n    }\n  }\n  ...useItemCardCta_item_2qvZ6X\n  ...item_url\n  ...ItemCardContent\n}\n\nfragment ItemCardPrice_data on OrderV2Type {\n  perUnitPriceType {\n    unit\n  }\n  dutchAuctionFinalPriceType {\n    unit\n  }\n  openedAt\n  closedAt\n  payment {\n    symbol\n    id\n  }\n  ...useIsQuickBuyEnabled_order\n}\n\nfragment ItemCard_data_7UBUA on ItemType {\n  __isItemType: __typename\n  __typename\n  relayId\n  chain {\n    identifier\n  }\n  orderData {\n    bestAskV2 {\n      priceType {\n        eth\n      }\n      id\n    }\n  }\n  ... on AssetType {\n    isDelisted\n    totalQuantity\n    collection {\n      slug\n      ...CollectionTrackingContext_collection\n      id\n    }\n    ...itemEvents_data\n  }\n  ... on AssetBundleType {\n    bundleCollection: collection {\n      slug\n      ...CollectionTrackingContext_collection\n      id\n    }\n  }\n  ...ItemCardContent_1mZMwQ\n  ...ItemCardFooter_4D95uP\n  ...ItemCardCta_item_2qvZ6X\n  ...item_url\n  ...ItemTrackingContext_item\n}\n\nfragment ItemMetadata_4hkUTB on ItemType {\n  __isItemType: __typename\n  __typename\n  orderData {\n    bestAskV2 {\n      openedAt\n      createdDate\n      closedAt\n      id\n    }\n  }\n  assetEventData {\n    lastSale {\n      unitPriceQuantity {\n        ...AssetQuantity_data\n        quantity\n        asset {\n          symbol\n          decimals\n          id\n        }\n        id\n      }\n    }\n  }\n  ... on AssetType {\n    bestAllTypeBid @include(if: $shouldShowBestBid) {\n      perUnitPriceType {\n        unit\n        symbol\n      }\n      id\n    }\n    mintEvent @include(if: $shouldShowBestBid) {\n      perUnitPrice {\n        unit\n        symbol\n      }\n      id\n    }\n  }\n}\n\nfragment ItemTrackingContext_item on ItemType {\n  __isItemType: __typename\n  relayId\n  chain {\n    identifier\n  }\n  ... on AssetType {\n    tokenId\n    assetContract {\n      address\n      id\n    }\n  }\n  ... on AssetBundleType {\n    slug\n  }\n}\n\nfragment OrderListItem_order on OrderV2Type {\n  relayId\n  makerOwnedQuantity\n  item {\n    __typename\n    displayName\n    ... on AssetType {\n      assetContract {\n        ...CollectionLink_assetContract\n        id\n      }\n      collection {\n        ...CollectionLink_collection\n        id\n      }\n      ...AssetMedia_asset\n      ...asset_url\n      ...useItemFees_item\n    }\n    ... on AssetBundleType {\n      assetQuantities(first: 30) {\n        edges {\n          node {\n            asset {\n              displayName\n              relayId\n              assetContract {\n                ...CollectionLink_assetContract\n                id\n              }\n              collection {\n                ...CollectionLink_collection\n                id\n              }\n              ...StackedAssetMedia_assets\n              ...AssetMedia_asset\n              ...asset_url\n              id\n            }\n            id\n          }\n        }\n      }\n    }\n    ...itemEvents_dataV2\n    ...useIsItemSafelisted_item\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  remainingQuantityType\n  ...OrderPrice\n}\n\nfragment OrderList_orders on OrderV2Type {\n  item {\n    __typename\n    ... on AssetType {\n      __typename\n      relayId\n    }\n    ... on AssetBundleType {\n      __typename\n      assetQuantities(first: 30) {\n        edges {\n          node {\n            asset {\n              relayId\n              id\n            }\n            id\n          }\n        }\n      }\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  relayId\n  ...OrderListItem_order\n  ...useFulfillingListingsWillReactivateOrders_orders\n}\n\nfragment OrderPrice on OrderV2Type {\n  priceType {\n    unit\n  }\n  perUnitPriceType {\n    unit\n  }\n  dutchAuctionFinalPriceType {\n    unit\n  }\n  openedAt\n  closedAt\n  payment {\n    ...TokenPricePayment\n    id\n  }\n}\n\nfragment PortfolioTableItemCellTooltip_item on ItemType {\n  __isItemType: __typename\n  __typename\n  ...AssetMedia_asset_5MxNd\n  ...PortfolioTableTraitTable_asset\n  ...asset_url\n}\n\nfragment PortfolioTableTraitTable_asset on AssetType {\n  assetContract {\n    address\n    chain\n    id\n  }\n  isCurrentlyFungible\n  tokenId\n}\n\nfragment Price_data on AssetType {\n  decimals\n  symbol\n  usdSpotPrice\n}\n\nfragment ProfileImage_data on AccountType {\n  imageUrl\n}\n\nfragment QuickBuyButton_order on OrderV2Type {\n  maker {\n    address\n    id\n  }\n  item {\n    __typename\n    chain {\n      identifier\n    }\n    ...itemEvents_dataV2\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  openedAt\n  relayId\n}\n\nfragment RarityIndicator_data on RarityDataType {\n  rank\n  rankPercentile\n  rankCount\n  maxRank\n}\n\nfragment ShoppingCartContextProvider_inline_order on OrderV2Type {\n  relayId\n  makerOwnedQuantity\n  item {\n    __typename\n    chain {\n      identifier\n    }\n    relayId\n    ... on AssetBundleType {\n      assetQuantities(first: 30) {\n        edges {\n          node {\n            asset {\n              relayId\n              id\n            }\n            id\n          }\n        }\n      }\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  maker {\n    relayId\n    id\n  }\n  priceType {\n    usd\n  }\n  payment {\n    relayId\n    id\n  }\n  remainingQuantityType\n  ...useTotalItems_orders\n  ...ShoppingCart_orders\n}\n\nfragment ShoppingCartDetailedView_orders on OrderV2Type {\n  relayId\n  item {\n    __typename\n    chain {\n      identifier\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  supportsGiftingOnPurchase\n  ...useTotalPrice_orders\n  ...OrderList_orders\n}\n\nfragment ShoppingCart_orders on OrderV2Type {\n  ...ShoppingCartDetailedView_orders\n  ...BulkPurchaseModal_orders\n}\n\nfragment StackedAssetMedia_assets on AssetType {\n  relayId\n  ...AssetMedia_asset\n  collection {\n    logo\n    id\n  }\n}\n\nfragment SweepContextProvider_items on ItemType {\n  __isItemType: __typename\n  relayId\n  orderData {\n    bestAskV2 {\n      relayId\n      payment {\n        symbol\n        id\n      }\n      perUnitPriceType {\n        unit\n      }\n      ...BulkPurchaseModal_orders\n      ...useTotalPrice_orders\n      id\n    }\n  }\n}\n\nfragment TokenPricePayment on PaymentAssetType {\n  symbol\n}\n\nfragment accounts_url on AccountType {\n  address\n  user {\n    publicUsername\n    id\n  }\n}\n\nfragment asset_url on AssetType {\n  assetContract {\n    address\n    id\n  }\n  tokenId\n  chain {\n    identifier\n  }\n}\n\nfragment bundle_url on AssetBundleType {\n  slug\n  chain {\n    identifier\n  }\n}\n\nfragment collection_url on CollectionType {\n  slug\n  isCategory\n}\n\nfragment itemEvents_data on AssetType {\n  relayId\n  assetContract {\n    address\n    id\n  }\n  tokenId\n  chain {\n    identifier\n  }\n}\n\nfragment itemEvents_dataV2 on ItemType {\n  __isItemType: __typename\n  relayId\n  chain {\n    identifier\n  }\n  ... on AssetType {\n    tokenId\n    assetContract {\n      address\n      id\n    }\n  }\n}\n\nfragment item_sellUrl on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    ...asset_url\n  }\n  ... on AssetBundleType {\n    slug\n    chain {\n      identifier\n    }\n    assetQuantities(first: 18) {\n      edges {\n        node {\n          asset {\n            relayId\n            id\n          }\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment item_url on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    ...asset_url\n  }\n  ... on AssetBundleType {\n    ...bundle_url\n  }\n}\n\nfragment readItemHasBestAsk_item on ItemType {\n  __isItemType: __typename\n  orderData {\n    bestAskV2 {\n      __typename\n      id\n    }\n  }\n}\n\nfragment useAssetSelectionStorage_item_21vFPh on ItemType {\n  __isItemType: __typename\n  __typename\n  relayId\n  chain {\n    identifier\n  }\n  ... on AssetType {\n    bestAllTypeBid @include(if: $shouldShowBestBid) {\n      relayId\n      id\n    }\n    ...asset_url\n    isCompromised\n  }\n  ... on AssetBundleType {\n    orderData @include(if: $shouldShowBestBid) {\n      bestBidV2 {\n        relayId\n        id\n      }\n    }\n  }\n  ...item_sellUrl\n  ...AssetContextMenu_data\n}\n\nfragment useFulfillingListingsWillReactivateOrders_orders on OrderV2Type {\n  ...useTotalItems_orders\n}\n\nfragment useGetEligibleItemsForSweep_items on ItemType {\n  __isItemType: __typename\n  __typename\n  relayId\n  chain {\n    identifier\n  }\n  orderData {\n    bestAskV2 {\n      relayId\n      orderType\n      maker {\n        address\n        id\n      }\n      perUnitPriceType {\n        usd\n        unit\n        symbol\n      }\n      payment {\n        relayId\n        symbol\n        usdPrice\n        id\n      }\n      id\n    }\n  }\n  ...SweepContextProvider_items\n}\n\nfragment useIsItemSafelisted_item on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    collection {\n      slug\n      verificationStatus\n      id\n    }\n  }\n  ... on AssetBundleType {\n    assetQuantities(first: 30) {\n      edges {\n        node {\n          asset {\n            collection {\n              slug\n              verificationStatus\n              id\n            }\n            id\n          }\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment useIsQuickBuyEnabled_order on OrderV2Type {\n  orderType\n  item {\n    __typename\n    ... on AssetType {\n      isCurrentlyFungible\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment useIsRarityEnabled_collection on CollectionType {\n  slug\n  enabledRarities\n}\n\nfragment useItemCardCta_item_2qvZ6X on ItemType {\n  __isItemType: __typename\n  __typename\n  chain {\n    identifier\n  }\n  orderData {\n    bestAskV2 {\n      orderType\n      maker {\n        address\n        id\n      }\n      id\n    }\n  }\n  ... on AssetType {\n    isDelisted\n    isListable\n    isCurrentlyFungible\n  }\n}\n\nfragment useItemFees_item on ItemType {\n  __isItemType: __typename\n  __typename\n  ... on AssetType {\n    totalCreatorFee\n    collection {\n      openseaSellerFeeBasisPoints\n      isCreatorFeesEnforced\n      id\n    }\n  }\n  ... on AssetBundleType {\n    bundleCollection: collection {\n      openseaSellerFeeBasisPoints\n      totalCreatorFeeBasisPoints\n      isCreatorFeesEnforced\n      id\n    }\n  }\n}\n\nfragment useTotalItems_orders on OrderV2Type {\n  item {\n    __typename\n    relayId\n    ... on AssetBundleType {\n      assetQuantities(first: 30) {\n        edges {\n          node {\n            asset {\n              relayId\n              id\n            }\n            id\n          }\n        }\n      }\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment useTotalPrice_orders on OrderV2Type {\n  relayId\n  perUnitPriceType {\n    usd\n    unit\n  }\n  dutchAuctionFinalPriceType {\n    usd\n    unit\n  }\n  openedAt\n  closedAt\n  payment {\n    symbol\n    ...TokenPricePayment\n    id\n  }\n}\n\nfragment wallet_accountKey on AccountType {\n  address\n}\n",
        variables: {
          collections: [slugCollection],
          count: 32,
          cursor: null,
          numericTraits: null,
          owner: null,
          paymentAssets: null,
          priceFilter: null,
          query: null,
          rarityFilter: null,
          resultModel: "ASSETS",
          safelistRequestStatuses: null,
          shouldShowBestBid: false,
          sortAscending: true,
          sortBy: "UNIT_PRICE",
          stringTraits: null,
          toggles: null,
        },
      },
    };
    try {
      const response = await axios.request(options);
      return response.data.data.collectionItems.edges.reduce((acc, el) => {
        if (el.node.orderData.bestAskV2) {
          acc.push({
            tokenId: el.node.tokenId,
            price: Number(el.node.orderData.bestAskV2.priceType.eth),
          });
        }
        return acc;
      }, []);
    } catch (error) {
      Logger.error("callCollection", error);
      return error;
    }
  }

  async getNftsOnCollection(collection, collectionObj) {
    if (!collectionObj.slug) {
      Logger.warn(
        `Get nft slug for collection ${collectionObj.name} because slug: ${collectionObj.slug}`
      );
      await sleep(2000);
      collectionObj.slug = await this.getSlugCollection(collection);
    }
    await sleep(1000);
    return this.callCollection(collectionObj.slug);
  }

  createOrder(order) {
    const basicOrderParameters = {
      considerationToken: order.protocolData.parameters.consideration[0].token,
      considerationIdentifier: Number(this.utils.getBigNumber("0")),
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

    basicOrderParameters.offerer = this.utils.getAddr(order.maker.address);
    basicOrderParameters.offerToken =
      order.protocolData.parameters.offer[0].token;
    basicOrderParameters.offerIdentifier = this.utils.getBigNumber(
      order.protocolData.parameters.offer[0].identifierOrCriteria
    );
    basicOrderParameters.startTime = order.listingTime;
    basicOrderParameters.endTime = order.expirationTime;
    basicOrderParameters.salt = order.protocolData.parameters.salt;
    basicOrderParameters.totalOriginalAdditionalRecipients =
      order.protocolData.parameters.totalOriginalConsiderationItems - 1;
    basicOrderParameters.signature = order.protocolData.signature;
    for (let consider of order.protocolData.parameters.consideration) {
      if (consider.recipient === basicOrderParameters.offerer) {
        basicOrderParameters.considerationAmount = this.utils.getBigNumber(
          consider.startAmount
        );
        continue;
      }
      basicOrderParameters.additionalRecipients.push({
        amount: this.utils.getBigNumber(consider.startAmount),
        recipient: consider.recipient,
      });
    }

    return basicOrderParameters;
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

  async getOrder(side, tokenId, assetContractAddress) {
    return this.seaport.api.getOrder({
      side,
      assetContractAddress,
      tokenId,
    });
  }

  async getParams(tokenId, collectionAddr) {
    try {
      const order = await this.getOrder("ask", tokenId, collectionAddr);
      const signature = await this.getSignature(order);
      const model = {
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
      Logger.info(
        "OpenseaParamApi ",
        signature.data.fulfillment_data.transaction.input_data.parameters
      );

      return this.utils.encodeAbi(
        model,
        signature.data.fulfillment_data.transaction.input_data.parameters
      );
    } catch (error) {
      Logger.error(
        `Not found on OpenSea with tokenId: ${tokenId}, addr: ${collectionAddr}`
      );
      return undefined;
      //Logger.error();
    }
  }
}
