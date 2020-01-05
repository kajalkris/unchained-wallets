/**
 * This module provides classes for Ledger hardware wallets.
 *
 * The base classes provided are `LedgerDashboardInteraction` and
 * `LedgerBitcoinInteraction` for interactions requiring being in the
 * Ledger dashboard vs. bitcoin app, respectively.
 *
 * The following API classes are implemented:
 *
 * * LedgerGetMetadata
 * * LedgerExportPublicKey
 * * LedgerSignMultisigTransaction
 * 
 * 
 * @module ledger
 */
import BigNumber from "bignumber.js";
import {
  compressPublicKey,
  scriptToHex,
  multisigRedeemScript,
  multisigWitnessScript,
  NETWORKS,
  MULTISIG_ADDRESS_TYPES,
  multisigAddressType,
} from "unchained-bitcoin";

import {
  ACTIVE,
  PENDING,
  INFO,
  WARNING,
  DirectKeystoreInteraction,
} from "./interaction";

import IMAGES from "./images";

/**
 * Constant defining Ledger interactions.
 *
 * @type {string}
 * @default ledger
 */
export const LEDGER = 'ledger';

const bitcoin = require('bitcoinjs-lib');

const TransportU2F = require("@ledgerhq/hw-transport-u2f").default;
const LedgerBtc    = require("@ledgerhq/hw-app-btc").default;

/**
 * Base class for interactions with Ledger hardware wallets.
 *
 * Subclasses must implement their own `run()` method.  They may use
 * the `withTransport` and `withApp` methods to connect to the Ledger
 * API's transport or app layers, respectively.
 *
 * Errors are not caught, so users of this class (and its subclasses)
 * should use `try...catch` as always.
 * 
 * @extends {module:interaction.DirectKeystoreInteraction}
 * @example
 * import {LedgerInteraction} from "unchained-wallets";
 * // Simple subclass
 *
 * class SimpleLedgerInteraction extends LedgerInteraction {
 *
 *   constructor({param}) {
 *     super({});
 *     this.param =  param;
 *   }
 *
 *   async run() {
 *     return await this.withApp(async (app, transport) => {
 *       return app.doSomething(this.param); // Not a real Ledger API call
 *     });
 *   }
 * 
 * }
 *
 * // usage
 * const interaction = new SimpleLedgerInteraction({param: "foo"});
 * const result = await interaction.run();
 * console.log(result); // whatever value `app.doSomething(...)` returns
 * 
 */
export class LedgerInteraction extends DirectKeystoreInteraction {

  /**
   * Adds `pending` messages at the `info` level about ensuring the
   * device is plugged in (`device.connect`) and unlocked
   * (`device.unlock`).  Adds an `active` message at the `info` level
   * when communicating with the device (`device.active`).
   *
   * @return {module:interaction.Message[]}
   */
  messages() {
    const messages = super.messages();
    messages.push({state: PENDING, level: INFO, text: "Make sure your Ledger device is plugged in.", code: "device.connect"});
    messages.push({state: PENDING, level: INFO, text: "Make sure you have unlocked your Ledger device.", code: "device.unlock"});
    messages.push({state: ACTIVE, level: INFO, text: "Communicating with Ledger device...", code: "device.active"});
    return messages;
  }

  /**
   * Can be called by a subclass during its `run()` method.
   *
   * Creates a transport layer connection and passes control to the
   * `callback` function, with the transport API as the first argument
   * to the function.
   *
   * See the [Ledger API]{@link https://github.com/LedgerHQ/ledgerjs} for general information or a [specific transport API]{@link https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-transport-u2f} for examples of API calls.
   *
   * @param {function} callback -- accepts a single parameter `transport`
   * @example
   * async run() {
   *   return await this.withTransport(async (transport) => {
   *     return transport.doSomething(); // Not a real Ledger transport API call
   *   });
   * }
   */
  async withTransport(callback) {
    const transport = await TransportU2F.create();
    return await callback(transport);
  }

  /**
   * Can be called by a subclass during its `run()` method.
   *
   * Creates a transport layer connection, initializes a bitcoin app
   * object, and passes control to the `callback` function, with the
   * app API as the first argument to the function and the transport
   * API as the second.
   *
   * See the [Ledger API]{@link https://github.com/LedgerHQ/ledgerjs} for genereal information or the [bitcoin app API]{@link https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-app-btc} for examples of API calls.
   *
   * @param {function} callback -- accepts two parameters, `app` and `transport`, which are the Ledger APIs for the bitcoin app and the transport layer, respectively.
   * @example
   * async run() {
   *   return await this.withApp(async (app, transport) => {
   *     return app.doSomething(); // Not a real Ledger bitcoin app API call
   *   });
   * }
   */
  async withApp(callback) {
    return await this.withTransport(async (transport) => {
      const app = new LedgerBtc(transport);
      return await callback(app, transport);
    });
  }

}

/**
 * Base class for interactions which must occur when the Ledger device
 * is not in any app but in the dashboard.
 *
 * @extends {module:ledger.LedgerInteraction}
 * 
 */
export class LedgerDashboardInteraction extends LedgerInteraction {

  /**
   * Adds `pending` and `active` messages at the `info` level urging
   * the user to be in the Ledger dashboard, not the bitcoin app
   * (`ledger.app.dashboard`).
   *
   * @return {module:interaction.Message[]}
   */
  messages() {
    const messages = super.messages();
    messages.push({state: PENDING, level: INFO, text: "Make sure you have the main Ledger dashboard open, NOT the Bitcoin app.", code: "ledger.app.dashboard"});
    messages.push({state: ACTIVE, level: INFO, text: "Make sure you have the main Ledger dashboard open, NOT the Bitcoin app.", code: "ledger.app.dashboard"});
    return messages;
  }
}

/**
 * Base class for interactions which must occur when the Ledger device
 * is open to the bitcoin app.
 * 
 * @extends {module:ledger.LedgerInteraction}
 */
export class LedgerBitcoinInteraction extends LedgerInteraction {

  /**
   * Adds `pending` and `active` messages at the `info` level urging
   * the user to be in the bitcoin app (`ledger.app.bitcoin`).
   *
   * @return {module:interaction.Message[]}
   */
  messages() {
    const messages = super.messages();
    messages.push({state: PENDING, level: INFO, text: "Make sure you have the Bitcoin app open.", code: "ledger.app.bitcoin"});
    messages.push({state: ACTIVE, level: INFO, text: "Make sure you have the Bitcoin app open.", code: "ledger.app.bitcoin"});
    return messages;
  }

}

/**
 * Returns metadata about Ledger device.
 *
 * Includes model name, firmware & MCU versions.
 *
 * @extends {module:ledger.LedgerDashboardInteraction}
 * @example
 * import {LedgerGetMetadata} from "unchained-wallets";
 * const interaction = new LedgerGetMetadata();
 * const result = await interaction.run();
 * console.log(result);
 * {
 *   spec: "Nano S v1.4.2 (MCU v1.7)",
 *   model: "Nano S",
 *   version: {
 *     major: "1",
 *     minor: "4",
 *     patch: "2",
 *     string: "1.4.2",
 *   },
 *   mcuVersion: {
 *     major: "1",
 *     minor: "7",
 *     string: "1.7",
 *   }
 * }
 * 
 */
export class LedgerGetMetadata extends LedgerDashboardInteraction {
  // FIXME entire implementation here is rickety AF.

  async run() {
    
    return await this.withTransport(async (transport) => {
      transport.setScrambleKey('B0L0S');
      const rawResult = await transport.send(0xe0, 0x01, 0x00, 0x00);
      return this.parseMetadata(rawResult);
    });
  }

  /**
   * Parses the binary data returned from the Ledger API call into a
   * metadata object.
   *
   * @param {ByteArray} response
   * @returns {Object}
   */
  parseMetadata(response) {
    try {
      // From
      //
      //   https://github.com/LedgerHQ/ledger-live-common/blob/master/src/hw/getVersion.js
      //   https://github.com/LedgerHQ/ledger-live-common/blob/master/src/hw/getDeviceInfo.js
      //   https://git.xmr.pm/LedgerHQ/ledger-live-common/commit/9ffc75acfc7f1e9aa9101a32b3e7481770fb3b89

      const PROVIDERS = {
        "": 1,
        das: 2,
        club: 3,
        shitcoins: 4,
        ee: 5
      };
      const ManagerAllowedFlag = 0x08;
      const PinValidatedFlag = 0x80;

      const byteArray = [...response];
      const data = byteArray.slice(0, byteArray.length - 2);
      const targetIdStr = Buffer.from(data.slice(0, 4));
      const targetId = targetIdStr.readUIntBE(0, 4);
      const seVersionLength = data[4];
      let seVersion = Buffer.from(data.slice(5, 5 + seVersionLength)).toString();
      const flagsLength = data[5 + seVersionLength];
      let flags = Buffer.from(
        data.slice(5 + seVersionLength + 1, 5 + seVersionLength + 1 + flagsLength)
      );

      const mcuVersionLength = data[5 + seVersionLength + 1 + flagsLength];
      let mcuVersion = Buffer.from(
        data.slice(
          7 + seVersionLength + flagsLength,
          7 + seVersionLength + flagsLength + mcuVersionLength
        )
      );
      if (mcuVersion[mcuVersion.length - 1] === 0) {
        mcuVersion = mcuVersion.slice(0, mcuVersion.length - 1);
      }
      mcuVersion = mcuVersion.toString();

      if (!seVersionLength) {
        seVersion = "0.0.0";
        flags = Buffer.allocUnsafeSlow(0);
        mcuVersion = "";
      }

      const isOSU = seVersion.includes("-osu");
      const version = seVersion.replace("-osu", "");
      const m = seVersion.match(/([0-9]+.[0-9]+)(.[0-9]+)?(-(.*))?/);
      const [, majMin, , , providerName] = m || [];
      const providerId = PROVIDERS[providerName] || 1;
      const isBootloader = (targetId & 0xf0000000) !== 0x30000000;
      const flag = flags.length > 0 ? flags[0] : 0;
      const managerAllowed = !!(flag & ManagerAllowedFlag);
      const pin = !!(flag & PinValidatedFlag);

      const [majorVersion, minorVersion, patchVersion] = (version || '').split('.');
      const [mcuMajorVersion, mcuMinorVersion] = (mcuVersion || '').split('.');


      // https://gist.github.com/TamtamHero/b7651ffe6f1e485e3886bf4aba673348
      // +-----------------+------------+
      // |    FirmWare     | Target ID  |
      // +-----------------+------------+
      // | Nano S <= 1.3.1 | 0x31100002 |
      // | Nano S 1.4.x    | 0x31100003 |
      // | Nano S 1.5.x    | 0x31100004 |
      // |                 |            |
      // | Blue 2.0.x      | 0x31000002 |
      // | Blue 2.1.x      | 0x31000004 |
      // | Blue 2.1.x V2   | 0x31010004 |
      // |                 |            |
      // | Nano X          | 0x33000004 |
      // |                 |            |
      // | MCU,any version | 0x01000001 |
      // +-----------------+------------+
      //
      //  Order matters -- high to low minTargetId
      const MODEL_RANGES = [
        {minTargetId: 0x33000004,  model: "Nano X"},
        {minTargetId: 0x31100002,  model: "Nano S"},
        {minTargetId: 0x31100002, model: "Blue"},
        {minTargetId: 0x01000001, model: "MCU"},
      ];
      let model = 'Unknown';
      if (targetId) {
        for (let i=0; i<MODEL_RANGES.length; i++) {
          const range = MODEL_RANGES[i];
          if (targetId >= range.minTargetId) {
            model = range.model;
            break;
          }
        }
      }

      let spec = `${model} v${version} (MCU v${mcuVersion})`;
      // if (pin) {
      //   spec += " w/PIN";
      // }

      return {
        spec,
        model,
        version: {
          major: majorVersion,
          minor: minorVersion,
          patch: patchVersion,
          string: version,
        },
        mcuVersion: {
          major: mcuMajorVersion,
          minor: mcuMinorVersion,
          string: mcuVersion,
        },
        // pin,
      };

    } catch (e) {
      console.error(e);
      throw new Error("Unable to parse metadata from Ledger device.");
    }
  }

}

/**
 * Base class for interactions exporting information about an HD node
 * at a given BIP32 path.
 *
 * You may want to use `LedgerExportPublicKey` directly.
 * 
 * @extends {module:ledger.LedgerBitcoinInteraction}
 * @example
 * import {MAINNET} from "unchained-bitcoin";
 * import {LedgerExportHDNode} from "unchained-wallets";
 * const interaction = new LedgerExportHDNode({network: MAINNET, bip32Path: "m/48'/0'/0'/2'/0"});
 * const node = await interaction.run();
 * console.log(node);
 */
class LedgerExportHDNode extends LedgerBitcoinInteraction {

  /**
   * Requires a BIP32 path to the node to export.
   * 
   * @param {object} options
   * @param {string} bip32Path - the BIP32 path for the HD node
   */
  constructor({bip32Path}) {
    super();
    this.bip32Path = bip32Path;
  }

  /**
   * Adds messages related to the warnings Ledger devices produce on various BIP32 paths.
   *
   * @returns {module:interaction.Message[]}
   */
  messages() {
    const messages = super.messages();

    messages.push({
      state: ACTIVE, 
      level: WARNING, 
      version: "<1.6.0",
      text: "Your Ledger will display a 'WARNING!' message because it doesn't understand standards for multisig addresses.  It is safe to continue.",
      code: "ledger.path.warning",
      steps: [
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[0],
          text: "Your Ledger will display a WARNING message.  Click BOTH buttons to continue."
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[1],
          text: "Your Ledger will display a message about an unusual derivation path.  Click BOTH buttons to continue.",
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[2],
          text: `Your Ledger will display the derivation path "${this.bip32Path}" .  Click BOTH buttons to continue.`,
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[3],
          text: `Your Ledger will ask if you're sure.  Click the RIGHT button to continue.`,
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[4],
          text: `Your Ledger will will display a bitcoin address.  Click the RIGHT button to continue.`,
        },
      ],
    });
    messages.push({
      state: ACTIVE, 
      level: WARNING, 
      version: ">=1.6.0",
      text: "Your Ledger will display a message stating the BIP32 path is unusual.  It is safe to continue.",
      code: "ledger.path.warning",
      steps: [
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[1], // FIXME update image
          text: "Your Ledger will display a message about an unusual derivation path.  Click the RIGHT button to continue.",
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[2], // FIXME update image
          text: `Your Ledger will display the derivation path "${this.bip32Path}".  Click the RIGHT button to continue.`,
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[3], // FIXME update image
          text: `Your Ledger will ask if you want to reject this request.  Click the RIGHT button to continue.`,
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[3], // FIXME update image
          text: `Your Ledger will ask if you want to approve ths request.  Click BOTH buttons to do so.`,
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[4], // FIXME update image
          text: `Your Ledger will display a bitcoin address.  Click the RIGHT button until you scroll past the entire address text.`,
        },
        {
          image: IMAGES[LEDGER].bip32PathWarningV1[3], // FIXME update image
          text: `Your Ledger will ask you if you to approve this request.  Click BOTH buttons to do so.`,
        },

      ],
    });
    return messages;
  }

  /**
   * See {@link https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-app-btc#getwalletpublickey}.
   *
   * @returns {object} the HD node object.
   */
  async run() {
    return await this.withApp(async (app) => {
      return await app.getWalletPublicKey(this.bip32Path, {verify: true});
    });
  }
}

/**
 * Returns the public key at a given BIP32 path.
 * 
 * @extends {module:ledger.LedgerExportHDNode}
 * @example
 * import {LedgerExportPublicKey} from "unchained-wallets";
 * const interaction = new LedgerExportPublicKey({bip32Path: "m/48'/0'/0'/2'/0"});
 * const publicKey = await interaction.run();
 * console.log(publicKey);
 * // "03..."
 */
export class LedgerExportPublicKey extends LedgerExportHDNode {

  /**
   * Parses out and compresses the public key from the response of
   * `LedgerExportHDNode`.
   * 
   * @returns {string} -- (compressed) public key in hex 
   */
  async run() {
    const result = await super.run();
    return this.parsePublicKey((result || {}).publicKey);
  }

  /**
   * Compress the given public key.
   *
   * @param {string} publicKey - the uncompressed public key in hex
   * @returns {string} - the compressed public key in hex
   * 
   */
  parsePublicKey(publicKey) {
    if (publicKey) {
      try {
        return compressPublicKey(publicKey);
      } catch(e) {
        console.error(e);
        throw new Error("Unable to compress public key from Ledger device.");
      }
    } else {
      throw new Error("Received no public key from Ledger device.");
    }
  }

}

/**
 * Returns a signature for a bitcoin transaction with inputs from one
 * or many multisig addresses.
 *
 * - `inputs` is an array of `UTXO` objects from `unchained-bitcoin`
 * - `outputs` is an array of `TransactionOutput` objects from `unchained-bitcoin`
 * - `bip32Paths` is an array of (`string`) BIP32 paths, one for each input, identifying the path on this device to sign that input with
 *
 * @extends {module:ledger.LedgerBitcoinInteraction}
 * @example
 * import {
 *   generateMultisigFromHex, TESTNET, P2SH,
 * } from "unchained-bitcoin";
 * import {LedgerSignMultisigTransaction} from "unchained-wallets";
 * const redeemScript = "5...ae";
 * const inputs = [
 *   {
 *     txid: "8d276c76b3550b145e44d35c5833bae175e0351b4a5c57dc1740387e78f57b11",
 *     index: 1,
 *     multisig: generateMultisigFromHex(TESTNET, P2SH, redeemScript),
 *     amountSats: '1234000'
 *   },
 *   // other inputs...
 * ];
 * const outputs = [
 *   {
 *     amountSats: '1299659',
 *     address: "2NGHod7V2TAAXC1iUdNmc6R8UUd4TVTuBmp"
 *   },
 *   // other outputs...
 * ];
 * const interaction = new LedgerSignMultisigTransaction({
 *   network: TESTNET,
 *   inputs,
 *   outputs,
 *   bip32Paths: ["m/45'/0'/0'/0", // add more, 1 per input],
 * });
 * const signature = await interaction.run();
 * console.log(signatures);
 * // ["ababab...", // 1 per input]
 */
export class LedgerSignMultisigTransaction extends LedgerBitcoinInteraction {

  /**
   * @param {object} options
   * @param {string} options.network - bitcoin network
   * @param {array<object>} options.inputs - inputs for the transaction
   * @param {array<object>} options.outputs - outputs for the transaction
   * @param {array<string>} options.bip32Paths - BIP32 paths
   */
  constructor({network, inputs, outputs, bip32Paths}) {
    super();
    this.network = network;
    this.inputs = inputs;
    this.outputs = outputs;
    this.bip32Paths = bip32Paths;
  }

  /**
   * Adds messages describing the signing flow.
   *
   * @returns {module:interaction.Message[]}
   */
  messages() {
    const messages = super.messages();
    // FIXME add messages!
    return messages;
  }

  /**
   * See {@link https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-app-btc#signp2shtransaction}.
   * 
   * @returns {string[]} signature, one per input
   */
  async run() {
    return await this.withApp(async (app, transport) => {
      // FIXME: Explain the rationale behind this choice.
      transport.setExchangeTimeout(20000 * this.outputs.length);
      return await app.signP2SHTransaction(
        this.ledgerInputs(app),
        this.ledgerKeysets(),
        this.ledgerOutputScriptHex(app),
        0, // locktime, 0 is no locktime
        1, // sighash type, 1 is SIGHASH_ALL
        this.anySegwitInputs(),
        1 // tx version
      );
    });
  }

  ledgerInputs(app) {
    return this.inputs.map(input => {
      const addressType = multisigAddressType(input.multisig);
      const inputTransaction = app.splitTransaction(input.transactionHex, true); // FIXME: should the 2nd parameter here always be true?
      const scriptFn = (addressType === MULTISIG_ADDRESS_TYPES.P2SH ? multisigRedeemScript : multisigWitnessScript);
      const scriptHex = scriptToHex(scriptFn(input.multisig));
      return [inputTransaction, input.index, scriptHex]; // can add sequence number for RBF as an additional element
    });
  }

  ledgerKeysets() {
    return this.bip32Paths.map((bip32Path) => this.ledgerBIP32Path(bip32Path));
  }

  ledgerOutputScriptHex(app) {
    // This seems like an inefficient way to achieve the final
    // result...
    let txTmp = new bitcoin.TransactionBuilder();
    txTmp.setVersion(1);
    if (this.network === NETWORKS.TESTNET) {
      txTmp.network = bitcoin.networks.testnet;
    }
    for (var i = 0; i < this.outputs.length; i++) {
      txTmp.addOutput(this.outputs[i].address, new BigNumber(this.outputs[i].amountSats).toNumber());
    }
    for (var j = 0; j < this.inputs.length; j++) {
      txTmp.addInput(this.inputs[j].txid, this.inputs[j].index);
    }

    const txToSign = txTmp.buildIncomplete();
    const txHex = txToSign.toHex();
    const splitTx = app.splitTransaction(txHex, this.anySegwitInputs());
    return app.serializeTransactionOutputs(splitTx).toString('hex');
  }

  ledgerBIP32Path(bip32Path) {
    return bip32Path.split("/").slice(1).join("/");
  }

  anySegwitInputs() {
    for (let i=0; i<this.inputs.length; i++) {
      const input = this.inputs[i];
      const addressType = multisigAddressType(input.multisig);
      if (addressType === MULTISIG_ADDRESS_TYPES.P2SH_P2WSH || addressType === MULTISIG_ADDRESS_TYPES.P2WSH) {
        return true;
      }
    }
    return false;
  }

}
