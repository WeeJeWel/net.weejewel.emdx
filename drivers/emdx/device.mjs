import Homey from 'homey';

import { Device as MDCDevice } from '@weejewel/samsung-mdc';
import express from 'express';
import getPort from 'get-port';
import { v4 as uuidv4 } from 'uuid';

export default class EMDXDevice extends Homey.Device {

  async showImage(image) {
    // Download the image stream to a buffer
    const imageStream = await image.getStream();
    const imageContentType = imageStream.contentType;
    const imageBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      imageStream.on('data', chunk => chunks.push(chunk));
      imageStream.on('end', () => resolve(Buffer.concat(chunks)));
      imageStream.on('error', reject);
    });

    // Get Homey IP
    const homeyLocalAddress = await this.homey.cloud.getLocalAddress();
    const [homeyLocalIp] = homeyLocalAddress.split(':');

    // Get a free port
    const port = await getPort({
      port: 3000,
    });

    // Calculate file name
    const fileId = uuidv4().toUpperCase();
    const fileSize = imageBuffer.length;
    const fileExtension = (() => {
      switch (imageContentType) {
        case 'image/png':
          return 'png';
        case 'image/jpg':
        case 'image/jpeg':
          return 'jpg';
        case 'image/gif':
          return 'gif';
        case 'image/webp':
          return 'webp';
        default:
          throw new Error(`Unsupported image type: ${imageContentType}`);
      };
    })();
    const fileName = `${fileId}.${fileExtension}`;

    // Start a webserver
    const server = await new Promise((resolve, reject) => {
      const server = express()
        .get('/content.json', (req, res) => {
          this.log('🔄 Serving /content.json...');

          res.header('Content-Type', 'application/json');
          res.send(JSON.stringify({
            schedule: [
              {
                start_date: '1970-01-01',
                stop_date: '2999-12-31',
                start_time: '00:00:00',
                contents: [
                  {
                    image_url: `http://${homeyLocalIp}:${port}/image`,
                    file_id: fileId,
                    file_path: `/home/owner/content/Downloads/vxtplayer/epaper/mobile/contents/${fileId}/${fileName}`,
                    duration: 91326, // TODO ?
                    file_size: `${fileSize}`,
                    file_name: `${fileName}`,
                  },
                ],
              },
            ],
            name: 'Homey Pro',
            version: 1,
            create_time: '2025-01-01 00:00:00',
            id: fileId,
            program_id: 'com.samsung.ios.ePaper',
            content_type: 'ImageContent',
            deploy_type: 'MOBILE'
          }).replaceAll('/', '\\/'));

          req.once('close', () => {
            this.log('✅ Served /content.json');
          });
        })
        .get(`/image`, (req, res) => {
          this.log(`🔄 Serving /image...`);

          res.header('Content-Type', imageContentType);
          res.send(imageBuffer);

          req.once('close', () => {
            this.log(`✅ Served /image`);

            server.close();
            this.log(`✅ Closed Webserver`);
          });
        })
        .listen(port, err => {
          if (err) return reject(err);
          return resolve(server);
        });
    });

    this.log(`✅ HTTP server listening at http://${homeyLocalIp}:${port}`);

    // Connect to the MDC Device
    const {
      ip,
      pin,
    } = this.getSettings();

    const {
      mac,
    } = this.getData();

    const device = new MDCDevice({
      mac,
      pin,
      host: ip,
    });

    await device.wakeup();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const url = `http://${homeyLocalIp}:${port}/content.json`;
    this.log(`🔄 Setting content to ${url}...`);
    await device.setContentDownload({ url });
    this.log(`✅ Set content to ${url}`);
    await device.disconnect();
    this.log(`✅ Disconnected`);
  }

};
