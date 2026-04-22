import { NextRequest, NextResponse } from 'next/server';
import * as dgram from 'dgram';

/**
 * API Route to configure an Art-Net node's network settings (ArtIpProg).
 */
export async function POST(req: NextRequest) {
  try {
    const { targetIp, newIp, newSubnet, useDhcp } = await req.json();

    if (!targetIp || !newIp || !newSubnet) {
      return NextResponse.json({ error: 'Target IP, New IP, and New Subnet are required' }, { status: 400 });
    }

    const client = dgram.createSocket('udp4');
    
    // Command bitmask: bit 7 (Execute), bit 6 (DHCP), bit 2 (Program IP), bit 1 (Program Subnet)
    let command = 0x80; // Execute
    if (useDhcp) command |= 0x40; // DHCP
    command |= 0x04; // Program IP
    command |= 0x02; // Program Subnet

    // IP bytes
    const ipBytes = newIp.split('.').map((b: string) => parseInt(b));
    const subnetBytes = newSubnet.split('.').map((b: string) => parseInt(b));

    const packet = Buffer.alloc(32);
    packet.write('Art-Net\0', 0);
    packet.writeUInt16LE(0xf800, 8); // OpIpProg
    packet.writeUInt16BE(14, 10);     // ProtVer
    packet.writeUInt16BE(0, 12);      // Filler
    packet.writeUInt8(command, 14);   // Command
    packet.writeUInt8(0, 15);         // Filler
    
    // New IP
    packet.writeUInt8(ipBytes[0], 16);
    packet.writeUInt8(ipBytes[1], 17);
    packet.writeUInt8(ipBytes[2], 18);
    packet.writeUInt8(ipBytes[3], 19);

    // New Subnet
    packet.writeUInt8(subnetBytes[0], 20);
    packet.writeUInt8(subnetBytes[1], 21);
    packet.writeUInt8(subnetBytes[2], 22);
    packet.writeUInt8(subnetBytes[3], 23);

    // Default port 6454 (0x1936)
    packet.writeUInt16BE(6454, 24);

    return new Promise<NextResponse>((resolve) => {
      client.send(packet, 6454, targetIp, (err) => {
        client.close();
        if (err) {
          resolve(NextResponse.json({ error: `ArtIpProg failed: ${err.message}` }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ success: true, message: `Configuration packet sent to ${targetIp}` }));
        }
      });
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
