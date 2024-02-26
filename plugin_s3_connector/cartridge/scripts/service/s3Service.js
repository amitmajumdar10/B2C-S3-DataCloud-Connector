'use strict';

/**
 * AWS S3 service implementation
 *
 * @returns {dw.service.Service} S3 service.
 */
function getS3Service() {
    const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
    const HTTPClient = require('dw/net/HTTPClient');
    const logger = require('dw/system/Logger').getLogger('s3tc', 'S3TransferClient');
    return LocalServiceRegistry.createService('plugin_s3_connector.https.api', {
        execute: function (service, data) {
            try {
                if (data.length === 0) {
                    return {
                        error: true
                    };
                }
                let payload = data[0];
                // Setup connection
                var httpClient = new HTTPClient();
                httpClient.open(payload.httpMethod, payload.methodEndpoint);
                httpClient.setRequestHeader('content-type', payload.CONTENTTYPE);
                httpClient.setRequestHeader('x-amz-content-sha256', payload.payloadHash);
                httpClient.setRequestHeader('x-amz-date', payload.DATETIMESTAMP);
                httpClient.setRequestHeader('Authorization', payload.authorizationHeader);
                // Sending files requires the content-length header to be set
                if (payload.outGoingFile !== null) {
                    httpClient.setRequestHeader('Content-Length', payload.outGoingFile.length());
                }
                // Make the request
                if (payload.httpMethod === 'PUT') {
                    httpClient.send(payload.outGoingFile);
                } else if (empty(payload.incomingFile)) {
                    // GET/DELETE requests (e.g. directory listing/delete a file)
                    httpClient.send();
                } else {
                    // GET request & receive file (e.g. request a file)
                    httpClient.sendAndReceiveToFile(null, payload.incomingFile);
                }
                return httpClient;
            } catch (error) {
                logger.error('Exception occured when connecting to S3 - {0}' + error);
            }
            return {
                error: true
            };
        }
    });
}

module.exports = {
    getS3Service: getS3Service
};
