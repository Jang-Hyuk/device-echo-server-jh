require('../config.guide');

const protocolBatSm = {
  mainCategory: 'ETC',
  subCategory: 'batSm',
  cmdExecTimeoutMs: 1000 * 2,
};

const protocolRelayJkNr = {
  mainCategory: 'ETC',
  subCategory: 'JK_NR_2',
  cmdExecTimeoutMs: 1000 * 2,
};

const protocolRelayKincony = {
  mainCategory: 'ETC',
  subCategory: 'Kincony',
  cmdExecTimeoutMs: 1000 * 2,
};

/** @type {desConfig} */
module.exports = {
  echoConfigList: [
    {
      siteId: 'relay_1',
      siteName: '나주 태양광 IoT 소비전력 최적화',
      serverPort: 15300,
      echoServerList: [
        {
          protocolConfig: [protocolRelayKincony],
          mapConfig: {
            projectId: 'ETC',
            mapId: 'solarIot',
            simulatorPort: 15353,
          },
        },
      ],
    },
    {
      siteId: 'relay_2',
      siteName: '나주 태양광 IoT 소비전력 최적화',
      serverPort: 15301,
      echoServerList: [
        {
          protocolConfig: [protocolRelayJkNr],
          mapConfig: {
            projectId: 'ETC',
            mapId: 'solarIot',
          },
        },
      ],
    },
    {
      siteId: 'battery',
      siteName: '나주 태양광 IoT 소비전력 최적화',
      serverPort: 15303,
      echoServerList: [
        {
          protocolConfig: [protocolBatSm],
          mapConfig: {
            projectId: 'ETC',
            mapId: 'solarIot',
          },
        },
      ],
    },
  ],
};
