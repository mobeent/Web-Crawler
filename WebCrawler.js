const fs = require('fs')
const util = require('util')
const http = require('http');
const https = require('https');
const parse5 = require('parse5');

let jsonObj;
let siteInfo = {};
const maxRequests = 10;
const maxRequestsPerSite = 5;
let requestQueue = [];
let count = 0;

const delay = msecs => new Promise(resolve => setTimeout(resolve, msecs));

const readFile = file => new Promise((resolve, reject) =>
  fs.readFile(file, (err, data) => {
    if (err) {
      reject(err);
    } else {
      resolve(data);
    }
  })
);

const fetch = url => new Promise((resolve, reject) => {
  const parser = new parse5.SAXParser();
  count++;
  let type;
  if (url[4] == 's') {
    type = https
  } else {
    type = http
  }
  let request = type.get(url, (response) => {
    let outgourls = [];
    parser.on('startTag', (name, attr) => {
      if (name == 'a') {
        attr.forEach(href => {
          let value = href.value;
          if (value[0] == '/' && value[1] != '/') {
            outgourls.push(url.concat(value.slice(1,value.length)));
          } else if (value[0] == '/' && value[1] == '/') {
            if (url[4] == 's') {
              let newurl = url.slice(0,6).concat(value);
              let domain1 = url.split('/')[2].replace('www.', '');
              let domain2 = newurl.split('/')[2].replace('www.', '');
              if (domain1 != domain2) {
                if (domain1 in siteInfo) {
                  siteInfo[domain1].toDistinct++;
                }
                if (domain2 in siteInfo) {
                  siteInfo[domain2].fromDistinct++;
                } else {
                  let element = {};
                  element.requestCount = 0;
                  element.type = url.split('/')[0];
                  element.promisedDelay = delay(1);
                  element.fromDistinct = 1;
                  element.toDistinct = 0;
                  siteInfo[domain2] = element;
                }
              }
              outgourls.push(newurl);
            } else {
              let newurl = url.slice(0,5).concat(value);
              let domain1 = url.split('/')[2].replace('www.', '');
              let domain2 = newurl.split('/')[2].replace('www.', '');
              if (domain1 != domain2) {
                if (domain1 in siteInfo) {
                  siteInfo[domain1].toDistinct++;
                }
                if (domain2 in siteInfo) {
                  siteInfo[domain2].fromDistinct++;
                } else {
                  let element = {};
                  element.requestCount = 0;
                  element.type = url.split('/')[0];
                  element.promisedDelay = delay(1);
                  element.fromDistinct = 1;
                  element.toDistinct = 0;
                  siteInfo[domain2] = element;
                }
              }
              outgourls.push(newurl);
            }
          } else if (value.indexOf('https://') == 0 || value.indexOf('http://') == 0) {
            let domain1 = url.split('/')[2].replace('www.', '');
            let domain2 = value.split('/')[2].replace('www.', '');
            if (domain1 != domain2) {
              if (domain1 in siteInfo) {
                siteInfo[domain1].toDistinct++;
              }
              if (domain2 in siteInfo) {
                siteInfo[domain2].fromDistinct++;
              } else {
                let element = {};
                element.requestCount = 0;
                element.type = url.split('/')[0];
                element.promisedDelay = delay(1);
                element.fromDistinct = 1;
                element.toDistinct = 0;
                siteInfo[domain2] = element;
              }
            }
            outgourls.push(value);
          }
        });
      }
    });

    response.pipe(parser)
    response.on('end', () => {
      resolve(outgourls);
    });
  });
  request.on('error', (err) => {
    reject(err);
  })
});

readFile('config.json').then(data => {
  jsonObj = JSON.parse(data);
  console.log(`Initial Urls:`);
  jsonObj.initialUrls.forEach(url => {
    console.log(`${url}`);
    let element = {};
    let domain = url.split('/')[2].replace('www.', '');
    element.requestCount = 0;
    element.type = url.split('/')[0];
    element.promisedDelay = delay(1);
    element.fromDistinct = 0;
    element.toDistinct = 0;
    siteInfo[domain] = element;
    requestQueue.push(url);
  });

  let sink = 0;
  console.log('Starting Crawler...');
  console.log('This may take time depending on max requests...');
  let intervalId = setInterval(() => {
      if (requestQueue.length != 0) {
        let url = requestQueue.splice(0,1)[0]
        let domain = url.split('/')[2].replace('www.', '');
        sink++;
        if (domain in siteInfo) {
          if (siteInfo[domain].requestCount < maxRequestsPerSite) {
            siteInfo[domain].requestCount++;
            // const newurl = url;
            // const newqueue = requestQueue;
            siteInfo[domain].promisedDelay = siteInfo[domain].promisedDelay.then(() => {
              return fetch(url).then(x => {
                if (x.length == 0) {
                  sink--;
                }
                requestQueue = requestQueue.concat(x);
                return delay(5000);
              }).catch(err => console.log(`ERROR OCCURED: ${err}`))
            })
          }
        } else {
          let element = {};
          element.requestCount = 0;
          element.type = url.split('/')[0];
          element.promisedDelay = delay(1);
          element.fromDistinct = 0;
          element.toDistinct = 0;
          siteInfo[domain] = element;
          siteInfo[domain].requestCount++;
          // const newurl = url;
          // const newqueue = requestQueue;
          siteInfo[domain].promisedDelay = siteInfo[domain].promisedDelay.then(() => {
            return fetch(url).then(x => {
              if (x.length == 0) {
                sink--;
              }
              requestQueue = requestQueue.concat(x);
              return delay(5000);
            }).catch(err => console.log(`ERROR OCCURED: ${err}`))
          })
        }
      }
      if (count >= maxRequests || sink == 0) {
        console.log('Ending due to Limit reached or no more outgoing links');
        console.log(`Number of requests made: ${count}`);
        console.log(util.inspect(siteInfo, false, null));
        clearInterval(intervalId);
      }
  }, 5000);
})
