var http = require('http');
const express = require('express');

const app = express();
let server = null;
let currentTxCode = '';

app.use(express.json());

app.post('/txcode', (req, res) => {
  //
  // This represents the tx_code out-of-band delivery endpoint for a user
  // who is perfomed a pre-authorized_code with their wallet.  THis endpoint simply
  // caches the most recent tx_code.  The mainline test code can then call
  // "getCurrentTxCode" when it is ready to include in an invocation of
  // OP's /token endpoint.
  //
  // This endpoint will be invoked by preauth_notifytxcode.js during an invocation of
  // /preauth endpoint at the OP.
  //
  console.log(`ENTRY POST txcode`);
  console.log(`${JSON.stringify(req.body, undefined, 4)}`);
  currentTxCode = req.body;
  res.send({ 
    message: `POST request received`,
    body: req.body,
  });
});

app.get('/txcode', (req, res) => {
  res.send( { txcode: currentTxCode } );
});

exports.getCurrentTxCode = function () {
  return currentTxCode;
};

exports.listen = function () {
  server = app.listen(8888, () => {
    console.log('Server running on port 8888');
  });
};
  
exports.close = function (callback) {
  if (server !== null) {
    
    server.close(() => {
      console.log("Closing http server");
    });
  } 
};
  