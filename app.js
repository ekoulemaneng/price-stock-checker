// Set environment variable
const dotenv = require('dotenv');
dotenv.config();
//--------

// Require Express et set an instance
const express = require('express');
const app = express();
//--------

// Static files
app.use(express.static('public'));
//--------

// Module to parse sent form data 
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
//--------

// Module to allow others domains to communicate with this server
const cors = require('cors');
app.use(cors());
//--------

// Modules for security
const helmet = require('helmet');
app.use(helmet.contentSecurityPolicy({ directives: {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'"],
  scriptSrc: ["'self'"]
}}));
//--------

// Module to make api request
const fetch = require('node-fetch');
//--------

// Module to generate random import
const randomip = require('random-ip');
//--------

// Require Mongoose and connect to remote database server
const mongoose = require('mongoose');
mongoose.connect(process.env.DATABASE, {useNewUrlParser: true, useUnifiedTopology: true});
//--------

// Get notification if connection is successfull or if a connection error occurs
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', () => console.log("We're connected!")); 
//--------

// Set database schema and model
// 1- Set the schema
const StockSchema = new mongoose.Schema({
  'symbol': String,
  'likesIPs': [String]
});
// 2- Compile schema into model
const Stock = mongoose.model('Stock', StockSchema);
//--------

// Set routes

app.get('/', (req, res) => res.send("/public/index.html"));

app.get('/api/stock-prices', (req, res) => {

  let symbol = req.query.stock;
  let like = req.query.like;
  let ip = randomip('192.168.2.0', 24);
  // let ip = req.headers['x-forwarded-for'].split(',')[0] || req.connection.remoteAddress;
  // Function to return Stock Object

  const getStockQuery = (valsymbol) => {
    let query = Stock.findOne({'symbol': valsymbol}, (err, stock) => {
      if (err) return console.error(err);
      if (stock) {
        if (like === 'true' && !(stock['likesIPs'].includes(ip))) {
          stock['likesIPs'].push(ip);
          stock.save();
        }
      }
      else {
        let arr = like === 'true' ? [ip] : [];
        let stock = new Stock({'symbol': valsymbol, 'likesIPs': arr});
        stock.save();
      }
    });
    return query;
  }

  const singleStock = (val, price) => {
    let result;
    let query = getStockQuery(val);
    const returnStock = cb => {
      query.exec((err, stock) => {
        if (err) return console.error(err);
        result = {"stockData": {"stock": val, "price": price.toString(), "likes": stock['likesIPs'].length}};
        cb();
      });
    };
    returnStock(() => res.json(result));
  }

  const doubleStocks = (valOne, priceOne, valTwo, priceTwo) => {
    let result;
    let queryOne = getStockQuery(valOne);
    let queryTwo = getStockQuery(valTwo);
    const returnStock = cb => {
      queryOne.exec((err, stock) => {
        if (err) return console.error(err);
        let likesOne = stock['likesIPs'].length;
        queryTwo.exec((err, stock) => {
          if (err) return console.error(err);
          let likesTwo = stock['likesIPs'].length;
          result = {"stockData":[{"stock": valOne, "price": priceOne.toString(), "rel_likes": likesOne - likesTwo}, {"stock": valTwo, "price": priceTwo.toString(), "rel_likes": likesTwo - likesOne}]};
          cb();
        });
      });
    };
    returnStock(() => res.json(result))};
  //--------

  if (typeof symbol === 'string') {
    let url = 'https://repeated-alpaca.glitch.me/v1/stock/' + symbol + '/quote';
    fetch(url).then(response => response.json()).then(response => {
      if (response === 'Invalid symbol') {
        let n = like === 'true' ? 1 : 0 ;
        res.json({"stockData": {"error": "external source error", "likes": n}});
      }
      else singleStock(symbol, response['latestPrice']);
    }).catch(err => console.error(err));
  }
  else {
    let url = 'https://repeated-alpaca.glitch.me/v1/stock/' + symbol[0] + '/quote';
    fetch(url).then(response => response.json()).then(response => {
      if (response === 'Invalid symbol') res.json({"stockData":[{"error":"external source error","rel_likes":0},{"error":"external source error","rel_likes":0}]});
      else {
        let symbolOne = symbol[0];
        let priceOne = response['latestPrice'];
        let url = 'https://repeated-alpaca.glitch.me/v1/stock/' + symbol[1] + '/quote';
        fetch(url).then(response => response.json()).then(response => {
          if (response === 'Invalid symbol') res.json({"stockData":[{"error":"external source error","rel_likes":0},{"error":"external source error","rel_likes":0}]});
          else {
            let symbolTwo = symbol[1];
            let priceTwo = response['latestPrice'];
            doubleStocks(symbolOne, priceOne, symbolTwo, priceTwo);
          }
        });
      }
    });
  }
});

app.use((err, req, res, next) => res.status(500).send('Something broke!'));

app.use((req, res, next) => res.status(404).send('Sorry cant find that!'));

app.listen(3000);



