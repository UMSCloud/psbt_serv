// import { Psbt } from 'bitcoinjs-lib';

const { Buffer } = require('buffer');
const ecc = require('@bitcoinerlab/secp256k1');
const { Psbt, initEccLib, networks } = require('bitcoinjs-lib');
const express = require('express');
const app = express();
initEccLib(ecc);

app.use(express.json());
app.request.accepts('application/json');

app.post('/test', (req, res) => {
    const { sellerBase64, buyerSignedPsbt } = req.body;

    res.send(`Welcome \n${sellerBase64}, \n\n\n${buyerSignedPsbt}`);
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


app.get('/', (req, res) => {

    res.status(200);
    res.send("Welcome to root URL of Server 1");
})

module.exports = app;
