import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';
import { EdgeKV } from './edgekv.js';
import { logger } from 'log';
import { crypto } from 'crypto';
import { base64, btoa } from 'encoding';

export async function responseProvider(request) {
  let data_kv = "";
  let sig = ""
  let err_msg = ""

  let cryptoKey = await crypto.subtle.importKey(
          "jwk",
          {"crv":"P-256","ext":false,"key_ops":["verify"],"kty":"EC","x":"Ttiko0FT0Eg7pAtW9u_l07waClao36qLlV8GHNqFjKM","y":"QuUcij33jYXB0Rf7ZODNhduL4wKSzeKZQjlLqFFxAH8"},
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"]
  );

  const key = request.getVariable('PMUSER_PATH');
  const fullpath = request.getVariable('PMUSER_FULLPATH');

  const response = await httpRequest(fullpath, {
      method: "GET",
      timeout: 1000
  });

  if (response.ok) {
    let data_body = await response.text();
    data_body = data_body.trim();
    let data = btoa(data_body);

    // Set Up EdgeKV
    const edgeKv = new EdgeKV({namespace: "<YourNameSpace>", group: "<YourGroup>"});
    try {
      data_kv = await edgeKv.getText({ item: key, default_value: "" });
    } catch (error) {
      err_msg = error.toString();
      logger.log (err_msg);
    }
    
    logger.log ("sig:" + data_kv + ";data:" + data_body + ";data64:" + data);

    data = base64.decode(data);
    sig = base64.decode(data_kv);

    let isOk = await crypto.subtle.verify(
           {
                name: "ECDSA",
                hash: "SHA-256",
            },
            cryptoKey,
            sig,
            data
    );

    if (isOk) {
        return Promise.resolve(createResponse(200, { 'Content-Type': ['text/html'] } 
        , data_body));
    }
    else {
        return Promise.resolve(createResponse(503, { 'Content-Type': ['text/html'] } 
        , '<html><body>Service is unavailable</body></html>'));
    }
  } else {
    request.respondWith(
        503, {},
        '<html><body>Service is unavailable</body></html>');
  }
}