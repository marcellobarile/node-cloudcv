var fs              = require('fs')
var debug           = require('debug')('CloudCv.Utils')

module.exports = {
  encodeBase64Image: function(buff, ext) {
    return 'data:image/'+ext+';base64,' + buff.toString('base64')
  },
  decodeBase64Image: function(dataString) {
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    var response = {}
    if (null == matches || matches.length !== 3) {
      throw new Error('Invalid input string')
    }
    response.type = matches[1]
    response.data = new Buffer(matches[2], 'base64')
    return response
  },
  saveImageData: function(files, onFileCb, onErrorCb) {
    for (var i in files) {
      var fileName = String(new Date().getTime()) + String(Math.floor(Math.random() * 9999)) + '.jpg'
      var destPath = global.uploadDir + fileName
      var imageData = files[i]
      var imageBuffer = this.decodeBase64Image(imageData)
      fs.writeFileSync(destPath, imageBuffer.data)
      if (typeof onFileCb == 'function') onFileCb(destPath)
    }
    return true
  },
  getFilesFromRequest: function(req) {
    var areImagedata = this.areImagedata(req)
    if (areImagedata) return req.body

    var keys = Object.keys(req.files)
    if (typeof keys[0] == 'string') {
      if (Object.prototype.toString.call(req.files[keys[0]]) === '[object Array]') {
        // it's an array
        return req.files[keys[0]]
      } else {
        // it's an object but we need an array
        return [req.files[keys[0]]]
      }
    } else return req.files
  },
  areImagedata: function(req) {
    return !Object.keys(req.files).length || Object.keys(req.files).length <= 0
  }
}