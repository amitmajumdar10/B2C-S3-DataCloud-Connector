'use strict';

const Status = require('dw/system/Status');
const Logger = require('dw/system/Logger');
const File = require('dw/io/File');
const FileReader = require('dw/io/FileReader');
const CSVStreamReader = require('dw/io/CSVStreamReader');
const CustomerMgr = require('dw/customer/CustomerMgr');
const Transaction = require('dw/system/Transaction');

var importCustomerSegment = function (parameters) {
    Logger.info('***** Job ImportCustomerSegment Started *****');
    var payloadFile = parameters.FilePath;
    var segmentName = parameters.SegmentName;
    try {
        var fileToImport = new File(File.IMPEX + File.SEPARATOR + payloadFile);
        if (!fileToImport.exists()) {
            return new Status(Status.ERROR, 'FINISHED', 'Job ImportCustomerSegment - Finished with Error | File not found.');
        }
        var fileReader = new FileReader(fileToImport);
        var csvStreamReader = new CSVStreamReader(fileReader);

        csvStreamReader.readNext(); // skip the header row from the CSV

        var line;
        // eslint-disable-next-line no-cond-assign
        while ((line = csvStreamReader.readNext()) !== null) {
            // var customerNo = line[2];
            var emailAddress = line[3];
            var profile = CustomerMgr.searchProfile('email = {0}', emailAddress);
            if (profile) {
                // eslint-disable-next-line no-loop-func
                Transaction.wrap(function () {
                    if (profile.custom.segments && !(profile.custom.segments).includes(segmentName)) {
                        profile.custom.segments = profile.custom.segments + segmentName + ';';
                    } else if (profile.custom.segments && (profile.custom.segments).includes(segmentName)) {
                        // do nothing as segment is already present
                    } else {
                        profile.custom.segments = segmentName + ';';
                    }
                });
            }
        }

        fileReader.close();
        csvStreamReader.close();
    } catch (error) {
        Logger.error('***** Job ImportCustomerSegment finished with error ***** {0}', error);
    }
    return new Status(Status.OK, 'FINISHED', 'Job ImportCustomerSegment Finished');
};
exports.ImportCustomerSegment = importCustomerSegment;
