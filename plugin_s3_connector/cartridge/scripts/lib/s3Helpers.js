'use strict';

/* eslint-disable no-unused-vars */

const Bytes = require('dw/util/Bytes');
const Calendar = require('dw/util/Calendar');
const Encoding = require('dw/crypto/Encoding');
const File = require('dw/io/File');
const logger = require('dw/system/Logger').getLogger('s3tc', 'S3TransferClient');
const Mac = require('dw/crypto/Mac');
const MessageDigest = require('dw/crypto/MessageDigest');
const RandomAccessFileReader = require('dw/io/RandomAccessFileReader');
const StringUtils = require('dw/util/StringUtils');
const parseUri = require('*/cartridge/scripts/lib/libUrl').parseUri;

var ACCESSKEY;
var ALGORITHM = 'AWS4-HMAC-SHA256';
var AWSREGION;
var AWSSERVICE = 's3';
var CANONICALQUERYSTRING = encodeURI('');
var CONTENTTYPE;
var CREDENTIALSCOPE = '';
var DELIMITER = '/';
var DATESTAMP = StringUtils.formatCalendar(new Calendar(), 'yyyyMMdd');
var DATETIMESTAMP = StringUtils.formatCalendar(new Calendar(), "yyyyMMdd'T'HHmmss'Z'");
var ENDPOINT = 'https://{{bucket}}.s3.amazonaws.com/';
var HOST = '{{bucket}}.s3.amazonaws.com';
var PREFIX = '';
var SIGNEDHEADERS = 'host;x-amz-content-sha256;x-amz-date';
var SIGNINGKEY = '';
var BUCKETNAME;
var SECRETACCESSKEY;

/**
 * Returns the aws formatted credential scope
 *
 * @param {string} dateStamp dateStamp
 * @param {string} awsRegion awsRegion
 * @param {string} awsService awsService
 * @returns {string} scope
 */
function getCredentialScope(dateStamp, awsRegion, awsService) {
    return dateStamp + '/'
    + awsRegion + '/'
    + awsService + '/'
    + 'aws4_request';
}

/**
 * Signs the passed message using the passed key. key can be either {String} or {Bytes}
 *
 * @param {(string|Bytes)} key key
 * @param {string} msg msg
 * @returns {string} The SHA256 Key for the given key & message.
 */
function sign(key, msg) {
    var hmac = new Mac(Mac.HMAC_SHA_256);

    return hmac.digest(msg, key);
}

/**
 * Creates the AWS signing key
 *
 * @param {string} key key
 * @param {string} dateStamp dateStamp
 * @param {string} regionName regionName
 * @param {string} serviceName serviceName
 * @returns {string} The Signing Key to use for authorization.
 */
function getSignatureKey(key, dateStamp, regionName, serviceName) {
    var signedDate;
    var signedRegion;
    var signedService;
    var signingKey;
    var awsKey = 'AWS4' + key;

    signedDate = sign(awsKey, dateStamp);
    signedRegion = sign(signedDate, regionName);
    signedService = sign(signedRegion, serviceName);
    signingKey = sign(signedService, 'aws4_request');

    return signingKey;
}

/**
 * Initializes the settings for the S3 transfer client
 *
 * @param {string} bucketName bucketName
 * @param {string} secretAccessKey secretAccessKey
 * @todo fix use of private 'constants' as setting variables
 */
function init(bucketName, secretAccessKey) {
    CREDENTIALSCOPE = getCredentialScope(DATESTAMP, AWSREGION, AWSSERVICE);
    ENDPOINT = ENDPOINT.replace('{{bucket}}', bucketName);
    HOST = HOST.replace('{{bucket}}', bucketName);
    SIGNINGKEY = getSignatureKey(secretAccessKey, DATESTAMP, AWSREGION, AWSSERVICE);
}

/**
 * S3TransferClient provides an interface for reading, writing and deleting files from Amazon's Simple Storage Service (S3)
 *
 * @class
 *
 * @param {string} bucketName bucketName
 * @param {string} accessKey accessKey
 * @param {string} secretAccessKey secretAccessKey
 * @param {string} region region
 * @param {string} contentType contentType
 *
 * @todo fix use of private 'constants' as setting variables
 */
function S3TransferClient(bucketName, accessKey, secretAccessKey, region, contentType) {
    ACCESSKEY = accessKey;
    AWSREGION = region;
    BUCKETNAME = bucketName;
    CONTENTTYPE = contentType;
    SECRETACCESSKEY = secretAccessKey;

    // Initialize the transfer client
    init(bucketName, secretAccessKey);
}

/**
 * Returns the hashed form of the payload
 *
 * @param {(string|File)} payload payload
 * @returns {string} Hex-encoded hash
 */
function getPayloadHash(payload) {
    var messageDigest = new MessageDigest(MessageDigest.DIGEST_SHA_256);
    var payloadHash;
    var fileReader;
    var currentByte;

    // GET requests will pass an instance of string, PUT requests will send File
    if (typeof payload === 'string') {
        payloadHash = messageDigest.digestBytes(new Bytes(payload));

        return Encoding.toHex(payloadHash);
    } if (payload instanceof File) {
        fileReader = new RandomAccessFileReader(payload);

        // eslint-disable-next-line no-cond-assign
        while ((currentByte = fileReader.readBytes(1)) !== null) {
            messageDigest.updateBytes(currentByte);
        }

        return Encoding.toHex(messageDigest.digest());
    }
    return '';
}

/**
 * Returns the aws formatted canonical headers
 *
 * @param {string} httpMethod httpMethod
 * @param {string} host host
 * @param {string} payloadHash payloadHash
 * @param {string} date date
 * @returns {string} Multi-line String of Canonical headers
 *
 * @todo fix use of private 'constants' as setting variables
 */
function getCanonicalHeaders(httpMethod, host, payloadHash, date) {
    var canonicalHeaders = 'host:' + host + '\n'
    + 'x-amz-content-sha256:' + payloadHash + '\n'
    + 'x-amz-date:' + date + '\n';
    if (httpMethod === 'GET') {
        canonicalHeaders = 'content-type:' + CONTENTTYPE + '\n' + canonicalHeaders;
    }

    return canonicalHeaders;
}

/**
 * Returns the aws formatted signed headers
 *
 * @param {string} httpMethod httpMethod
 * @returns {string} Appropriate headers
 */
function getSignedHeaders(httpMethod) {
    var signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    if (httpMethod === 'GET') {
        signedHeaders = 'content-type;' + signedHeaders;
    }

    return signedHeaders;
}

/**
 * Encode slashes
 *
 * @param {string} input input
 * @returns {string}slash
 */
function encodeSlash(input) {
    return input.replace(/\//g, '%2F');
}

/**
 * Sets up the canonical query string
 *
 * @param {string} httpMethod httpMethod
 * @param {string} prefix prefix
 * @param {string} delimiter delimiter
 * @returns {string} CANONICALQUERYSTRING
 *
 * @todo fix use of private 'constants' as setting variables
 */
function setCanonicalQueryString(httpMethod, prefix, delimiter) {
    // eslint-disable-next-line default-case
    switch (httpMethod) {
        case 'GET':
            if (prefix !== '' && delimiter !== '') {
                CANONICALQUERYSTRING = 'delimiter=' + delimiter + '&prefix=' + prefix;
                // Slashes need to be encoded for the signature to match Amazon's
                CANONICALQUERYSTRING = (delimiter === '/') ? encodeSlash(CANONICALQUERYSTRING) : CANONICALQUERYSTRING;
            } else {
                CANONICALQUERYSTRING = '';
            }
            break;
        case 'PUT':
            CANONICALQUERYSTRING = '';
            break;
        case 'DELETE':
            CANONICALQUERYSTRING = '';
            break;
    }

    return CANONICALQUERYSTRING;
}

/**
 * Returns the aws formatted canonical request
 *
 * @param {string} httpMethod httpMethod
 * @param {string} canonicalURI canonicalURI
 * @param {string} canonicalQueryString canonicalQueryString
 * @param {string} canonicalHeaders canonicalHeaders
 * @param {string} signedHeaders signedHeaders
 * @param {string} payloadHash payloadHash
 * @returns {string} Multi-line HTTP request headers
 */
function getCanonicalRequest(httpMethod, canonicalURI, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash) {
    var canonicalRequest = httpMethod + '\n'
    + canonicalURI + '\n'
    + canonicalQueryString + '\n'
    + canonicalHeaders + '\n'
    + signedHeaders + '\n'
    + payloadHash;

    return canonicalRequest;
}
/**
 * Create the string to sign
 *
 * @param {string} algorithm algorithm
 * @param {string} dateTimeStamp dateTimeStamp
 * @param {string} credentialScope credentialScope
 * @param {string} canonicalRequest canonicalRequest
 * @returns {string} string to sign
 */
function getStringToSign(algorithm, dateTimeStamp, credentialScope, canonicalRequest) {
    var messageDigest = new MessageDigest(MessageDigest.DIGEST_SHA_256);

    return algorithm + '\n'
    + dateTimeStamp + '\n'
    + credentialScope + '\n'
    + Encoding.toHex(messageDigest.digestBytes(new Bytes(canonicalRequest)));
}

/**
 * Create the authorization header
 *
 * @param {string} algorithm algorithm
 * @param {string} accessKeyId accessKeyId
 * @param {string} credentialScope credentialScope
 * @param {string} signedHeaders signedHeaders
 * @param {string} signature signature
 * @returns {string} authorization header
 */
function getAuthorizationHeader(algorithm, accessKeyId, credentialScope, signedHeaders, signature) {
    var authorizationHeader = algorithm + ' '
    + 'Credential=' + accessKeyId + '/' + credentialScope + ','
    + 'SignedHeaders=' + signedHeaders + ','
    + 'Signature=' + signature;

    return authorizationHeader;
}

/**
 * Creates the endpoint connection string
 *
 * @param {string} httpMethod httpMethod
 * @param {string} fullPath fullPath
 * @param {string} canonicalQueryString canonicalQueryString
 * @returns {string} ENDPOINT
 *
 * @todo fix use of private 'constants' as setting variables
 */
function createEndpoint(httpMethod, fullPath, canonicalQueryString) {
    var methodEndpoint = '';

    // Generate the correct endpoint for the passed method/path/file
    switch (httpMethod) {
        case 'GET':
            if (fullPath.lastIndexOf('.') !== fullPath.length - 4 && fullPath.lastIndexOf('.') !== fullPath.length - 3) {
                methodEndpoint = ENDPOINT + '?' + canonicalQueryString;
            } else {
                methodEndpoint = ENDPOINT + fullPath;
            }
            break;
        case 'PUT':
            methodEndpoint = ENDPOINT + fullPath;
            methodEndpoint = (canonicalQueryString !== '') ? methodEndpoint + '?' + canonicalQueryString : methodEndpoint;
            break;
        case 'DELETE':
            methodEndpoint = ENDPOINT + fullPath;
            break;
        default:
            throw new Error('Unsupported HTTP Method');
    }

    return methodEndpoint;
}

/**
 * Perform the AWS call and return the HTTPClient used.
 *
 * @param {string} httpMethod httpMethod
 * @param {string} fullPath fullPath
 * @param {File} outGoingFile outGoingFile
 * @param {File} incomingFile incomingFile
 * @returns {HTTPClient} (dw.net.HTTPClient)
 *
 * @todo fix use of private 'constants' as setting variables
 */
function execute(httpMethod, fullPath, outGoingFile, incomingFile) {
    var authorizationHeader = '';
    var canonicalHeaders = '';
    var canonicalRequest = '';
    var canonicalURI = '';
    var payloadHash = '';
    var signature = '';
    var stringToSign = '';
    var methodEndpoint = '';
    var hmac = new Mac(Mac.HMAC_SHA_256);

    // Create payload hash
    if (outGoingFile !== null) {
        // Sending files requires a hash of the file to be submitted.
        payloadHash = getPayloadHash(outGoingFile);
    } else {
        // A standard GET request, with no payload, submits a hashed empty string
        payloadHash = getPayloadHash('');
    }

    // Create the canonical headers
    canonicalHeaders = getCanonicalHeaders(httpMethod, HOST, payloadHash, DATETIMESTAMP);

    // Set signed headers
    SIGNEDHEADERS = getSignedHeaders(httpMethod);

    // If we're requesting a path, the prefix needs to be set
    if (fullPath.lastIndexOf('.') !== fullPath.length - 4 && fullPath.lastIndexOf('.') !== fullPath.length - 3) {
        PREFIX = fullPath;
        canonicalURI = '/';
    } else {
        PREFIX = '';
        canonicalURI = '/' + fullPath;
    }

    // Set the canonicalQueryString
    setCanonicalQueryString(httpMethod, PREFIX, DELIMITER);

    // Create the canonical request
    canonicalRequest = getCanonicalRequest(httpMethod, canonicalURI, CANONICALQUERYSTRING, canonicalHeaders, SIGNEDHEADERS, payloadHash);

    // Get the string to sign
    stringToSign = getStringToSign(ALGORITHM, DATETIMESTAMP, CREDENTIALSCOPE, canonicalRequest);

    // Generate Signature
    signature = Encoding.toHex(hmac.digest(stringToSign, SIGNINGKEY));

    // Create authorization header
    authorizationHeader = getAuthorizationHeader(ALGORITHM, ACCESSKEY, CREDENTIALSCOPE, SIGNEDHEADERS, signature);

    // Get the correct endpoint for the method/path/querystring
    methodEndpoint = createEndpoint(httpMethod, fullPath, CANONICALQUERYSTRING);

    const s3Service = require('*/cartridge/scripts/service/s3Service');
    const payload = {
        httpMethod: httpMethod,
        methodEndpoint: methodEndpoint,
        CONTENTTYPE: CONTENTTYPE,
        payloadHash: payloadHash,
        DATETIMESTAMP: DATETIMESTAMP,
        authorizationHeader: authorizationHeader,
        outGoingFile: outGoingFile,
        incomingFile: incomingFile
    };
    var response;
    try {
        response = s3Service.getS3Service().call(payload);
    } catch (error) {
        logger.error('Exception occured when connecting to S3 - {0}' + error);
    }
    return response;
}

/**
 * Downloads the passed file/directory
 *
 * @param {string} fullFileName fullFileName
 * @param {File} localFile (dw.io.File)
 * @returns {boolean} is binary
 */
S3TransferClient.prototype.getBinary = function (fullFileName, localFile) {
    var response = execute('GET', fullFileName, null, localFile);

    if (response === null) {
        logger.error('S3TransferClient.ds: Unable to download [{0}]. An error occurred with status code [{1}] and error text [{2}]', fullFileName, response.statusCode, response.errorText);
        return false;
    }

    if (response.object && response.object.statusCode === 200) {
        return true;
    }

    logger.error('S3TransferClient.ds: Unable to download [{0}]. An error occurred with status code [{1}] and error text [{2}]', fullFileName, response.statusCode, response.errorText);
    return false;
};

/**
 * Uploades the passed file/directory
 *
 * @param {string} fullFileName fullFileName
 * @param {File} localFile localFile
 * @returns {boolean} putBinary
 */
S3TransferClient.prototype.putBinary = function (fullFileName, localFile) {
    var response = execute('PUT', fullFileName, localFile, null);

    if (response === null) {
        logger.error('S3TransferClient.ds: Unable to upload [{0}]. An error occurred with status code [{1}] and error text [{2}]', fullFileName, response.statusCode, response.errorText);
        return false;
    }

    if (response.object && response.object.statusCode === 200) {
        return true;
    }
    logger.error('S3TransferClient.ds: Unable to upload [{0}]. An error occurred with status code [{1}] and error text [{2}]', fullFileName, response.statusCode, response.errorText);
    return false;
};

/**
 * Deletes the remote file
 *
 * @param {string} fullFileName fullFileName
 * @returns {boolean} del
 */
S3TransferClient.prototype.del = function (fullFileName) {
    var response = execute('DELETE', fullFileName, null, null);

    if (response === null) {
        logger.error('S3TransferClient.ds: Unable to delete [{0}]. An error occurred with status code [{1}] and error text [{2}]', fullFileName, response.statusCode, response.errorText);
        return false;
    }

    if (response.object && response.object.statusCode === 200) {
        return true;
    }
    logger.error('S3TransferClient.ds: Unable to delete [{0}]. An error occurred with status code [{1}] and error text [{2}]', fullFileName, response.statusCode, response.errorText);
    return false;
};

module.exports = S3TransferClient;
