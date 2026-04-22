import { NextRequest, NextResponse } from 'next/server';
import * as net from 'net';

/**
 * API Route to send Telnet commands to a grandMA2 console.
 *grandMA2 Telnet uses port 30000 by default.
 */
export async function POST(req: NextRequest) {
  try {
    const { ip, command } = await req.json();

    if (!ip || !command) {
      return NextResponse.json({ error: 'IP and Command are required' }, { status: 400 });
    }

    // Default port for grandMA2 Telnet
    const PORT = 30000;
    const TIMEOUT = 3000; // 3 seconds timeout

    return new Promise<NextResponse>((resolve) => {
      const client = new net.Socket();

      client.setTimeout(TIMEOUT);

      client.connect(PORT, ip, () => {
        // MA2 syntax requires \r\n
        client.write(`${command}\r\n`);
        
        // Give it a tiny bit of time to ensure it's sent
        setTimeout(() => {
          client.destroy();
          resolve(NextResponse.json({ success: true, message: `Command "${command}" sent to ${ip}` }));
        }, 100);
      });

      client.on('error', (err: any) => {
        console.error('TCP Socket Error:', err);
        client.destroy();
        
        let userMessage = err.message;
        let details = 'Ensure your console has "Remote Login" enabled and is reachable from this server.';
        
        if (err.code === 'ECONNREFUSED') {
          userMessage = `Connection Refused at ${ip}:${PORT}`;
          details = 'The target console rejected the connection. Verify the IP address is correct, the MA2/onPC software is running, and "Remote Login" is enabled in Setup > Global Settings.';
          if (ip === '127.0.0.1' || ip === 'localhost') {
            details += ' IMPORTANT: "127.0.0.1" refers to this server, not your local computer. Use your console\'s actual network IP address.';
          }
        }

        resolve(NextResponse.json({ 
          error: userMessage,
          details: details 
        }, { status: 502 }));
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(NextResponse.json({ 
          error: `Connection to ${ip} timed out.`,
          details: 'Verify the IP address and ensure port 30000 is open.' 
        }, { status: 504 }));
      });
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
