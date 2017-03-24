var Nightmare = require('nightmare');
var faker = require('faker');
var path = require('path');
var rest = require('restler');
var _ = require('lodash');

var extractValidationCode = function(nightmare) {
  return new Promise((resolve, reject) => { 
    return nightmare
      .viewport(400, 700)
      .cookies.clearAll()
      .goto('http://www.yibaoxian.com/m/baojia')
      .inject('js', 'helper.js')
      .evaluate(() => getValidationBase64())
      .then(base64 => {
        rest.post('http://192.168.1.126:8081/server.php', { data: { base64 } }).on('complete', function(data, response) {
          resolve(data || '0');
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
      .click('#indexForm #cityName')
      .type('#city_select #searchText', vehicle.city_name)
      .click('#_auto_complete_list li:first-child')
      .evaluate(vehicle => {
        $('#indexForm #licenseNo').val(vehicle.license_no);
        $('#indexForm #ownerMobile').val(vehicle.owner_mobile);
        $('#indexForm #imgCode').val(vehicle.validationCode);
      }, vehicle)
      .wait(2000)
      .click('#indexSubmitBtn')
      .wait(() => {
        if ($('#expiredCar ._dialog_content h1').text()) return true;
        return $('#indexForm').size() == 0;
      })
      .evaluate(() => {
        if (location.pathname == '/m/baojia') {
          throw new Error($('#expiredCar ._dialog_content h1').text());
        }
        return location.pathname;
      });
  };
};

var vehicleForm = (vehicle) => {
  return nightmare => {
    nightmare
      .evaluate((vehicle) => {
        if ($('#vehicleForm input[name="ownerName"]:visible').size() > 0) {
          throw new Error('车辆信息不全');
        }
        if ($('#vehicleForm #searchCode').val() == '') {
          $('#vehicleForm #searchCode').click();
          setTimeout(() => $('#vehicleForm input[name="searchText"]').click(), 1000);
        }
        $('#vehicleForm input[name="ownerIdNo"]').val(vehicle.owner_id);
        setTimeout(() => {
          $('#_vehicle_model_div ._vehicle_li_box ul li:first-child').click();
          $('#submitForm').click();
        }, 3000);
      }, vehicle)
      .wait(() => $('#submitForm').size() == 0)
      .evaluate(() => location.pathname);
  };
};

var insuranceForm = vehicle => {
  return nightmare => {
    nightmare
      .inject('js', 'helper.js')
      .wait(1000)
      .evaluate(() => {
        $('#guideForm #cov_600').val('1000000');
        $('#guideForm #forceFlag').attr('checked', false);
      })
      .wait(1000)
      .evaluate(() => {
        // $('#insuranceChooseSubmit').attr('disabled', false).click();
        setInterval(() => {
          console.log('trying continue...');
          clickOnce($('#insuranceChooseSubmit'));
          $('#policyBeginDate #beginDateSubmit').click();
          $('#notifyDialog button[name="btnBizOnly"]').click();
        }, 2000);
      })
      // .wait(12000)
      .wait(() => {
        return $('#insuranceChooseSubmit').size() == 0;
      })
      .evaluate(() => {
        return location.pathname;
      });
  };
}

var resultPage = vehicle => {
  return nightmare => {
    nightmare
      .evaluate(() => {
        setTimeout(() => $('#policyBeginDate #beginDateSubmit').click() , 2000);
      })
      .wait(() => $('._img_loading').size() == 0)
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
    dock: true,
    openDevTools: {
      mode: 'detach'
    },
    show: true,
    waitTimeout: 1000 * 60 * 5,
    switches: {
      'proxy-server': proxy,
    }
  })
  .useragent(faker.internet.userAgent());
  // .authentication('frank_zhang521', 'hnkuafva')

  extractValidationCode(nightmare).then(validationCode => {
    vehicle.validationCode = validationCode;
    return nightmare.use(searchVehicle(vehicle))
      .then(pathname => {
        if (pathname == '/m/baojia/vehicle/input' || pathname == '/m/baojia/vehicle/channel') {
          return nightmare.use(vehicleForm(vehicle));
        }
        return pathname;
      })
      .then(pathname => {
        if (pathname == '/m/baojia/insure') {
          return nightmare.use(insuranceForm(vehicle));
        }
        return pathname;
      })
      .then(pathname => {
        if (pathname == '/m/baojia/forcePrice' || pathname == '/m/baojia/price') {
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
  })
    
};