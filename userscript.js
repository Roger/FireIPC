// ==UserScript==
// @name        FireIPC userscript test
// @namespace   fireipc
// @description Test fireipc
// @include     http://localhost:8000/
// @include     http://localhost/
// @grant GM_setValue
// @grant GM_getValue
// @version     1
// ==/UserScript==

function FireIPC(alias) {
  var script = GM_info["script"];
  this.sender = script.namespace + "/" + (alias || script.name);
  this.secret = null;
}

FireIPC.prototype._emit = function(name, msg) {
  var ev = CustomEvent(name, {"detail":{
    "sender": this.sender,
    "msg": msg
  }});
  document.dispatchEvent(ev);
}

FireIPC.prototype._listen = function(name, callback, filter_mine) {
  var that = this;
  document.addEventListener(name, function(event) {
    var detail = event.detail;
    if(filter_mine && detail.sender == that.sender) return;
    callback(detail);
  });
}


FireIPC.prototype.check_setup = function() {
  if(this.secret == null) {
    console.log("FireIPC setup not ready!");
    return false;
  }
  return true;
}

FireIPC.prototype.emit = function(msg) {
  if (this.check_setup())
    this._emit("fireipc_" + this.secret, msg);
}

FireIPC.prototype.listen = function(callback) {
  if (this.check_setup())
    this._listen("fireipc_" + this.secret, callback, true);
}

FireIPC.prototype.setup = function(callback) {
  var script = GM_info["script"];
  var name = script.name;
  var namespace = script.namespace;
  var nonce = Math.random().toString(36).substr(2);
  var that = this;
  this._listen("fireipc_handshake", function(detail) {
    var uuid = GM_getValue("fireipc_handshake_uuid", null);
    if(uuid == null) {
      console.log("UUID is not set, invalid handshake");
      callback(false);
      return;
    }
    that.secret = uuid;

    callback(true);
  }, true);

  // set a nonce in the config only to let the addon know this session is real
  GM_setValue("fireipc_handshake_" + nonce, true);

  this._emit("fireipc_handshake", {
    "name": name,
    "namespace": namespace,
    "nonce": nonce
  });
}

// Usage
var fipc = new FireIPC("test_alias");
fipc.setup(function(ready){
  if(!ready){
    console.log("Something goes wrong!");
    return
  }
  fipc.listen(function(msg){
    console.log(msg);
  })
  fipc.emit({"message": "hello world!"});
});
