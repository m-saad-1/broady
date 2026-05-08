#!/usr/bin/env node
/**
 * SES SMTP Quick Test
 * Simple connection test with improved error handling
 */

import net from 'node:net';
import tls from 'node:tls';

const CONFIG = {
  host: 'email-smtp.ap-south-1.amazonaws.com',
  port: 587,
  user: 'AKIA3TQ3WO5SMGCDASPB',
  pass: 'BDO6bDScov0vSZPU+tvcquBe8QuabjhX9X5yDwAg6i9a',
};

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Response timeout')), 5000);
    let data = '';
    
    const handler = (chunk) => {
      clearTimeout(timeout);
      data += chunk.toString();
      if (data.includes('\r\n')) {
        socket.removeListener('data', handler);
        resolve(data.trim());
      }
    };
    
    socket.on('data', handler);
  });
}

async function test() {
  console.log('\n🔍 SES SMTP Connection Test\n');
  console.log(`Host: ${CONFIG.host}:${CONFIG.port}`);
  console.log(`User: ${CONFIG.user}`);
  console.log(`Pass: ${CONFIG.pass.substring(0, 20)}...`);
  console.log();

  try {
    console.log('1️⃣  Connecting to SMTP server...');
    const socket = net.createConnection({
      host: CONFIG.host,
      port: CONFIG.port,
      timeout: 15000,
    });

    const greeting = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      socket.on('connect', async () => {
        console.log('   ✓ TCP connection established\n');
        clearTimeout(timeout);
      });

      socket.on('data', (chunk) => {
        clearTimeout(timeout);
        const response = chunk.toString().trim();
        console.log(`   Response: ${response}\n`);
        resolve(response);
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      socket.on('close', () => {
        clearTimeout(timeout);
        reject(new Error('Connection closed prematurely'));
      });
    });

    if (!greeting.includes('220')) {
      throw new Error(`Unexpected greeting: ${greeting}`);
    }

    console.log('2️⃣  Sending STARTTLS...');
    socket.write('STARTTLS\r\n');
    const starttlsResp = await readResponse(socket);
    console.log(`   Response: ${starttlsResp}\n`);

    if (!starttlsResp.includes('220')) {
      throw new Error(`STARTTLS failed: ${starttlsResp}`);
    }

    console.log('3️⃣  Upgrading to TLS...');
    const tlsSocket = tls.connect(
      {
        socket,
        host: CONFIG.host,
        rejectUnauthorized: false,
      },
      () => {
        console.log('   ✓ TLS upgrade successful\n');
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('4️⃣  Authenticating...');
    tlsSocket.write('AUTH LOGIN\r\n');
    const authResp = await readResponse(tlsSocket);
    console.log(`   Response: ${authResp}`);

    if (!authResp.includes('334')) {
      throw new Error(`AUTH LOGIN failed: ${authResp}`);
    }

    const userB64 = Buffer.from(CONFIG.user).toString('base64');
    tlsSocket.write(userB64 + '\r\n');
    const userResp = await readResponse(tlsSocket);
    console.log(`   Response: ${userResp}`);

    if (!userResp.includes('334')) {
      throw new Error(`Username rejected: ${userResp}`);
    }

    const passB64 = Buffer.from(CONFIG.pass).toString('base64');
    tlsSocket.write(passB64 + '\r\n');
    const passResp = await readResponse(tlsSocket);
    console.log(`   Response: ${passResp}\n`);

    if (passResp.includes('235')) {
      console.log('✅ ✅ ✅ AUTHENTICATION SUCCESSFUL ✅ ✅ ✅\n');
      console.log('✓ Credentials are valid');
      console.log('✓ SES SMTP is configured correctly');
      console.log('✓ Email delivery is ready\n');
      tlsSocket.write('QUIT\r\n');
      tlsSocket.end();
      process.exit(0);
    } else if (passResp.includes('535')) {
      throw new Error('Authentication failed: Invalid credentials');
    } else {
      throw new Error(`Unexpected response: ${passResp}`);
    }
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

test();
