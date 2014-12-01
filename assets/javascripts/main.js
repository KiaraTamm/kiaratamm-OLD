// File test to see if a file has been included or not.
function UrlExists(filePath)
{
  $.ajax({
      url: filePath,
      type:'HEAD',
      error: function()
      {
          //file does not exist
          //console.log('File not found: ' + filePath);
      },
      success: function()
      {
          //file exists
      }
  });
}

$.each(bots, function(value) {

  var botExchange = (this).substring(8);
  var exchangeID = '#' + botExchange;

  //clone the '#market' element template
  var market = document.getElementById('market'),
      clone = market.cloneNode(true); // true means clone all childNodes and all event handlers
  clone.id = botExchange;
  var marketWrapper = document.getElementById('marketlist');
  marketWrapper.appendChild(clone);

// GET MARKET INFORMATION FROM OPTIONS FILE
//
  var marketpair = this + "/options.json";
  UrlExists(marketpair);

  $.getJSON( marketpair, function(data) { 
    
    //populate information about the exchange and bot setup
    var exch = data["options"].exchangename;
    var exchangeName = exch.toUpperCase();
    var pair = data["options"].pair;
    switch( pair ) {
      case 'nbt_ppc': 
        pairName = "NBT/PPC";
        break;
      case 'nbt_btc':
        pairName = "NBT/BTC";
        break;
      case 'nbt_usd':
        pairName = "NBT/USD";
        break;
      case 'nbt_eur':
        pairName = "NBT/EUR";
        break;
      default:
      pairName = "A new market, please inform ben @ cryptoassure.com of this change so the reporting tool can be updated.";
    }
    $(exchangeID + " .exchange_name").text(exchangeName + ': ');
    $(exchangeID + " .pair_name").text(pairName);

    var custType = data["options"].dualside;
    var grantAddr = data["options"].nubitaddress;
    if( custType === true ) {
      $(exchangeID + " .type").text('Dual Side');
    } else {
      $(exchangeID + " .type").text('Liquidity Provider');
    }

    $(exchangeID + " .grant_address").text('Grant Address: ' + grantAddr)

    //generate a link to the sanitized options settings
    var marketOptionsLink = marketpair;
      $(exchangeID + " .options_link").html('<a href="' + marketOptionsLink +'" target="_new">NuBot Market Configuration</a>');
  });

// GET CURRENT ORDERS
//
  var order_path = this + "/latest_orders_history.json";
  var order_data = this + "/orders_history.csv";
  var shift_path = this + "/latest_wall_shifts.json";
  var shift_data = this + "/wall_shifts.csv";

  sumOverSellOrders = 0;
  sumOverBuyOrders = 0;

  $.getJSON( order_path, function(orders) {
        var digest = orders[0].digest;
        var matched_orders = digest.match( /\w+\s\d+.\d+@\d+.\d+/g );
        var ordersLength = matched_orders.length;
        for(var i = 0; i < ordersLength; i++) {
          var order = matched_orders[i].replace("@", " @ ");
          var orderSections = order.split(" ");
          var orderType = orderSections[0];
          var orderAmountNBT = parseFloat(orderSections[1]);
          var orderPrice = orderSections[3];
          var orderAmountEXCH = orderAmountNBT * orderPrice;
          var exchCurrLabel = botExchange.substr(botExchange.length - 3).toUpperCase();
          $(exchangeID + " .current_orders .exchange_currency").text('(' + exchCurrLabel + ')');

          //add class of 'buy' or 'sell' to table cell for ease of selection
          //later when calculating the overview of managed funds
          var classedOrderAmount = "";
          if( orderType == 'BUY' ) {
            classedOrderAmount = '</td><td class="amount buy">';
            sumOverBuyOrders += orderAmountNBT;
            sessionStorage.setItem("overviewBuyOrders", sumOverBuyOrders);

          } else {
            classedOrderAmount = '</td><td class="amount sell">';
            sumOverSellOrders += orderAmountNBT;
            sessionStorage.setItem("overviewSellOrders", sumOverSellOrders);
          }

          //order lines
          $(exchangeID + ' table.current_orders').addClass('hasdata').append('<tr><td>'+ orderType  + '</td><td>' + orderPrice + classedOrderAmount + orderAmountNBT +'</td><td>' + orderAmountEXCH + '</tr>');

        }
        $('table#' + botExchange + '_orders').append('</table>');

      //generate a link to the raw order data
      var orderDataLink = order_data;
        $(exchangeID + " .order_data_link").html('<a href="' + orderDataLink +'" target="_new">Order data for current bot session</a>');
    
  });

    // Parse the 'last_wall_shifts.json' files to assemble data
    // for reporting about the current exchange rates
    $.getJSON( shift_path, function(wallShifts) {

      //generate a link to the raw wall shift data
      var wallShiftDataLink = shift_data;
        $(exchangeID + " .wall_shift_data_link").html('<a href="' + wallShiftDataLink +'" target="_new">Wall shifts for current bot session</a>');

    });

// GET TRADE DATA
//

  var tradesLastDay = this + "/trades_lastday.json";
  var tradesLastWeek = this + "/trades_lastweek.json";
  var tradesLastThirtyDays = this + "/trades_last30days.json";
  var tradesAllTime = this + "/trades_alltime.json";
  countBuy = 0;
  countSell = 0;

  var tradeIterations = [ tradesLastDay, tradesLastWeek, tradesLastThirtyDays, tradesAllTime ];

  $.each(tradeIterations, function(value) {

    var iteration = this;
    var tradeIteration = this.split("/")[3];
    var tradeRange = tradeIteration.substring(0, tradeIteration.length - 5);

    $.getJSON( iteration, function(trades) {

        //get the array with the list of names (Trade_8090 , Trade_8091,  ...)
        var names = Object.keys(trades);
        
        //init the sums to 0, init the count ("i") to 0
        var totalSales = 0;
        var sumBuy = 0;
        var sumBuyFee = 0;
        var sumSell = 0;
        var sumSellFee = 0;
        var totalFee = 0;
        var countBuy = 0;
        var countSell = 0;
        var sumSellPrice = 0;
        var sumBuyPrice = 0;

        var setDecimals = 0;

        var timestamps = [];
        var buyPrices = [];
        var sellPrices = [];

        //iterate through the list of names
        for (var i = 0; i < names.length; i++) {
          //get the temporary name of trade
          var tempTradeName = names[i];
          //get the corresponding object
          var tempTradeObject = trades[tempTradeName];

          if( tempTradeObject.type === 'BUY') {
            //iterate over the BUY side totals and calculate the sum
            sumBuy += tempTradeObject.amount;
            sumBuyFee += tempTradeObject.fee;
            sumBuyPrice += tempTradeObject.price;
            buyPrices += tempTradeObject.price + ',';
            ++countBuy;
          } else {
            //iterate over the SELL side totals and calculate the sum
            sumSell += tempTradeObject.amount;
            sumSellFee += tempTradeObject.fee;
            sumSellPrice += tempTradeObject.price;
            sellPrices += tempTradeObject.price + ',';
            ++countSell;
          }
          //sanity check
          totalSales += tempTradeObject.amount;
          totalFee += tempTradeObject.fee;

          //build an array of the timestamps
          timestamps += tempTradeObject.timestamp + ',';

          //get the trade currency
          var exchCurr = tempTradeObject.pair;
          var exchCurrLabel = exchCurr.slice(3).toUpperCase();

          //set the decimal places for rounding based on the exchange currency
          //var setDecimals = 0;
          switch( exchCurrLabel ) {
              case 'PPC': 
                setDecimals = 6;
                break;
              case 'BTC':
                setDecimals = 8;
                break;
              case 'NBT':
                setDecimals = 4;
                break;
              case 'EUR':
                setDecimals = 4;
                break;
              case 'USD':
                setDecimals = 4;
                break;
              default:
                setDecimals = 4;
                break;
            }     
          }

          //build an array of the buy prices and sort them from
          //lowest to highest, to get the range
          buyPrices = buyPrices.split(",");
          buyPrices.sort(function(a,b){
            return a - b;
          });

          //build an array of the sell prices and sort them
          //from lowest to highest, to get the range
          sellPrices = sellPrices.split(",");
          sellPrices.sort(function(a,b){
            var va = (a === null) ? "" : "" + a,
                vb = (b === null) ? "" : "" + b;
            return va > vb ? 1 : ( va === vb ? 0 : -1 );
          });


          //find the earliest and latest timestamps in the 'timestamps' array
          timestamps = timestamps.split(",");
          timestamps.sort(function(a,b){
            var va = (a === null) ? "" : "" + a,
                vb = (b === null) ? "" : "" + b;
            return va > vb ? 1 : ( va === vb ? 0 : -1 );
          });

          //results
          var rndSumSell = parseFloat(sumSell).toFixed(4);
          var rndSumSellFee = parseFloat(sumSellFee).toFixed(4);
          var rndSumBuy = parseFloat(sumBuy).toFixed(4);
          var rndSumBuyFee = parseFloat(sumBuyFee).toFixed(4);

          //determine averages
          var avgSell = parseFloat(sumSell / countSell).toFixed(4);
          var avgBuy = parseFloat(sumBuy / countBuy).toFixed(4);
          var avgSellPrice = parseFloat(sumSellPrice / countSell).toFixed(setDecimals);
          var avgBuyPrice = parseFloat(sumBuyPrice / countBuy).toFixed(setDecimals);

          //populate buy order table
          var lowBuyPrice = 0;
          lowBuyPrice = buyPrices[1];
          lowBuyPrice = parseFloat(lowBuyPrice).toFixed(setDecimals);
          var highBuyPrice = 0;
          highBuyPrice = buyPrices[buyPrices.length-1];
          highBuyPrice = parseFloat(highBuyPrice).toFixed(setDecimals);

          $(exchangeID + " table." + tradeRange + "_buy").addClass('hasdata').append('<tr><td>' + countBuy + '</td><td>' + rndSumBuy + '</td><td>' + rndSumBuyFee + '</td><td>' + avgBuy + '</td><td>' + avgBuyPrice + '<td>' + lowBuyPrice + '&ndash;' + highBuyPrice + '</td></tr>');

          //populate sell order table
          var lowSellPrice = sellPrices[1];
          lowSellPrice = parseFloat(lowSellPrice).toFixed(setDecimals);
          var highSellPrice = sellPrices[sellPrices.length-1];
          highSellPrice = parseFloat(highSellPrice).toFixed(setDecimals);

          $(exchangeID + " table." + tradeRange + "_sell").addClass('hasdata').append('<tr><td>' + countSell  + '</td><td>' + rndSumSell + '</td><td>' + rndSumSellFee +'</td><td>' + avgSell + '</td><td>' + avgSellPrice + '<td>' + lowSellPrice + '&ndash;' + highSellPrice + '</td></tr>');

          //construct trade data links
          var tradeDataLink = "";
          switch( tradeRange ) {
              case 'trades_lastday': 
                tradeDataLink = tradesLastDay;
                tradeDataLinkLabel = "Last Day's Trade Data";
                break;
              case 'trades_lastweek':
                tradeDataLink = tradesLastWeek;
                tradeDataLinkLabel = "Last Week's Trade Data";
                break;
              case 'trades_last30days':
                tradeDataLink = tradesLastThirtyDays;
                tradeDataLinkLabel = "Last 30 Day's Trade Data";
                break;
              case 'trades_alltime':
                tradeDataLink = tradesAllTime;
                tradeDataLinkLabel = "Trade Data for All Time";
                break;
              default:
                tradeDataLink = "";
                tradeDataLinkLabel = "";
                break;
            }

          //populate template link element
          $(exchangeID + " li." + tradeRange + "_data_link").html('<a href="' + tradeDataLink + '" target="_new">' + tradeDataLinkLabel + '</a>');
          console.log(tradeDataLink);

      });

  });

});

// CALCULATE OVERVIEW TABLES

//dividend information
var dividendDetails = "../data/dividends.json";
var sumDividends = 0;

$.getJSON( dividendDetails, function(dividend) {

    var names = Object.keys(dividend);

    var tempDivName = names[0];
    var tempDivObject = dividend[tempDivName];

    for (var i = 0; i < tempDivObject.length; i++) {
      var divObject = tempDivObject[i];

      var divAmount = divObject.amount;
      sumDividends += divAmount;
    }
    
    sessionStorage.setItem("sumDividends", sumDividends);

});

//off-exchange holdings
var offExchangeDetails = "../data/off-exchange.json";
var sumHoldings = 0;
$.getJSON( offExchangeDetails, function(holding) {

    var names = Object.keys(holding);

    var tempHoldingName = names[0];
    var tempHoldingObject = holding[tempHoldingName];

    for (var i = 0; i < tempHoldingObject.length; i++) {
      var holdingObject = tempHoldingObject[i];

      var holdingAmount = holdingObject.amount;
      sumHoldings += holdingAmount;
    }
    
    sessionStorage.setItem("offExchangeHoldings", sumHoldings);

});

//overview calculations from base grant
var grantDetails = "../data/grant-information.json";
$.getJSON( grantDetails, function(data) {

  var grantAmount = data["grant"].amount;
  sessionStorage.setItem("grantAmount", grantAmount);
  var grantFee = data["grant"].custodianfee;
  sessionStorage.setItem("custodianFee", grantFee);
  var custodianName = data["grant"].custodian_name;
  var custodianLink = data["grant"].forum_account;
  $('.custodian_name').html( '<a href="' + custodianLink + '" target="_new">' + custodianName + '</a>' );
});

var startingValue = parseFloat(sessionStorage.getItem("grantAmount"));
$(".original_grant").text(startingValue + " NBT");

var custFee = parseFloat(sessionStorage.getItem("custodianFee"));
$('.custodial_fee').text( custFee + ' NBT' );
$('.fee_percentage').text( '(' + ((custFee / (startingValue - custFee)) * 100).toFixed(2) + '%)' );

var divPaid = parseFloat(sessionStorage.getItem("sumDividends"));
$('.dividends_paid').text( divPaid + " NBT" );

var activeExchange = ( parseFloat(sessionStorage.getItem("overviewBuyOrders")) + parseFloat(sessionStorage.getItem("overviewSellOrders")) );
var activeOffExchange = parseFloat(sessionStorage.getItem("offExchangeHoldings"));
var totalFundsOnHand = activeExchange + activeOffExchange;
$('.funds_on_hand').text( totalFundsOnHand.toFixed(4)  + ' NBT');

var holdingsRatio = ( (totalFundsOnHand / (startingValue - custFee - divPaid) ) * 100);
$(".percent_grant").text(holdingsRatio.toFixed(2) + "%");

//sum current orders to calculate total managed
//sell-side and buy-side assets

//on-exchange
$("#overview table.managed_funds").append('<tr><td class="left">Exchange Holdings</td><td class="right">' + sessionStorage.getItem('overviewSellOrders') + '</td><td class="right">' + sessionStorage.getItem("overviewBuyOrders") + '</td></tr>');

//off-exchange
$("#overview table.managed_funds").append('<tr><td class="left">Off-Exchange Holdings</td><td class="right">' + sessionStorage.getItem('offExchangeHoldings') + '</td><td class="right"></td></tr>');

//off-exchange, non-NBT holdings
// TODO: Need to set up a new python script to capture the withholding .json file from each bot and add it to the data directory
// TODO: Add code to sum the witholdings with any additional non-NBT holdings that can be pulled in from a separate file.
//$("#overview table.managed_funds").append('<tr><td class="left">Dividend Withholdings</td><td class="right">' + sessionStorage.getItem('overviewSellOrders') + '</td><td class="right">' + sessionStorage.getItem("overviewBuyOrders") + '</td></tr>');

//dividends paid
$("#overview table.managed_funds").append('<tr><td class="left">Dividends Paid</td><td class="right">' + sessionStorage.getItem('sumDividends') + '</td><td class="right"></td></tr>');

//totals
$("#overview table.managed_funds").append('<tr class="grand_total"><td class="left">Grand Total</td><td class="right">' + totalFundsOnHand + '</td><td class="right"></td></tr>');

//update published time
var writePubTimeClean = writePubTime.substr(0, writePubTime.length-7);
$('#update_time').text(writePubTimeClean + " GMT");

// remove the original template
$('#market').hide();
