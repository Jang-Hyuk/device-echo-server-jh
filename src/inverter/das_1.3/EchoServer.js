'use strict';

const _ = require('lodash');

const {BU} = require('base-util-jh');

const Model = require('../Model');

/** @type {Array.<{id: Buffer, instance: EchoServer}>} */
let instanceList = [];
class EchoServer extends Model {
  /**
   * protocol_info.option --> true: 3.3kW, any: 600W
   * @param {protocol_info} protocol_info
   */
  constructor(protocol_info) {
    super(protocol_info);

    this.isKwGnd = _.get(protocol_info, 'option') === true ? true : false;
    
    // 기존에 객체에 생성되어 있는지 체크
    let foundInstance = _.find(instanceList, instanceInfo => {
      return _.isEqual(instanceInfo.id, this.dialing);
    });

    // 없다면 신규로 생성
    if(_.isEmpty(foundInstance)){
      instanceList.push({id: this.dialing, instance: this});
    } else {
      return foundInstance.instance;
    }

    this.SOP = Buffer.from('^');
    this.DELIMETER = Buffer.from(',');
    this.REQ_CODE = Buffer.from('P');
    this.RES_CODE = Buffer.from('D');

    this.RES_HEAD = [
      this.SOP,
      this.RES_CODE
    ];

    this.HEADER_INFO = {
      BYTE: {
        SOP: 1,
        CODE: 1,
        ADDR: 1,
        LENGTH: 2,
        ID: 3,
        CHECKSUM: 2,
        CMD: 3
      }
    };
    
  }

  /**
   * 체크섬 구해서 반환
   * @param {Array.<Buffer>} dataBodyBufList 
   * @return 
   */
  calcChecksum(dataBodyBufList){
    let bodyBuf = Buffer.concat(dataBodyBufList);
    let strChecksum = this.returnBufferExceptDelimiter(bodyBuf, this.DELIMETER.toString()).toString();

    let calcChecksum = 0;
    _.forEach(strChecksum, str => {
      let num =  _.toNumber(str);
      // 문자라면 A~Z --> 10~35로 변환
      num = isNaN(num) ?  _.head(Buffer.from(str)) - 55 : num;
      calcChecksum += num;
    });

    return this.convertNumToBuf(calcChecksum, 2);
  }


  // 시스템 메시지 반환
  makeSystem(){
    let dataBody = [
      Buffer.from('017'),
      this.dialing,
      this.DELIMETER,
      this.convertNumToBuf(this.BASE.sysIsSingle ? 1 : 3, 1),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.sysCapaKw * 10), 4),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.sysLineVoltage), 3),
      this.DELIMETER
    ];

    let resBuf = Buffer.concat(_.concat(this.RES_HEAD, dataBody));
    return Buffer.concat([resBuf, this.calcChecksum(dataBody)]);
  }

  makePv(){
    let pvCurrentScale = this.isKwGnd ? 10 : 1000;
    let dataBody = [
      Buffer.from('120'),
      this.dialing,
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.pvVol), 3),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.pvAmp * 10), 4),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.pvKw * pvCurrentScale), 4),
      this.DELIMETER
    ];

    let resBuf = Buffer.concat(_.concat(this.RES_HEAD, dataBody));
    return Buffer.concat([resBuf, this.calcChecksum(dataBody)]);
  }

  
  makeGridVol(){
    let dataBody = [
      Buffer.from('222'),
      this.dialing,
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridRsVol), 3),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridStVol), 3),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridTrVol), 3),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridLf * 10), 3),
      this.DELIMETER
    ];

    let resBuf = Buffer.concat(_.concat(this.RES_HEAD, dataBody));
    return Buffer.concat([resBuf, this.calcChecksum(dataBody)]);
  }

  makeGridAmp(){
    let dataBody = [
      Buffer.from('321'),
      this.dialing,
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridRAmp * 10), 4),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridSAmp * 10), 4),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.gridTAmp * 10), 4),
      this.DELIMETER,
    ];

    let resBuf = Buffer.concat(_.concat(this.RES_HEAD, dataBody));
    return Buffer.concat([resBuf, this.calcChecksum(dataBody)]);
  }


  makePower(){
    let pvCurrentScale = this.isKwGnd ? 10 : 1000;
    let dataBody = [
      Buffer.from('419'),
      this.dialing,
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.powerGridKw * pvCurrentScale), 4),
      this.DELIMETER,
      this.convertNumToBuf(_.round(this.BASE.powerCpKwh), 7),
      this.DELIMETER
    ];

    let resBuf = Buffer.concat(_.concat(this.RES_HEAD, dataBody));
    return Buffer.concat([resBuf, this.calcChecksum(dataBody)]);
  }

  makeOperation(){
    let dataBody = [
      Buffer.from('612'),
      this.dialing,
      this.DELIMETER,
      this.convertNumToBuf(this.BASE.operIsError, 1),
      this.DELIMETER,
      this.convertNumToBuf(this.BASE.operIsRun ? 0 : 1, 1),
      this.DELIMETER,
      this.convertNumToBuf(_.random(0, 9), 1),
      this.DELIMETER,
    ];

    let resBuf = Buffer.concat(_.concat(this.RES_HEAD, dataBody));
    return Buffer.concat([resBuf, this.calcChecksum(dataBody)]);
  }




  /**
   * 
   * @param {Buffer} bufData 
   */
  onData(bufData){
    let SOP = Buffer.from([_.head(bufData)]);

    // SOP 일치 여부 체크
    if(!_.isEqual(SOP, Buffer.from('^'))){
      throw new Error(`Not Matching SOP\n expect: ${this.SOP}\t res: ${SOP}`);
    }

    // check Length (SOP, CODE, ADDRESS 제외)
    let dialing = bufData.slice(_.sum([
      this.HEADER_INFO.BYTE.SOP,
      this.HEADER_INFO.BYTE.CODE
    ]), _.subtract(bufData.length, this.HEADER_INFO.BYTE.CMD));

    // 국번 일치 여부 체크(다르다면 응답하지 않음)
    if(!_.isEqual(dialing, this.dialing)){
      return;
    }

    let cmd = bufData.slice(_.sum([
      this.HEADER_INFO.BYTE.SOP,
      this.HEADER_INFO.BYTE.CODE,
      this.HEADER_INFO.BYTE.ID
    ]));

    // 모델 데이터 변화
    this.reload();
    switch (cmd.toString()) {
    case 'MOD':
      return this.makeSystem();
    case 'ST1':
      return this.makePv();
    case 'ST2':
      return this.makeGridVol();
    case 'ST3':
      return this.makeGridAmp();
    case 'ST4':
      return this.makePower();
    case 'ST6':
      return this.makeOperation();
    default:
      break;
    }
  }

}
module.exports = EchoServer;

// if __main process
if (require !== undefined && require.main === module) {
  console.log('__main__');

  const echoServer = new EchoServer({deviceId:'001', subCategory: 'das_1.3', option: true});

  echoServer.reload();
  let msg = echoServer.makeSystem();
  BU.CLI(msg.toString());

  msg = echoServer.makePv();
  BU.CLI(msg.toString());


  msg = echoServer.makeGridVol();
  BU.CLI(msg.toString());


  msg = echoServer.makeGridAmp();
  BU.CLI(msg.toString());


  msg = echoServer.makePower();
  BU.CLI(msg.toString());


  msg = echoServer.makeOperation();
  BU.CLI(msg.toString());



}