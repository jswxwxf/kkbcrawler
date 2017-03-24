var fs = require('fs');
var csv = require('fast-csv');
var jsonfile = require('jsonfile');
var request = require('sync-request');
var winston = require('winston');
var moment = require('moment');
var program = require('commander');
var faker = require('faker');
var IDValidator = require('id-validator');

faker.locale = "zh_CN";
var idValidator = new IDValidator();

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)(),
    new (winston.transports.File)({ filename: 'baojia.log' })
  ]
});

var baojia = require('./baojiam.js');

var csvStream = csv.createWriteStream({ headers: true }),
    writableStream = fs.createWriteStream("failed.csv");

csvStream.pipe(writableStream);

writableStream.on("finish", function(){
  logger.info("DONE!");
});

function getProxy() {
  // return '123.207.152.39:16323';
  var res = request('GET', 'http://192.168.1.126:4567/');
  // var res = request('GET', 'http://114.215.189.125:4567/');
  var proxy = res.getBody('utf8');
  logger.info('using proxy:' + proxy);
  return proxy;
}

function getMobile() {
  var prefixArray = new Array("130", "131", "132", "133", "135", "137", "138", "170", "187", "189");
  var i = parseInt(10 * Math.random());
  var prefix = prefixArray[i];
  for (var j = 0; j < 8; j++) {
    prefix = prefix + Math.floor(Math.random() * 10);
  }
  return prefix;
}

program.parse(process.argv);
var file = program.args[0] || 'vehicles.csv';

var proxy = getProxy(); // '140.255.231.160:25097'

var statusFile = 'status.json';
var status = jsonfile.readFileSync(statusFile);
var count = status.count || 0;
var cursor = 0;

csv.fromPath(file, { headers: true })
  .transform((data, next) => {

    cursor++;
    if (cursor <= count) return next();
    if (fs.existsSync('results/' + data['车牌'].toUpperCase() + '.html')) {
      logger.info(`${data['车牌'].toUpperCase()} 已经报价成功`);
      return next();
    }

    var vehicle = {
      city_name: '上海',
      license_no: data['车牌'].toUpperCase(),
      owner_mobile: getMobile(),
      license_owner: faker.name.firstName() + faker.name.lastName(),
      owner_id: idValidator.makeID(),
      // city_code: '110100',
      vehicle_name: data['车型'],
      frame_no: 'LS5A3ADE1CB055368',
      engine_no: 'WP0AB309',
      enroll_date: '2016-07-14',
      seat_count: 5
    };

    logger.info(`${count + 1} - ${moment().format('YYYY-MM-DD hh:mm:ss')} : ${vehicle.license_no} 报价中……`);

    var retry = 1;

    (function _baojia() {

      baojia(vehicle, proxy, (err) => {
        if (err) {
          logger.error(err);
          if (retry > 0) {
            logger.error(`重试 - ${moment().format('YYYY-MM-DD hh:mm:ss')}`);
            proxy = getProxy();
            retry--;
            return _baojia();
          }
          jsonfile.writeFileSync(`results/${vehicle.license_no} - ${err.message || err}`, err);
          csvStream.write(vehicle);
          proxy = getProxy(); // next proxy if error.
        }
        jsonfile.writeFileSync(statusFile, { count: ++count });
        next();
      });

    })();


  })
  .on('end', () => {
    logger.info('报价结束');
    csvStream.end();
  });

