import net from 'node:net';
import Homey from 'homey';
import { Device as MDCDevice } from '@weejewel/samsung-mdc';

export default class EMDXDriver extends Homey.Driver {

  async onInit() {
    this.homey.flow.getActionCard('show-image').registerRunListener(async ({ device, droptoken }) => {
      await device.showImage(droptoken);
    });
  }

  async onPair(session) {
    const device = {};
    let ipAddress = null;
    let macAddress = null;
    let pincode = null;
    let name;

    session.setHandler('login', async ({ username, password }) => {
      macAddress = username;
      ipAddress = password;

      // Test if the MAC address is valid
      const macRegex = /^[0-9A-Fa-f]{2}([-:][0-9A-Fa-f]{2}){5}$/;
      if (!macRegex.test(macAddress)) {
        throw new Error('Invalid MAC Address');
      }

      // Test if the IP address is valid
      if (!net.isIPv4(ipAddress)) {
        throw new Error('Invalid IP Address');
      }

      // Wake up the device
      const device = new MDCDevice({
        host: ipAddress,
        mac: macAddress,
      });

      await device.wakeup();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Ping the device to check if it's reachable
      // TODO

      return true;
    });

    session.setHandler('pincode', async (pincodeArray) => {
      pincode = pincodeArray.join('');

      this.log('Pincode:', pincode);
      this.log('MAC Address:', macAddress);
      this.log('IP Address:', ipAddress);

      const device = new MDCDevice({
        host: ipAddress,
        mac: macAddress,
        pin: pincode,
      });

      this.log('Waking up device...');
      await device.wakeup();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.log('Connecting to device...');
      await device.connect();

      this.log('Getting device info...');
      name = await device.getDeviceName();
      this.log('Device name:', name);

      this.log('Disconnecting from device...');
      await device.disconnect();

      return true;
    });

    session.setHandler('list_devices', async () => {
      return [{
        name,
        data: {
          id: macAddress,
        },
        settings: {
          ip: ipAddress,
          pin: pincode,
        },
      }];
    });
  }

};
