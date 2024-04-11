'use strict';

const OrderMgr = require('dw/order/OrderMgr');
const Order = require('dw/order/Order');
const Status = require('dw/system/Status');
const Logger = require('dw/system/Logger');
const File = require('dw/io/File');
const FileWriter = require('dw/io/FileWriter');
const CSVStreamWriter = require('dw/io/CSVStreamWriter');
const CustomerMgr = require('dw/customer/CustomerMgr');
const StringUtils = require('dw/util/StringUtils');
const Calendar = require('dw/util/Calendar');

/**
 * Create the given {directoryPath} recursively if it does not exists
 *
 * @param {string} directoryPath
 *
 * @returns {dw/io/File} The created directory instance
 */
var createDirectory = function (directoryPath) {
    var directory = new File(directoryPath);

    if (!directory.exists() && !directory.mkdirs()) {
        throw new Error('Cannot create the directory ' + directoryPath);
    }

    return directory;
};

// eslint-disable-next-line require-jsdoc
function datesFrom(days) {
    let date = new Date();
    date.setDate(date.getDate() - Number(days));
    return date;
}

/**
 * @description write the header to the CSV feed file
 *
 * @param {CSVStreamWriter} csvfileWriter - CSV File Writer
 */
function writeHeaderToCSV(csvfileWriter) {
    if (empty(csvfileWriter)) {
        return;
    }
    let headers = ['Order Number', 'Order Date', 'Customer Number', 'Customer First Name', 'Customer Last Name', 'Customer Type', 'Customer email', 'Customer Mobile', 'Customer Birthday', 'Customer List Id', 'Total Amount'];
    csvfileWriter.writeNext(headers);
}

/**
 * @description write the order information to the CSV feed file
 *
 * @param {CSVStreamWriter} csvfileWriter - CSV File Writer
 * @param {Order} order - the order
 */
function writeOrderToCSV(csvfileWriter, order) {
    if (empty(csvfileWriter) || empty(order)) {
        return;
    }
    let orderLine = [];
    orderLine.push(order.orderNo);
    orderLine.push(StringUtils.formatCalendar(new Calendar(order.getCreationDate()), 'yyyy-MM-dd'));
    orderLine.push(order.customerNo);

    let mobileNumber = '';
    let birthday = '';
    var siteCustomerListID = '';
    if (!empty(order.customer)) {
        var customer = order.customer;
        var profile = customer.profile;
        if (profile) {
            mobileNumber = profile.phoneHome;
            orderLine.push(profile.firstName);
            orderLine.push(profile.lastName);
            if (profile.birthday) {
                birthday = StringUtils.formatCalendar(new Calendar(profile.birthday), 'yyyy-MM-dd');
            }
            siteCustomerListID = CustomerMgr.siteCustomerList.ID;
        } else {
            // mobileNumber = 'mobileNumber' in order.custom ? order.custom.mobileNumber : '';
            mobileNumber = order.shipments[0].shippingAddress.phone || '';
            var name = order.customerName;
            var arrname = name.split(' ');
            var lName = arrname[arrname.length - 1];
            arrname.pop();
            var fName = arrname.join(' ');
            orderLine.push(fName);
            orderLine.push(lName);
        }
    }
    orderLine.push(CustomerMgr.getCustomerByLogin(order.customerEmail) ? 'Registered' : 'Anonymous');
    orderLine.push(order.customerEmail);
    orderLine.push(mobileNumber);
    orderLine.push(birthday);
    orderLine.push(siteCustomerListID);
    orderLine.push(order.adjustedMerchandizeTotalGrossPrice.value);
    csvfileWriter.writeNext(orderLine);
}

var createOrderHeadersCSV = function (parameters) {
    Logger.info('***** Job CreateOrderHeadersCSV Started *****');
    try {
        const orderFromDays = datesFrom(parameters.orderFromDays);
        const queryString = 'creationDate > {0} AND status = {1} OR status = {2}';
        const orders = OrderMgr.searchOrders(queryString, null, orderFromDays, Order.ORDER_STATUS_OPEN, Order.ORDER_STATUS_NEW);

        let workingFolder = createDirectory(File.IMPEX + File.SEPARATOR + parameters.WorkingFolder);
        let fileName = 'S3_Order_Headers.csv';
        let file = new File(workingFolder, fileName);

        let fileWriter = new FileWriter(file);
        let csvfileWriter = new CSVStreamWriter(fileWriter, ';');
        writeHeaderToCSV(csvfileWriter);

        while (orders.hasNext()) {
            let order = orders.next();
            writeOrderToCSV(csvfileWriter, order);
        }
        orders.close();
        csvfileWriter.close();
        fileWriter.close();
    } catch (e) {
        Logger.error('Job CreateOrderHeadersCSV error {0}', e.toString());
        return new Status(Status.ERROR, 'FINISHED', 'Job CreateOrderHeadersCSV Finished with ERROR');
    }
    return new Status(Status.OK, 'FINISHED', 'Job CreateOrderHeadersCSV Finished');
};

exports.CreateOrderHeadersCSV = createOrderHeadersCSV;
