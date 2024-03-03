'use strict';

const Status = require('dw/system/Status');
const Logger = require('dw/system/Logger').getLogger('s3tc', 'S3TransferClient');
const File = require('dw/io/File');
const CustomObjectMgr = require('dw/object/CustomObjectMgr');

var S3TransferClient = require('*/cartridge/scripts/lib/s3Helpers');

/**
 * @desc Initialize the s3 Transfer Client Instance
 *
 * @param {string} objType operation config type of the object
 * @param {string} obj instance of the config object
 *
 * @returns {Object} object
 */
function init(objType, obj) {
    const transectionAttr = CustomObjectMgr.getCustomObject(objType, obj);
    if (empty(transectionAttr)) {
        return null;
    }
    var s3TransferClientInstance = new S3TransferClient(
        transectionAttr.custom.bucketName,
        transectionAttr.custom.accessKey,
        transectionAttr.custom.secretAccessKey,
        transectionAttr.custom.region,
        transectionAttr.custom.contentType
    );
    return {
        s3TransferClientInstance: s3TransferClientInstance,
        localFilePath: transectionAttr.custom.localFilePath,
        remoteFileName: transectionAttr.custom.remoteFileName
    };
}

var upload = function (params) {
    Logger.info('***** Job s3Transfer - File Upload Started *****');

    var initObj = init('s3_upload_config', params.s3ConfigObject);

    if (initObj === null) {
        return new Status(Status.ERROR, 'FINISHED', 'Job s3Transfer - File Upload finished with Error | S3 configuration object is missing in BM');
    }

    var fileToUpload = new File(File.IMPEX + File.SEPARATOR + initObj.localFilePath);
    if (!fileToUpload.exists()) {
        return new Status(Status.ERROR, 'FINISHED', 'Job s3Transfer - File Upload finished with Error | File not found.');
    }

    var result = initObj.s3TransferClientInstance ? initObj.s3TransferClientInstance.putBinary(initObj.remoteFileName, fileToUpload) : null;
    if (result && fileToUpload.exists()) {
        return new Status(Status.OK, 'FINISHED', 'Job s3Transfer - File Upload finished successfully');
    }
    return new Status(Status.ERROR, 'FINISHED', 'Job s3Transfer - File Upload finished with Error');
};

var download = function (params) {
    Logger.info('***** Job s3Transfer - File Download Started *****');

    var initObj = init('s3_download_config', params.s3ConfigObject);

    if (initObj === null) {
        return new Status(Status.ERROR, 'FINISHED', 'Job s3Transfer - File Download finished with Error | S3 configuration object is missing in BM');
    }

    var localFilePath = initObj.localFilePath.split('/');
    localFilePath.pop();
    localFilePath = localFilePath.join('/');
    var fileDir = new File(File.IMPEX + localFilePath);
    if (!fileDir.exists()) { fileDir.mkdirs(); }

    var fileToDownload = new File(File.IMPEX + File.SEPARATOR + initObj.localFilePath);
    // Delete the file if it already exists
    if (fileToDownload.exists()) {
        fileToDownload.remove();
    }

    var result = initObj.s3TransferClientInstance ? initObj.s3TransferClientInstance.getBinary(initObj.remoteFileName, fileToDownload) : null;
    if (result) {
        return new Status(Status.OK, 'FINISHED', 'Job s3Transfer - File Download finished successfully');
    }
    return new Status(Status.ERROR, 'FINISHED', 'Job s3Transfer - File Download finished with Error');
};

exports.Upload = upload;
exports.Download = download;
