// ==UserScript==
// @name        test
// @namespace   fireipc
// @description Test fireipc
// @include     http://localhost:8000/
// @grant GM_setValue
// @grant GM_getValue
// @version     1
// ==/UserScript==

var fipc_config = {"secret": null};

function get_sender(){
  var script = GM_info["script"];
  var name = script.name;
  var namespace = script.namespace;
  return namespace + "/" + name;
}

function fipc_emit(name, msg) {
  var ev = CustomEvent(name, {"detail":{
    "sender": get_sender(),
    "msg": msg
  }});
  document.dispatchEvent(ev);
}

function fipc_listen(name, callback, filter_mine) {
  document.addEventListener(name, function(event) {
    var detail = event.detail;
    if(filter_mine && detail.sender == get_sender()) return;
    callback(detail);
  });
}

function check_setup() {
  if(fipc_config.secret == null) {
    console.log("FireIPC setup not ready!");
    return false;
  }
  return true;
}
function emit(msg) {
  if (check_setup())
    fipc_emit("fireipc_" + fipc_config.secret, msg);
}

function listen(callback) {
  if (check_setup())
    fipc_listen("fireipc_" + fipc_config.secret, callback, true);
}

function setupFireIPC(callback) {
  var script = GM_info["script"];
  var name = script.name;
  var namespace = script.namespace;
  var nonce = Math.random().toString(36).substr(2);

  fipc_listen("fireipc_handshake", function(detail) {
    var uuid = GM_getValue("handshake_uuid", null);
    if(uuid == null) {
      console.log("UUID is not set, invalid handshake");
      callback(false);
      return;
    }
    fipc_config.secret = uuid;

    callback(true);
  }, true);

  // set a nonce in fipc_config only to let the addon know this session is real
  GM_setValue("handshake_" + nonce, true);

  fipc_emit("fireipc_handshake", {
    "name": name,
    "namespace": namespace,
    "nonce": nonce
  });
}

// Usage
setupFireIPC(function(ready){
  if(!ready){
    console.log("Somthing goes wrong!");
    return
  }
  listen(function(msg){
    console.log(msg);
  })
  emit({"data": "hello world!"});
});
