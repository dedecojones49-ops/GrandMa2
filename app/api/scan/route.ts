import { NextRequest, NextResponse } from 'next/server';
import * as dgram from 'dgram';

/**
 * API Route to scan local network for Art-Net nodes using ArtPoll.
 * Sends an ArtPoll packet to the broadcast address and waits for replies.
 */
export async function GET(req: NextRequest) {
  try {
    const client = dgram.createSocket('udp4');
    const nodes: { ip: string, name: string }[] = [];

    // ArtPoll Packet: 
    // ID: "Art-Net" (8 bytes), OpCode: ArtPoll (0x2000), ProtVer: 14, TalkToMe: 0 (or bitmask), Priority: 0
    const artPoll = Buffer.from([
      0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // ID
      0x00, 0x20, // OpCode: ArtPoll 0x2000
      0x00, 0x0e, // ProtVer: 14
      0x00,       // TalkToMe
      0x00        // Priority
    ]);

    client.on('error', (err) => {
      console.error('UDP Scan Error:', err);
    });

    client.on('message', (msg, rinfo) => {
      // OpCode check for ArtPollReply (0x2100)
      if (msg.length >= 12 && msg.toString('utf8', 0, 7) === 'Art-Net' && msg[8] === 0x00 && msg[9] === 0x21) {
        // Simple extraction of ShortName (offset 26, 18 bytes) or just IP
        const shortName = msg.toString('utf8', 26, 44).replace(/\0/g, '').trim();
        if (!nodes.find(n => n.ip === rinfo.address)) {
          nodes.push({ ip: rinfo.address, name: shortName || 'Art-Net Node' });
        }
      }
    });

    client.bind(0, () => {
      client.setBroadcast(true);
      // Broadcast to standard Art-Net broadcast addresses (limited in cloud environment but valid synth)
      client.send(artPoll, 6454, '255.255.255.255');
      // Also try 2.255.255.255 and 10.255.255.255 (Art-Net standard subnets)
      client.send(artPoll, 6454, '2.255.255.255');
      client.send(artPoll, 6454, '10.255.255.255');
    });

    // Wait for replies
    await new Promise(resolve => setTimeout(resolve, 2000));
    client.close();

    return NextResponse.json({ nodes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
