import { createSocket } from 'node:dgram';

/**
 * 获取本机在局域网中的实际 IP 地址。
 * 通过 UDP connect 让系统选择默认出口网卡，不会真正发送数据包。
 */
export function getLocalIp(): Promise<string> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');

    const finish = (ip: string): void => {
      socket.removeAllListeners();
      socket.close();
      resolve(ip);
    };

    socket.once('error', () => finish('localhost'));

    try {
      socket.connect(80, '8.8.8.8', () => {
        const address = socket.address();
        finish(address.address || 'localhost');
      });
    } catch {
      finish('localhost');
    }
  });
}
