const debug = require('debug')('Tests.basic')
const request = require('request')
const fs = require('fs')
const CloudCv = require('../libs/CloudCv')
const cloudcv = new CloudCv()

request.get({url: 'http://images.corriere.it/Media/Foto/2012/03/30/Leonardo_A.jpg', encoding: 'binary'}, function onPreviewImage(err, response, body) {
  var dest = __dirname + '/tmp/test.jpg'
  if (err) {
    debug('On preview image err:', self.err)
  } else {
    fs.writeFile(dest, body, 'binary', function(err) {
      cloudcv.classify([{'path': dest}], false, function onClassify(res, err) {
        if (err) {
          debug( err )
          return
        }
        debug(' >>> ON CLASSIFY >>>')
        debug( res )
        return
      })
    })
  }
})
