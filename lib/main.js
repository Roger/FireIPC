"use strict";

const pref = require("sdk/preferences/service");

const {Cu,Cc,Ci} = require("chrome");
const tabs = require("sdk/tabs");
const {NetUtils} = Cu.import("resource://gre/modules/NetUtil.jsm");

const data = require('self').data;

const PORT_NUMBER = 61155;

var serverSocket = null;

exports.main = function() {
  var workers = [];
  var outputs = [];

  tabs.on("ready", function(tab){
    var worker = tab.attach({
      contentScriptFile: (data.url('functions.js')),
    });
    workers.push(worker);

    worker.port.on("handshake", function(detail){
      var nonce = detail.msg.nonce;
      var name = detail.msg.name;
      var namespace = detail.msg.namespace;
      var gm_pref = "extensions.greasemonkey.scriptvals." + namespace + "/" + name + ".fireipc_handshake";
      var gm_nonce = gm_pref + "_" + nonce;

      var gm_data = pref.get(gm_nonce, false);
      if(gm_data) {
        pref.reset(gm_nonce);
        var uuid = pref.get(gm_pref+"_uuid", null);
        if(uuid == null) {
          var uuid = require('sdk/util/uuid').uuid().toString();
          pref.set(gm_pref+"_uuid", uuid);
        }

        // Start listening user script messages
        worker.port.on("fireipc_send", function(message){
          console.log("US_msg", message.name, message.uuid, message.detail.msg);
          var data = JSON.stringify({
            "data": message.detail.msg,
            "sender": message.detail.sender
          }) + "\n";

          for(var i in outputs){
            try {
              outputs[i].write(data, data.length);
            } catch(e) {
              console.log("Error" + e.result + ": " + e.message);
            }
          }
        });

        worker.port.emit("handshake_accept", {"name": name, "uuid": uuid});
      }
    });
  });

  try  {
    serverSocket = Cc["@mozilla.org/network/server-socket;1"]
            .createInstance(Ci.nsIServerSocket);
    serverSocket.init(PORT_NUMBER, true, -1);

    serverSocket.asyncListen(
      {
        onSocketAccepted: function(server, transport) {
          var outstream = transport.openOutputStream(0, 0, 0);
          var instream = transport.openInputStream(null, 0, 0);

          var out = "Connected\n";
          outstream.write(out, out.length);
          outputs.push(outstream);

          var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(
            Ci.nsIInputStreamPump);
          pump.init(instream, -1, -1, 0, 0, false);

          pump.asyncRead(
            {
            onStartRequest: function(request, context) {
              dump("Start!\n");
            },
            onStopRequest: function(request, context, result) {
              dump("Stop!\n");
            },
            onDataAvailable: function (request, context, stream, offset, count){
                var data = NetUtil.readInputStreamToString(stream, count);
                dump("DATA: " + data);

                try {
                  data = JSON.parse(data);
                } catch(e) {
                  console.log("Error" + e.result + ": " + e.message);
                }

                for(var i in workers){
                  var worker = workers[i];
                  try {
                    worker.port.emit("fireipc_receive", data);
                  } catch(e){
                    console.log("Error" + e.result + ": " + e.message);
                  }
                }
              }
            }, null);
        },
        onStopListening: function() {
          dump("Stopped Listening\n");
        }
      }
    );

  } catch (e){
      console.log("Error" + e.result + ": " + e.message);
      return e;
  } return null;
}

exports.onUnload = function(reason) {
  serverSocket.close();
}
