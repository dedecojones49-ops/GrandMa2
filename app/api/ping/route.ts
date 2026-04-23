import { NextRequest, NextResponse } from 'next/server';
import * as net from 'net';

export async function POST(req: NextRequest) {
  try {
    const { ip, port = 30000 } = await req.json();

    if (!ip) {
      return NextResponse.json({ error: 'IP is required' }, { status: 400 });
    }

    const TIMEOUT = 2000;

    return new Promise<NextResponse>((resolve) => {
      const client = new net.Socket();
      client.setTimeout(TIMEOUT);

      const startTime = Date.now();

      client.connect(port, ip, () => {
        const latency = Date.now() - startTime;
        client.destroy();
        resolve(NextResponse.json({ 
          success: true, 
          latency,
          message: `Successfully connected to ${ip}:${port}` 
        }));
      });

      client.on('error', (err: any) => {
        client.destroy();
        resolve(NextResponse.json({ 
          success: false, 
          error: err.message,
          code: err.code,
          details: 'GrandMA2 "Remote Login" must be enabled in Setup > Global Settings.'
        }, { status: 502 }));
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(NextResponse.json({ 
          success: false, 
          error: 'Connection timed out',
          details: 'The console did not respond within 2 seconds. Check your network or firewall.'
        }, { status: 504 }));
      });
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
