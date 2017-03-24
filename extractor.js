#!/usr/bin/env node
var fs = require('fs');
var glob = require('glob');
var _ = require('lodash');
var $ = require('cheerio');
var csv = require('fast-csv');

var companyMapping = {
    'TPIC': '中国太平',
    'TP': '安盛天平',
    'CCIC': '大地',
    'ZH': '中华'
}

var csvStream = csv.createWriteStream({ headers: true }),
    writableStream = fs.createWriteStream("extracted.csv");
csvStream.pipe(writableStream);

var retryStream = csv.createWriteStream({headers: true}),
    writableRetryStream = fs.createWriteStream("retry.csv");
retryStream.pipe(writableRetryStream);

csv.fromPath("vehicles.csv", { headers: true })
  .transform((data, next) => {
    var vehicle = data;
    vehicle['保险到期日'] = '';
    vehicle['中国太平'] = '';
    vehicle['中华'] = '';
    vehicle['车辆信息不全'] = 0;
    glob("results/" + data['车牌'] + "*", {nodir: true}, (err, files) => {
        if (files.length == 0) {
            console.log(data['车牌'] + " 没有找到");
            csvStream.write(vehicle);
            retryStream.write(vehicle);
        } else {
            if (_.some(files, (f) => f == ('results/' + data['车牌'] + '.html'))) {
                var content = fs.readFileSync('results/' + data['车牌'] + '.html', 'utf8');
                $(content).find('li._price_success').each((index, el) => {
                    vehicle[companyMapping[$(el).find('input[name=companyCode]').val()]] = $(el).find('input[name=totalPreminum]').val() / 100;
                    vehicle['保险到期日'] = /\d{4}-\d{2}-\d{2}/.exec($(content).find('.price_fail .errorMsg').text());
                    // console.log("保险公司：" + );
                    // console.log("总价：" + $(el).find('input[name=totalPreminum]').val() / 100);
                    // $(el).find('._xianlist_info').each((index, el) => {
                    //     console.log("险种：" + $(el).find('._xianlist_info_left').text() + ' 保额：' + $(el).find('._xianlist_info_center').text())
                    //     console.log("价格：" + $(el).find('._xianlist_info_right').text())
                    // })
                })
            }
            if (_.some(files, (f) => f.endsWith('车辆信息不全'))) {
                vehicle['车辆信息不全'] = 1;
            }
            csvStream.write(vehicle);
        }
    });
    next();
  })
  .on('end', () => {
    csvStream.end();
  });