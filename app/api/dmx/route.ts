import { NextRequest, NextResponse } from 'next/server';
import * as dgram from 'dgram';

/**
 * API Route to send Art-Net (DMX over IP) packets to a node.
 * Art-Net uses UDP port 6454.
 */
export async function POST(req: NextRequest) {
  try {
    const { ip, channels, net, subnet, universe } = await req.json(); 

    if (!ip || !channels || !Array.isArray(channels)) {
      return NextResponse.json({ error: 'IP and channels array are required' }, { status: 400 });
    }

    const client = dgram.createSocket('udp4');
    
    // Art-Net Header: "Art-Net" + \0 + OpCode (0x5000 for ArtDmx) + Protocol Version (14)
    // net: 0-127, subnet: 0-15, universe: 0-15
    const n = net || 0;
    const s = subnet || 0;
    const u = universe || 0;

    const header = Buffer.from([
      0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // ID: Art-Net
      0x00, 0x50, // OpCode: ArtDmx
      0x00, 0x0e, // ProtVer: 14
      0x00,       // Sequence
      0x00,       // Physical
      (s << 4) | u, // SubUni (Subnet 4 bits, Universe 4 bits)
      n & 0x7f,     // Net (7 bits)
      0x02, 0x00    // Length: 512
    ]);

    // Data buffer
    const data = Buffer.from(channels.slice(0, 512));
    const packet = Buffer.concat([header, data]);

    return new Promise<NextResponse>((resolve) => {
      client.send(packet, 6454, ip, (err) => {
        client.close();
        if (err) {
          resolve(NextResponse.json({ error: `UDP send failed: ${err.message}` }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ success: true, message: `Art-Net packet sent to ${ip}` }));
        }
      });
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
