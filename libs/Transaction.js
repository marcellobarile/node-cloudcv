var self

function Transaction(method) {
  self = this
  this.method = method
  this.jobId = null
  this.jobInfo = {}
  this.output = null
}

module.exports = Transaction