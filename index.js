
/**ENVIRONMENT */
require('dotenv').config();

/**Axios for making http request */
var axios = require('axios');

/**Bitcoin Library */
var bitcoin = require("bitcoinjs-lib");

/**Ethereum Library */
var Tx = require('ethereumjs-tx').Transaction;

/**Web3 */
var Web3 = require('web3');

/**Set ETH provider */
var ethProvider = "https://mainnet.infura.io/v3/" + process.env.INFURA_TOKEN
var web3 = new Web3(ethProvider)

/**For Promisifying so we use Async on our methods */
const util = require('util');

/**Express */
var express = require('express');

//initialise express
var app = express();
//set view engine as ejs
app.set('view engine', 'ejs');
//render images
app.use('/assets', express.static('assets'))
//to get POST params
app.use(express.urlencoded({ extended: true }))

//for blockcypher API
//BC_TOKEN is your Blockcypher API token will be used for wallet infrastructure transaction
var blockcypherTokenParam = "?token=" + process.env.BC_TOKEN



//HomePage
app.get('/', function (req, res) {

    res.render('home');

})


//Wallet Page
app.get('/wallet', function (req, res) {

    (async function () {

        let balanceVal = null;

        //if BTC
        if (req.query.coin == "BTC") {
            //call btcBalance(address)
            let balance = util.promisify(btcBalance);

            balanceData = await balance(req.query.addr);

            //convert Satoshi result to BTC
            balanceVal = balanceData.balance / (Math.pow(10, 8));
        }
        //if ETH
        if (req.query.coin == "ETH") {
            //call ethBalance(address)
            let balance = util.promisify(ethBalance);

            balanceData = await balance(req.query.addr);

            //convert Wei result to ETH
            balanceVal = web3.utils.fromWei(balanceData, 'ether');
        }
        //if ERC20
        if (req.query.coin == "ERC20") {
            //call erc20Balance(address)
            let balance = util.promisify(erc20Balance);

            balanceData = await balance(req.query.name, req.query.addr);

            //convert result to Normal balance using token decimal
            //using js file
            var dat = require('./tokens/' + req.query.name);
            balanceVal = balanceData / (Math.pow(10, dat.decimal));
        }

        let data = {
            coin: req.query.coin,
            name: req.query.name,
            address: req.query.addr,
            balance: addCommas(balanceVal),
        }

        res.render('wallet', { data });

    })();

})


//Create New Address Page
app.get('/create', function (req, res) {

    (async function () {

        let address = null;
        let private = null;
        let public = null;
        let wif = null;

        //if BTC
        if (req.query.coin == "BTC") {

            //call createBtcAddress()
            let createAddress = util.promisify(createBtcAddress);

            addressData = await createAddress();

            address = addressData.address
            private = addressData.private
            public = addressData.public
            wif = addressData.wif

        }
        //if ETH
        if (req.query.coin == "ETH") {

            //call createEthAddress()
            let createAddress = util.promisify(createEthAddress);

            addressData = await createAddress();

            address = addressData.address
            private = addressData.privateKey
        }

        let data = {
            coin: req.query.coin,
            address: address,
            private: private,
            public: public,
            wif: wif
        }

        res.render('create', { data });

    })();

})


//Send Asset
app.post('/send', function (req, res) {

    (async function () {

        let comment = null;
        let txhash = null;

        //if BTC
        if (req.body.coin == "BTC") {
            //call sendBitcoin(from, fromPrivateKey, amount, destination)
            let send = util.promisify(sendBitcoin);

            sendData = await send(req.body.address, req.body.privateKey, req.body.amount, req.body.dest);

            if (sendData != "failed") {//if successful
                comment = "Operation Completed Successfully"
                txhash = sendData.tx.hash
            } else {//if failed
                comment = "Operation Failed Check the log for details"
            }
        }
        //if ETH
        if (req.body.coin == "ETH") {
            //call sendEthereum(from, fromPrivateKey, amount, destination)
            let send = util.promisify(sendEthereum);

            sendData = await send(req.body.address, req.body.privateKey, req.body.amount, req.body.dest);

            if (sendData != "failed") {//if successful
                comment = "Operation Completed Successfully"
                txhash = sendData
            } else {//if failed
                comment = "Operation Failed Check the log for details"
            }
        }
        //if ERC20
        if (req.body.coin == "ERC20") {
            //call sendErc20(token, from, fromPrivateKey, amount, destination)
            let send = util.promisify(sendErc20);

            sendData = await send(req.body.name, req.body.address, req.body.privateKey, req.body.amount, req.body.dest);

            if (sendData != "failed") {//if successful
                comment = "Operation Completed Successfully"
                txhash = sendData
            } else {//if failed
                comment = "Operation Failed Check the log for details"
            }
        }

        let data = {
            coin: req.body.coin,
            name: req.body.name,
            address: req.body.address,
            comment: comment,
            hash: txhash,
        }

        res.render('send', { data });

    })();

})





//-------------------------------------BITCOIN BALANCE-------------------------------------//
//-----------------------------------------------------------------------------------------//
function btcBalance(address, callBack) {

    var url = "https://api.blockcypher.com/v1/btc/main/addrs/" + address + "/balance" + blockcypherTokenParam + "&omitWalletAddresses=true";

    axios.get(url)
        .then(function (body) {

            body = body.data;
            return callBack(null, body);

        })
        .catch(function (e) {
            console.log(e);
            return callBack(null, "failed");
        });

}
//-----------------------------------------------------------------------------------------//




//------------------------------------ETHEREUM BALANCE-------------------------------------//
//-----------------------------------------------------------------------------------------//
function ethBalance(address, callBack) {

    //call web3 getBalance
    web3.eth.getBalance(address, (err, wei) => {

        return callBack(null, wei);

    }).catch(function (err) {
        console.log(err);
        return callBack(null, "failed");
    })

}
//-----------------------------------------------------------------------------------------//




//---------------------------------ERC20 TOKEN BALANCE-------------------------------------//
//-----------------------------------------------------------------------------------------//
/**
 * 
 * @param {*} token name of the ERC20 token
 * @param {*} address address you want to check
 */
function erc20Balance(token, address, callBack) {

    //using the token js file
    var tokenData = require('./tokens/' + token);

    //call the contract
    var contract = new web3.eth.Contract(tokenData.abi, tokenData.address);

    //call the balanceOf method from the contract
    contract.methods.balanceOf(address).call().then(function (result) {

        return callBack(null, result);

    }).catch(function (err) {
        console.log(err);
        return callBack(null, "failed");
    })

}
//-----------------------------------------------------------------------------------------//




//--------------------------------------BITCOIN SENDER-------------------------------------//
//-----------------------------------------------------------------------------------------//
/**
 * 
 * @param {*} from origin address
 * @param {*} fromPrivateKey origin address Private Key
 * @param {*} amount amount to send in BTC value
 * @param {*} destination address that you are sending to
 */
function sendBitcoin(from, fromPrivateKey, amount, destination, callBack) {

    //amount MUST be in SATOSHI, since we are accepting BTC amount, then we MUST convert it to SATOSHI
    //if amount is -1, it won't need to be converted. -1 means the origin wallet should be emptied
    //check Blockcypher API Doc https://www.blockcypher.com/dev/bitcoin/#creating-transactions

    let real_amount = (amount == -1) ? -1 : amount * (Math.pow(10, 8));

    //New Transaction Endpoint
    let create_url = "https://api.blockcypher.com/v1/btc/main/txs/new";

    //Send Transaction Endpoint
    let send_url = "https://api.blockcypher.com/v1/btc/main/txs/send";

    //build transaction body with origin address, destination address and amount

    //-1 will empty the input address but only works with one output
    let newtx = {
        inputs: [{ addresses: [from] }],
        outputs: [{ addresses: [destination], value: real_amount }]
    };

    // Create skeleton tx using New Transaction Endpoint
    // Pass in newtx (transaction body) as post param
    axios.post(create_url, JSON.stringify(newtx))
        .then(function (tmptx) {

            //get the result which is a tx skeleton that contains data to sign
            tmptx = tmptx.data;

            //We will sign the data with the Bitcoin Private Key for the origin address

            //process.env.ORIGIN_ADDRESS_PRIVATE_KEY is the Private Key of the origin address
            let keys = new bitcoin.ECPair.fromPrivateKey(Buffer.from(fromPrivateKey, 'hex'));

            //sign each of the data that requires signing
            tmptx.pubkeys = [];
            tmptx.signatures = tmptx.tosign.map(function (tosign, n) {
                tmptx.pubkeys.push(keys.publicKey.toString('hex'));
                let signature = keys.sign(Buffer.from(tosign, "hex"));
                let encodedSignature = bitcoin.script.signature.encode(signature, bitcoin.Transaction.SIGHASH_ALL);
                let hexStr = encodedSignature.toString("hex").slice(0, -2); return hexStr;
            });

            // sending back the transaction with all the signatures using Send Transaction Endpoint
            // Pass in the signed tmptx as post param
            axios.post(send_url, tmptx).then(function (finaltx) {

                //////////////////////
                //      RESULT      //
                //////////////////////

                return callBack(null, finaltx.data);

            })
                .catch(function (e) {
                    console.log(e.response);
                    return callBack(null, "failed");
                });
        })
        .catch(function (e) {
            console.log(e.response);
            return callBack(null, "failed");
        });
}


//-----------------------------------------------------------------------------------------//





//------------------------------------ETHEREUM SENDER--------------------------------------//
//-----------------------------------------------------------------------------------------//
/**
 * 
 * @param {*} from origin address
 * @param {*} fromPrivateKey origin address Private Key
 * @param {*} amount amount to send in BTC value
 * @param {*} destination address that you are sending to
 */

function sendEthereum(from, fromPrivateKey, amount, destination, callBack) {

    //Some ETH private key may have 0x appended to them making the length 66, we must remove the 0x
    //the if statement below deals with that

    //the plane private key with lenght 64 is needed here.
    if (fromPrivateKey.startsWith("0x") && fromPrivateKey.length == 66) {
        //remove the 0x
        fromPrivateKey = fromPrivateKey.substring(2);
    }

    //get the binary value of the private key
    var privateKeyBinary = Buffer.from(fromPrivateKey, 'hex');

    //to get the nounce i.e the number of total transactions by the sender (ORIGIN_ADDRESS)
    web3.eth.getTransactionCount(from, (err, txCount) => {
        if (err) {
            console.log(err);
            return callBack(null, "failed");
        }

        //Get the normal gas price required... So we don't guess just any gas price or do it manually
        web3.eth.getGasPrice().then(function (result) {

            //build transaction object
            var txObject = {
                nonce: web3.utils.toHex(txCount),//gotten from first web3 call getTransactionCount()
                to: destination,//destination address
                value: web3.utils.toHex(web3.utils.toWei(amount, 'ether')),//convert the amount in ETH to Wei then to Hex
                gasLimit: web3.utils.toHex(21000),//gas limit for ETH transaction is usually 21000
                gasPrice: web3.utils.toHex(result),//gotten from second web3 call getGasPrice()
            }


            //Sign the transaction with Origin Address private key

            //create new object of ethereumjs-tx
            var tx = new Tx(txObject, { 'chain': 'mainnet' });

            tx.sign(privateKeyBinary);

            var serializedTx = tx.serialize();
            var raw = '0x' + serializedTx.toString('hex');

            // Broadcast the transaction
            web3.eth.sendSignedTransaction(raw, (err, txHash) => {//result is the Tx Hash
                if (err) {
                    console.log(err);
                    return callBack(null, "failed");
                }
                else {

                    //////////////////////
                    //      RESULT      //
                    //////////////////////

                    return callBack(null, txHash);

                }
            });

        }).catch(function (err) {
            console.log(err);
            return callBack(null, "failed");
        })
    });


}
//-----------------------------------------------------------------------------------------//





//-------------------------------ERC20 TOKEN SENDER----------------------------------------//
//-----------------------------------------------------------------------------------------//
//Send ERC20 token from one address to another address

/**
 * 
 * @param {String} token name of the token you want to send
 * @param {*} from origin address
 * @param {*} fromPrivateKey origin address Private Key
 * @param {*} amount amount to send in BTC value
 * @param {*} destination address that you are sending to
 */

function sendErc20(token, from, fromPrivateKey, amount, destination, callBack) {

    //get token info from token file
    var tokenData = require('./tokens/' + token);

    //Some ETH private key may have 0x appended to them making the length 66, we must remove the 0x
    //the if statement below deals with that

    //the plane private key with lenght 64 is needed here.
    if (fromPrivateKey.startsWith("0x") && fromPrivateKey.length == 66) {
        //remove the 0x
        fromPrivateKey = fromPrivateKey.substring(2);
    }

    //get the binary value of the private key
    var privateKeyBinary = Buffer.from(fromPrivateKey, 'hex');

    //use the token ABI and address obtained from tokenData to call the token contract
    //Doc on calling a contract https://web3js.readthedocs.io/en/v1.3.0/web3-eth-contract.html#new-contract
    var contract = new web3.eth.Contract(tokenData.abi, tokenData.address);

    //to get the nounce i.e the number of total transactions by the sender (ORIGIN_ADDRESS)
    web3.eth.getTransactionCount(from, (err, txCount) => {
        if (err) {
            console.log(err);
            return callBack(null, "failed");
        }

        //Get the normal gas price required... So we don't guess just any gas price or do it manually
        web3.eth.getGasPrice().then(function (result) {

            //build transaction object
            var txObject = {
                nonce: web3.utils.toHex(txCount),//gotten from first web3 call getTransactionCount()
                gasLimit: web3.utils.toHex(200000), //calling contracts require more gasLimit than the normal 21000
                gasPrice: web3.utils.toHex(result),//gotten from second web3 call getGasPrice()
                to: tokenData.address,//send the data to contract address //we get the address fron the token data

                //data to send to the contract is that it should call the contract transfer method
                //and send the amount to the destination address
                //add the decimal number of zeros to amount using the token data
                data: contract.methods.transfer(destination, web3.utils.toWei(amount, tokenData.decimal_rept)).encodeABI(),

                chainID: web3.utils.toHex(1)//using mainnet
            }


            //Sign the transaction with Origin Address private key

            //create new object of ethereumjs-tx
            var tx = new Tx(txObject, { 'chain': 'mainnet' });

            tx.sign(privateKeyBinary);

            var serializedTx = tx.serialize();
            var raw = '0x' + serializedTx.toString('hex');

            // Broadcast the transaction
            web3.eth.sendSignedTransaction(raw, (err, txHash) => {//result is the Tx Hash
                if (err) {
                    console.log(err);
                    return callBack(null, "failed");
                }
                else {

                    //////////////////////
                    //      RESULT      //
                    //////////////////////

                    return callBack(null, txHash);

                }
            });

        }).catch(function (err) {
            console.log(err);
            return callBack(null, "failed");
        })
    });


}
//-----------------------------------------------------------------------------------------//





//-----------------------------------CREATE BTC ADDRESS------------------------------------//
//-----------------------------------------------------------------------------------------//
//generate Bitcoin address
function createBtcAddress(callBack) {

    var url = "https://api.blockcypher.com/v1/btc/main/addrs";

    axios.post(url)
        .then(function (body) {

            body = body.data;

            return callBack(null, body);

        })
        .catch(function (e) {
            console.log(e);
            return callBack(null, "failed");
        });


}
//-----------------------------------------------------------------------------------------//




//-----------------------------------CREATE ETH ADDRESS------------------------------------//
//-----------------------------------------------------------------------------------------//
//generate Ethereum address
function createEthAddress(callBack) {

    let body = web3.eth.accounts.create();

    return callBack(null, body);

}
//-----------------------------------------------------------------------------------------//




//for adding thousand points comma
function addCommas(nStr) {
    nStr += '';
    var x = nStr.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}




var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log('App Started !!!');
});