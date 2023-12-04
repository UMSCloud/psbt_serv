// import { Psbt } from 'bitcoinjs-lib';

const { Buffer } = require('buffer');
const ecc = require('@bitcoinerlab/secp256k1');
const { Psbt, initEccLib, networks } = require('bitcoinjs-lib');
const express = require('express');
const mempool = require('@mempool/mempool.js');
const app = express();
initEccLib(ecc);



app.use(express.json());
app.request.accepts('application/json');

app.post('/test', (req, res) => {
    const { sellerBase64, buyerSignedPsbt } = req.body;

    res.send(`Welcome \n${sellerBase64}, \n\n\n${buyerSignedPsbt}`);
});

function generateTxidFromHash(hash) {
    return hash.reverse().toString('hex');
}

app.post('/checkInput', async (req, res) => {
    const { isMainNet = false, buyerBase64 } = req.body;
    const network =
        isMainNet == true
            ? networks.bitcoin
            : networks.testnet;
    const networkStr = isMainNet == true ? 'mainnet' : "testnet";
    try {

        const buyerSignedPsbt = Psbt.fromBase64(`${buyerBase64}`, { network });

        const { bitcoin: { transactions } } = mempool({
            hostname: 'mempool.space',
            network: networkStr
        });

        let result = [];
        let spent = false;
        for (let index = 0; index < buyerSignedPsbt.inputCount; index++) {
            const txInput = buyerSignedPsbt.txInputs[index];
            const txid = generateTxidFromHash(txInput.hash);
            const idx = txInput.index; //txInput.index;


            const txOutspend = await transactions.getTxOutspend({
                txid,
                vout: idx,
            });

            // result.push({ "input": txid + ":" + idx, 'spend': txOutspend['spent'] });
            if (txOutspend['spent'] == true) {
                spent = true;
                break;
            }
        }

        res.status(200);
        res.send({
            result: {
                status: 0,
                // inputs: result,
                spent: spent
            }
        });


    } catch (e) {
        res.status(200);
        res.send({
            result: {
                status: -1,
                msg: e.message,
            }
        });
    }
});

app.post('/mergePsbt', (req, res) => {

    const { isMainNet = false, sellerBase64, buyerBase64, platAddress = "tb1qmvjxuhtnpx577k26dw4y29jtd45mlh75cwl9rp", platFee = 1000 } = req.body;

    const network =
        isMainNet == true
            ? networks.bitcoin
            : networks.testnet;

    try {
        const sellerSignedPsbt = Psbt.fromBase64(sellerBase64, { network });

        const buyerSignedPsbt = Psbt.fromBase64(`${buyerBase64}`, { network });


        if ((sellerSignedPsbt && sellerSignedPsbt.inputCount < 1)
            && buyerSignedPsbt && buyerSignedPsbt.inputCount < 3) {
            res.status(200);
            res.send({
                result: { status: -1, msg: 'psbt is invalid' },
            });
            return;
        }


        if (buyerSignedPsbt.txOutputs[3].value != platFee) {
            res.status(200);
            res.send({
                result: { status: -1, msg: 'platform fee is wrong' },
            });
            return
        }

        if (buyerSignedPsbt.txOutputs[3].address != platAddress) {
            res.status(200);
            res.send({
                result: { status: -1, msg: 'platform address is wrong', plat: buyerSignedPsbt.txOutputs[3].address, platAddress: platAddress },
            });
            return
        }


        (buyerSignedPsbt.data.globalMap.unsignedTx).tx.ins[2] = (sellerSignedPsbt.data.globalMap.unsignedTx).tx.ins[0];
        buyerSignedPsbt.data.inputs[2] = sellerSignedPsbt.data.inputs[0];

        buyerSignedPsbt.finalizeAllInputs();
        const tx = buyerSignedPsbt.extractTransaction();
        const rawtx = tx.toHex();
        const txid = tx.getId();
        res.status(200);
        res.send({
            result: {
                status: 0,
                txId: txid,
                rawTxHex: rawtx
            }
        });
    } catch (e) {
        res.status(200);
        res.send({
            result: {
                status: -1,
                msg: e.message,
            }
        });
    }

});


app.get('/status', (req, res) => {

    res.status(200);
    res.send(
        {
            result: {
                status: 0,
                msg: "server is alive",
            }
        }
    );
})

module.exports = app;
