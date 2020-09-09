const _ = require('lodash');
const { BU } = require('base-util-jh');

const AbstModel = require('./AbstModel');

module.exports = class extends AbstModel {
  /**
   * protocol_info.option --> true: 3.3kW, any: 600W
   * @param {protocol_info} protocolInfo
   * @param {mDeviceMap} deviceMap
   */
  constructor(protocolInfo, deviceMap) {
    super(protocolInfo, deviceMap);

    // 국번은 숫자로 변환하여 저장함.
    const { deviceId } = protocolInfo;
    if (Buffer.isBuffer(deviceId)) {
      protocolInfo.deviceId = deviceId.readInt8();
    } else if (_.isNumber(deviceId)) {
      protocolInfo.deviceId = deviceId;
    } else if (_.isString(deviceId)) {
      protocolInfo.deviceId = Buffer.from(deviceId).readInt8();
    }

    this.isExistCrc = true;
  }

  /**
   * FnCode 4
   * @param {dataLoggerInfo} dataLogger
   * @param {Buffer} bufData
   * @param {decodingProtocolInfo} decodingProtocolInfo 상속 객체에서 지정 필요
   */
  readInputRegister(dataLogger, bufData, decodingTable) {
    const slaveAddr = bufData.readIntBE(0, 1);
    const fnCode = bufData.readIntBE(1, 1);
    const registerAddr = bufData.readInt16BE(2);
    const dataLength = bufData.readInt16BE(4);

    // Modbus Header
    const header = Buffer.concat([
      this.protocolConverter.convertNumToWriteInt(slaveAddr),
      this.protocolConverter.convertNumToWriteInt(fnCode),
    ]);

    /** @type {detailNodeInfo[]} */
    const nodeList = dataLogger.nodeList.map(nodeId => _.find(this.nodeList, { nodeId }));

    /** @type {number[]} */
    const dlDataList = decodingTable.decodingDataList.map(decodingInfo => {
      const { key, scale = 1, fixed = 0 } = decodingInfo;
      const nodeInfo = _.find(nodeList, { defId: key });
      if (nodeInfo === undefined) {
        return 0;
      }

      return _.round(_.divide(nodeInfo.data, scale), fixed);
    });

    // registerAddr가 0이 아닐수가 있기 때문에 데이터를 자름
    const selectedDlDataList = dlDataList.slice(registerAddr, _.sum([registerAddr, dataLength]));
    // 데이터를 Buffer에 추가
    const bodyBuffer = selectedDlDataList.reduce((buf, data) => {
      return Buffer.concat([
        buf,
        this.protocolConverter.convertNumToWriteInt(data, {
          byteLength: 2,
          isLE: false,
        }),
      ]);
    }, Buffer.alloc(0));

    let command = Buffer.concat([
      header,
      Buffer.alloc(1, selectedDlDataList.length * 2),
      bodyBuffer,
    ]);
    // CRC 생성
    if (this.isExistCrc) {
      const crcBuf = this.protocolConverter.getModbusChecksum(command);
      command = Buffer.concat([command, crcBuf]);
    }

    return command;
  }

  /**
   *
   * @param {Buffer} bufData
   */
  onData(bufData) {
    // BU.CLIS(this.protocolInfo, bufData);
    // Frame을 쓴다면 벗겨냄
    const originalBufData = this.peelFrameMsg(bufData);
    const slaveAddr = originalBufData.readIntBE(0, 1);
    const fnCode = originalBufData.readIntBE(1, 1);

    /** @type {Buffer} */
    let deviceData;

    // slaveAddr를 기준으로 dataLogger 찾음
    const foundDataLogger = this.findDataLogger(slaveAddr);

    if (_.isUndefined(foundDataLogger)) {
      return;
    }

    switch (fnCode) {
      case 4:
        deviceData = this.readInputRegister(foundDataLogger, originalBufData);
        break;

      default:
        break;
    }

    // 데이터가 없으면 반환
    if (_.isEmpty(deviceData)) return undefined;

    // Wrapping 처리
    const returnBuffer = this.wrapFrameMsg(deviceData);

    return returnBuffer;
  }
};
