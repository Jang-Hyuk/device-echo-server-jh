const _ = require('lodash');

const { BU } = require('base-util-jh');

const Model = require('../Model');

const { dpc } = require('../../../module');

const { MainConverter } = dpc;

class EchoServer {
  /**
   * protocol_info.option --> true: 3.3kW, any: 600W
   * @param {protocol_info} protocolInfo
   * @param {mDeviceMap} deviceMap
   */
  constructor(protocolInfo, deviceMap) {
    // super(protocolInfo, deviceMap);
    // this.init();

    this.vol = 15.5;
    this.amp = 2.5;
    this.watt = 200;

    this.counting = 0;
    this.status = 0;
  }

  /**
   *
   * @param {Buffer} bufData
   */
  onData(bufData) {
    const strData = bufData.toString();

    BU.CLI(strData);

    let value;
    switch (strData) {
      case ':MEASure:VOLTage?\n':
        value = this.vol;
        break;
      case ':MEASure:CURRent?\n':
        value = this.amp;
        break;
      case ':MEASure:POWer?\n':
        value = this.watt;
        break;
      case ':SOUR:INP:STAT?\n':
        value = this.status;
        break;
      case ':SOUR:INP:STAT ON\n':
        BU.CLI('Power On');
        this.status = 1;
        break;
      case ':SOUR:INP:STAT OFF\n':
        BU.CLI('Power Off');
        this.status = 0;
        break;
      default:
        break;
    }

    BU.CLI(value);
    if (_.isUndefined(value) || this.status === 0) return undefined;

    const returnBuffer = Buffer.from(`${value}\n`);
    // const returnBuffer = undefined;

    // Wrapping 처리
    return returnBuffer;
  }
}
module.exports = EchoServer;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');

  const deviceMap = require('../../../deviceMap');

  const protocolInfo = {
    deviceId: '001',
    mainCategory: 'FarmParallel',
    subCategory: 'dmTech',
  };

  const echoServer = new EchoServer(protocolInfo, deviceMap.FP.YeongSanPo);

  const mainConverter = new MainConverter(protocolInfo);
  mainConverter.setProtocolConverter();
  BU.CLI(echoServer.device.DEFAULT.COMMAND.STATUS);
  let cmdList = mainConverter.generationCommand(echoServer.device.DEFAULT.COMMAND.STATUS);
  let result = echoServer.onData(_.head(cmdList).data);
  BU.CLI(result);
  cmdList = mainConverter.generationCommand(echoServer.device.LUX.COMMAND.STATUS);
  result = echoServer.onData(_.head(cmdList).data);
  BU.CLI(result);

  // echoServer.reload();
}
