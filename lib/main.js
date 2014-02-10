"use strict";

const {CC,Cu,Cc,Ci} = require("chrome");
const pageMod = require("sdk/page-mod");
const {NetUtils} = Cu.import("resource://gre/modules/NetUtil.jsm");

const ScriptableUnicodeConverter =
    CC("@mozilla.org/intl/scriptableunicodeconverter",
                      "nsIScriptableUnicodeConverter");

const data = require('sdk/self').data;
Cu.import("resource://gre/modules/Services.jsm");

const PORT_NUMBER = 61155;
const PROTOCOL_VERSION = 1;
const FIREIPC_VERSION = require('sdk/self').version;

var serverSocket = null;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

function GM_setValue(script, name, val) {
  var dbfile = FileUtils.getFile("ProfD", ["gm_scripts", script + ".db"]);
  var db = Services.storage.openDatabase(dbfile);

  var stmt = db.createStatement(
      'INSERT OR REPLACE INTO scriptvals (name, value) VALUES (:name, :value)');
  try {
    stmt.params.name = name;
    stmt.params.value = JSON.stringify(val);
    stmt.execute();
  } finally {
    stmt.reset();
  }

}


function GM_getValue(script, name, defVal) {
  var dbfile = FileUtils.getFile("ProfD", ["gm_scripts", script + ".db"]);
  var db = Services.storage.openDatabase(dbfile);
  var value = null;

  var stmt = db.createStatement(
      'SELECT value FROM scriptvals WHERE name = :name');
  try {
    stmt.params.name = name;
    while (stmt.step()) {
      value = stmt.row.value;
    }
  } catch (e) {
    console.log('getValue err: ' + uneval(e) + '\n');
  } finally {
    stmt.reset();
  }

  if (value == null) return defVal;
  try {
    return JSON.parse(value);
  } catch (e) {
    dump('JSON parse error? ' + uneval(e) + '\n');
    return defVal;
  }
}

function GM_delValue(script, name) {
  var dbfile = FileUtils.getFile("ProfD", ["gm_scripts", script + ".db"]);
  var db = Services.storage.openDatabase(dbfile);

  var stmt = db.createStatement(
      'DELETE FROM scriptvals WHERE name = :name');
  try {
    stmt.params.name = name;
    stmt.execute();
  } finally {
    stmt.reset();
  }
}

function array_remove(obj, arr) {
  var index = arr.indexOf(obj);
  if(index != -1) {
    arr.splice(index, 1);
  }
}

exports.main = function() {
  var workers = [];
  var outputs = [];

  function on_attach(worker) {
    workers.push(worker);
    worker.on('detach', function () {
      array_remove(this, workers);
    });

    worker.port.on("handshake", function(detail){
      var nonce = detail.msg.nonce;
      var name = detail.msg.name;
      var namespace = detail.msg.namespace;
      var gm_pref = "fireipc_handshake";
      var gm_nonce = gm_pref + "_" + nonce;

      var gm_data = GM_getValue(name, gm_nonce, false);
      if(gm_data) {
        GM_delValue(name, gm_nonce);
        var uuid = GM_getValue(name, gm_pref+"_uuid", null);
        if(uuid == null) {
          var uuid = require('sdk/util/uuid').uuid().toString();
          GM_setValue(name, gm_pref+"_uuid", uuid);
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
  }

  pageMod.PageMod({
    include: "*",
    attachTo: ["existing", "top", "frame"],
    contentScriptWhen: 'ready',
    contentScriptFile: (data.url('functions.js')),
    onAttach: on_attach
  });

  try  {
    serverSocket = Cc["@mozilla.org/network/server-socket;1"]
            .createInstance(Ci.nsIServerSocket);
    serverSocket.init(PORT_NUMBER, true, -1);

    var converter = new ScriptableUnicodeConverter();
    converter.charset = "UTF-8";

    serverSocket.asyncListen(
      {
        onSocketAccepted: function(server, transport) {
          var outstream = transport.openOutputStream(0, 0, 0);
          var instream = transport.openInputStream(null, 0, 0);

          function write_out(object) {
            var out = JSON.stringify(object) + "\n";
            try {
              out = converter.ConvertFromUnicode(out);
            } catch(e) {
              console.log("Can't convert from unicode to utf8", e.message);
            }
            outstream.write(out, out.length);
            outstream.flush();
          }

          write_out({
            "status": "Connected",
            "protocol": PROTOCOL_VERSION,
            "fireipc": FIREIPC_VERSION,
          });

          outputs.push(outstream);

          var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(
            Ci.nsIInputStreamPump);
          pump.init(instream, -1, -1, 0, 0, false);

          function process_line(data) {
            try {
              var data = JSON.parse(data);
            } catch(e) {
              console.log("Closing transport due to parse error: " + e.message);
              write_out({"error": e.message})
              return transport.close();
            }
            if (data == 0) {
              // use 0 as a magic number for 'quit'
              return transport.close();
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

          pump.asyncRead(
            {
            onStartRequest: function(request, context) {
              dump("Start!\n");
            },
            onStopRequest: function(request, context, result) {
              dump("Stop!\n");
              array_remove(outstream, outputs);
            },
            onDataAvailable: function (request, context, stream, offset, count){
                var data = NetUtil.readInputStreamToString(stream, count);
                dump("DATA: " + data);
                if (data.indexOf("\n") == -1) {
                  process_line(data);
                } else {
                  var lines = data.split("\n");
                  // TODO should buffer the last line if it's not complete. maybe.
                  // .split() doesn't help here
                  for (var i in lines) {
                    if (lines[i].length) {
                      process_line(lines[i]);
                    }
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
