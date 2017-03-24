var Nightmare = require('nightmare');
var faker = require('faker');
var path = require('path');
var rest = require('restler');
var _ = require('lodash');

var extractValidationCode = function(nightmare) {
  return new Promise((resolve, reject) => { 
    return nightmare
      .viewport(1200, 1000)
      .cookies.clearAll()
      .goto('http://www.yibaoxian.com/baojia')
      .inject('js', 'helper.js')
      // .click('#indexForm #cityName')
      // .type('#city_select #searchText', vehicle.city_name)
      // .click('#_auto_complete_list li:first-child')
      .evaluate(() => getValidationBase64())
      .then(base64 => {
        rest.post('http://192.168.1.126:8081/server.php', { data: { base64 } }).on('complete', function(data, response) {
          resolve(_.padEnd(data, 4, '0'));
        });
      }).catch(err => {
        reject(err);
      });
  });
}

var searchVehicle = (vehicle) => {
  return nightmare => {
    nightmare
      .inject('js', 'helper.js')
      // .click('#indexForm #cityName')
      // .type('#city_select #searchText', vehicle.city_name)
      // .click('#_auto_complete_list li:first-child')
      .evaluate(vehicle => {
        $('.car-form #cityCode').val('310100');
        $('.car-form #cityName').val('上海');
        $('.car-form #carId').val(vehicle.license_no);
        $('.car-form #ownerMobile').val(vehicle.owner_mobile);
        $('.car-form #imgCode').val(vehicle.validationCode);
      }, vehicle)
      .wait(2000)
      .click('.car-form ._price_button')
      .wait(() => {
        if ($('#getInfoFail:visible').size() > 0) {
          var err = $('#getInfoFail:visible ._autohome_prompt_txt span').text();
          // if (err == '验证码未验证通过') return false;
          return true;
        }
        // if ($('#expiredCar ._dialog_content h1').text()) return true;
        // return $('.car-form').size() == 0;
        return location.pathname != '/baojia';
      })
      .evaluate(() => {
        if ($('#getInfoFail:visible').size() > 0) {
          throw new Error($('#getInfoFail:visible ._autohome_prompt_txt span').text());
        }
        // if (location.pathname == '/m/baojia') {
        //   throw new Error($('#expiredCar ._dialog_content h1').text());
        // }
        return location.pathname;
      });
  };
};

var vehicleForm = (vehicle) => {
  return nightmare => {
    nightmare
      .evaluate((vehicle) => {
        if ($('._fill_details_left input[name="ownerName"]:visible').size() > 0) {
          throw new Error('车辆信息不全');
        }
        // if ($('#vehicleForm #searchCode').val() == '') {
        //   $('#vehicleForm #searchCode').click();
        //   setTimeout(() => $('#vehicleForm input[name="searchText"]').click(), 1000);
        // }
        $('#appendInfoForm #ownerIdNo').val(vehicle.owner_id);
        setInterval(() => {
          $('#ibear-vehicleChooser-tbody tr:first').click();
          // $('#_vehicle_model_div ._vehicle_li_box ul li:first-child').click();
          $('#appendInfoForm ._fill_button button').click();
        }, 3000);
      }, vehicle)
      // .click('#appendInfoForm ._fill_button button')
      .wait(() => location.pathname != '/baojia/vehicle/input')
      .evaluate(() => location.pathname);
  };
};

var insuranceForm = vehicle => {
  return nightmare => {
    nightmare
      .inject('js', 'helper.js')
      .wait(1000)
      .click('._insurance_details .JS_cov_600')
      .click('#sanzheListContent ._insurance_choose label._insurance_buji._radio')
      .click('#customInsere #forceFlag')
      .evaluate(() => clickOnce($('#customSubmit')))
      .wait(3000)
      // .click('#customSubmit')
      // .evaluate(() => {
      //   $('#customInsere #forceFlag').attr('checked', false)
      // })
      .evaluate(() => {
        // $('#insuranceChooseSubmit').attr('disabled', false).click();
        setInterval(() => {
          console.log('trying continue...');
          $('#policyBeginDate #beginDateSubmit').click();
          $('.mobile_gl .biz_only').click();
        }, 2000);
      })
      .wait(() => location.pathname != '/baojia/insure')
      .evaluate(() => {
        return location.pathname;
      });
  };
}

var resultPage = vehicle => {
  return nightmare => {
    nightmare
      .wait(1000)
      .evaluate(() => {
        if ($('#PRICE_FAILD:visible').size() > 0) {
          throw new Error($('#PRICE_FAILD p').text());
        }
        // setTimeout(() => $('#policyBeginDate #beginDateSubmit').click() , 2000);
      })
      .wait(() => $('._loading_img').size() == 0)
      .html(`results/${vehicle.license_no}.html`)
  };
};

var killNightmare = nightmare => {
  nightmare.proc.disconnect();
  nightmare.proc.kill();
  nightmare.ended = true;
}

module.exports = (vehicle, proxy, next) => {

  var nightmare = Nightmare({
    // dock: true,
    // openDevTools: {
    //   mode: 'detach'
    // },
    // show: true,
    waitTimeout: 1000 * 60 * 5,
    // webPreferences: { 
    //   webSecurity: false 
    // },
    switches: {
      'proxy-server': proxy,
    }
  })
  .useragent(faker.internet.userAgent())
  .authentication('frank_zhang521', 'hnkuafva');

  extractValidationCode(nightmare).then(validationCode => {
    vehicle.validationCode = validationCode;
    return nightmare.use(searchVehicle(vehicle))
      .then(pathname => {
        if (pathname == '/baojia/vehicle/input' || pathname == '/baojia/vehicle/channel') {
          return nightmare.use(vehicleForm(vehicle));
        }
        return pathname;
      })
      .then(pathname => {
        if (pathname == '/baojia/insure') {
          return nightmare.use(insuranceForm(vehicle));
        }
        return pathname;
      })
      .then(pathname => {
        if (pathname == '/baojia/forcePrice' || pathname == '/baojia/price') {
          return nightmare.use(resultPage(vehicle));
        }
        return pathname;
      })
      .then(pathname => {
        killNightmare(nightmare);
        next();
      });
  })
  .catch(err => {
    killNightmare(nightmare);
    next(err);
  });

    
};