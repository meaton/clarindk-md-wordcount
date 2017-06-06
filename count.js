#!/usr/bin/env node

var mongoose = require('mongoose'),
  schema = require('./schema'),
  parser = require('xml2json'),
  xml = require('libxmljs'),
  fs = require('fs');
var mg = mongoose.connect("mongodb://localhost/clarindk_metadata_prod");
var queryId = require('minimist')(process.argv.slice(2))._[0],
  total_count = 0,
  roles = {};

function count() {
  if (queryId != null && queryId.length > 0) {
    schema.models.Query.findById(queryId)
      .populate("result_collection")
      .exec(function(err, query) {
        if (query != null) {
          var results = query.result_collection;
          results.forEach(function(record, idx, res) {
            if (record != null) {
              var mdDocument = null;
              var sanitize = function(key, val) { // santize all text nodes
                if (typeof(val) == "string" && key == "$t")
                  return jsontoxml.escape(val);

                return val;
              };

              try {
                var data_san = JSON.stringify(JSON.parse(record.data), sanitize);
                var data = parser.toXml(JSON.parse(data_san));
                mdDocument = xml.parseXmlString(data);
              } catch (e) {
                console.error(e);
                return;
              }

              if (mdDocument != null) {
                var word_count = mdDocument.get("//t:teiHeader/t:fileDesc/t:extent/t:num[@n = 'words']", {
                  "t": "http://www.tei-c.org/ns/1.0"
                });
                if (word_count != null)
                  word_count = parseInt(word_count.text());

                console.info('found record: ' + record.dkclarinID);

                if (word_count != null && word_count > 0) {
                  total_count += word_count;
                  console.info('words:: count: ' + word_count + " , total: " + total_count);
                }

                var interact_roles = mdDocument.find("//t:teiHeader/t:profileDesc/t:textDesc/t:interaction/t:note[@type = 'interactRole']", {
                  "t": "http://www.tei-c.org/ns/1.0"
                });
                interact_roles.forEach(function(val) {
                  var role = val.text();

                  if (role != null && role.length > 0)
                    if (roles[role] != null && roles[role] >= 1)
                      roles[role]++;
                    else
                      roles[role] = 1;

                  console.info('roles:: role name: ' + role + " , count: " + roles[role]);
                });
              } else {
                console.error("Invalid XML: Could not be parsed.");
              }
            }

            if (idx == res.length - 1)
              printOutput();
          });
        } else {
          console.error("Error: Query not found.");
        }
      });
  } else {
    console.error("Error: Invalid Query ID.");
  }
}

function printOutput() {
  console.log('Printing to stdout.');

  var stream = fs.createWriteStream("count.out", {
    encoding: 'utf8'
  });

  stream.on('finish', function() {
    process.exit();
  });

  stream.write(JSON.stringify({
    words: total_count,
    interact_roles: roles
  }, null, '\t'));

  stream.end();
}

console.info("Starting count...");
count();
