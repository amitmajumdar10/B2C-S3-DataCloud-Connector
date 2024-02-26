# B2C-S3-DataCloud Connector
B2C-S3-DataCloud Connector

### Description

The purpose of the B2C-S3-DataCloud Connector is to enable the connection with AWS S3 buckets and allow the downloading and uploading of files and directories. The connector is using an S3 bucket as a transfer server for data ingestion in DC from B2C and also for activation of segments in B2C. It is expected that you create and configure an S3 bucket with proper access to allow seamless functioning of the connector.


### Features

- The OOTB B2C Commerce CDP Connector is requested to be configured to activate the customer segments from Data Cloud/CDP to B2C. Using this custom connector you can activate the segments in B2C without configuring the OOTB connector.
- This custom connector supports B2C Commerce Sandbox connection to Data Cloud/CDP;
- This connector will support ingestion of order data older than 30 days, in Data Cloud/CDP;
- No need to enable Einstein in the B2C to enable the data ingestion;
