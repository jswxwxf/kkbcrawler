window.clickOnce = function (jqEl) {
  if (jqEl.size() <= 0) return;
  if (jqEl.data('clicked')) return;
  jqEl.attr('disabled', false).click();
  jqEl.data('clicked', true);
}

window.chunkString = function(str, len) {
  var _size = Math.ceil(str.length/len),
      _ret  = new Array(_size),
      _offset
  ;

  for (var _i=0; _i<_size; _i++) {
    _offset = _i * len;
    _ret[_i] = str.substring(_offset, _offset + len);
  }

  return _ret;
}

window.makeSignature = function()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

window.getValidationBase64 = function() {
  return getBase64Image($('img.pic_yzm')[0]);
}

window.decodeValidationImage = function() {
  var base64 = getBase64Image($('img#imgValidateCode')[0]);
  var chunks = chunkString(base64, 1000),
      sig = makeSignature();

  return new Promise((resolve, reject) => {
    chunks.forEach(function(chunk, index, chunks) {
      $.ajax({
        // crossDomain: true,
        url: 'http://114.215.189.125:8081/server.php',
        type: 'GET',
        // async: false,
        // contentType: 'application/json',
        data: { chunk, sig, index, length: chunks.length },
        // data: { filename },
        dataType: 'jsonp'
      }).done((data, status, jqXHR) => {
        console.log(data);
        if ((data || "").length == 4) {
          resolve(data);
        }
      }).fail((jqXHR, status, err) => {
        reject(err);
      });
    });
  })
  
}

window.getBase64Image= function(img) {
  // Create an empty canvas element
  var canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  // Copy the image contents to the canvas
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  // Get the data-URL formatted image
  // Firefox supports PNG and JPEG. You could check img.src to guess the
  // original format, but be aware the using "image/jpg" will re-encode the image.
  var dataURL = canvas.toDataURL("image/png");

  return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}
