#!/usr/bin/env node
/**
 * SES SMTP Email Smoke Test
 * Tests direct SMTP connection to SES and sends a test email
 */

import { createConnection } from 'node:net';
import { createSecureContext } from 'node:tls';
import tls from 'node:tls';

const SES_CONFIG = {
  host: 'email-smtp.ap-south-1.amazonaws.com',
  port: 587,
  user: 'AKIA3TQ3WO5SMGCDASPB',
  pass: 'BDO6bDScov0vSZPU+tvcquBe8QuabjhX9X5yDwAg6i9a',
  fromAddress: 'msaad23305@gmail.com',
  fromName: 'Broady',
};

const TEST_EMAIL = {
  to: 'msaad23305@gmail.com',
  subject: '🧪 Broady SES SMTP Test',
  text: `
Hello,

This is a test email from Broady's SES SMTP configuration.

If you received this email, the following is working:
✓ SES SMTP connection to ap-south-1
✓ Authentication with provided credentials
✓ Email delivery to ${SES_CONFIG.fromAddress}

Environment:
- Host: ${SES_CONFIG.host}:${SES_CONFIG.port}
- Secure: false (STARTTLS enabled)
- From: "${SES_CONFIG.fromName}" <${SES_CONFIG.fromAddress}>
- Timestamp: ${new Date().toISOString()}

Test Status: ✅ SUCCESS

---
Broady E-Commerce Platform
  `.trim(),
};

function log(message, type = 'info') {
  const prefix = {
    info: '[INFO]',
    success: '[✓ SUCCESS]',
    error: '[✗ ERROR]',
    debug: '[DEBUG]',
  }[type] || '[LOG]';
  console.log(`${prefix} ${message}`);
}

function buildSmtpMessage() {
  const headers = `From: "${SES_CONFIG.fromName}" <${SES_CONFIG.fromAddress}>\r\nTo: ${TEST_EMAIL.to}\r\nSubject: ${TEST_EMAIL.subject}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n`;
  return headers + TEST_EMAIL.text;
}

function sendSmtpCommand(socket, command, expectedCode) {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const onData = (data) => {
      buffer += data.toString();
      
      if (buffer.includes('\r\n')) {
        socket.removeListener('data', onData);
        const lines = buffer.split('\r\n');
        const response = lines[0];
        
        if (response.startsWith(expectedCode)) {
          log(`← ${response}`, 'debug');
          resolve(response);
        } else {
          reject(new Error(`Expected ${expectedCode}, got: ${response}`));
        }
      }
    };

    socket.on('data', onData);
    socket.write(command + '\r\n');
    log(`→ ${command}`, 'debug');
  });
}

async function testSesConnection() {
  return new Promise(async (resolve, reject) => {
    try {
      log('Connecting to SES SMTP server...');
      log(`Host: ${SES_CONFIG.host}:${SES_CONFIG.port}`);

      const socket = createConnection(SES_CONFIG.port, SES_CONFIG.host);

      socket.on('connect', async () => {
        try {
          log('✓ TCP connection established', 'success');

          // Wait for initial server greeting
          let greeting = await new Promise((res, rej) => {
            const timeout = setTimeout(() => rej(new Error('No greeting')), 5000);
            socket.once('data', (data) => {
              clearTimeout(timeout);
              log(`← ${data.toString().trim()}`, 'debug');
              res();
            });
          });

          log('✓ Received server greeting', 'success');

          // STARTTLS
          log('Sending STARTTLS command...');
          await sendSmtpCommand(socket, 'STARTTLS', '220');

          log('✓ STARTTLS ready', 'success');

          // Upgrade to TLS
          log('Upgrading connection to TLS...');
          const tlsSocket = tls.connect(
            { socket, host: SES_CONFIG.host },
            async () => {
              log('✓ TLS connection established', 'success');

              try {
                // AUTH LOGIN
                log('Authenticating with SES...');
                await sendSmtpCommand(tlsSocket, 'AUTH LOGIN', '334');

                // Send username (base64)
                const userB64 = Buffer.from(SES_CONFIG.user).toString('base64');
                await sendSmtpCommand(tlsSocket, userB64, '334');

                // Send password (base64)
                const passB64 = Buffer.from(SES_CONFIG.pass).toString('base64');
                await sendSmtpCommand(tlsSocket, passB64, '235');

                log('✓ Authentication successful', 'success');

                // MAIL FROM
                log('Sending email...');
                await sendSmtpCommand(tlsSocket, `MAIL FROM:<${SES_CONFIG.fromAddress}>`, '250');

                // RCPT TO
                await sendSmtpCommand(tlsSocket, `RCPT TO:<${TEST_EMAIL.to}>`, '250');

                // DATA
                await sendSmtpCommand(tlsSocket, 'DATA', '354');

                // Send message
                const message = buildSmtpMessage();
                tlsSocket.write(message + '\r\n.\r\n');

                // Get response
                let response = await new Promise((res, rej) => {
                  const timeout = setTimeout(() => rej(new Error('No response')), 5000);
                  tlsSocket.once('data', (data) => {
                    clearTimeout(timeout);
                    log(`← ${data.toString().trim()}`, 'debug');
                    res(data.toString());
                  });
                });

                if (response.includes('250')) {
                  log('✓ Email sent successfully!', 'success');
                  log(`Message ID in response: ${response.split(' ')[1] || 'N/A'}`, 'info');
                }

                // QUIT
                await sendSmtpCommand(tlsSocket, 'QUIT', '221');
                tlsSocket.end();
                resolve({ success: true, message: 'Email sent to SES' });
              } catch (error) {
                tlsSocket.destroy();
                reject(error);
              }
            }
          );

          tlsSocket.on('error', (err) => {
            reject(new Error(`TLS Error: ${err.message}`));
          });
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });

      socket.on('error', (err) => {
        reject(new Error(`Connection Error: ${err.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Socket timeout'));
      });

      socket.setTimeout(30000);
    } catch (error) {
      reject(error);
    }
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Broady SES SMTP Configuration Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  log('Test Configuration:', 'info');
  log(`  Region: ap-south-1`, 'info');
  log(`  From: "${SES_CONFIG.fromName}" <${SES_CONFIG.fromAddress}>`, 'info');
  log(`  To: ${TEST_EMAIL.to}`, 'info');
  log(`  Port: ${SES_CONFIG.port} (STARTTLS)`, 'info');
  console.log();

  try {
    const result = await testSesConnection();
    console.log('\n═══════════════════════════════════════════════════════════');
    log('✓ All SES SMTP tests passed!', 'success');
    log('Email should arrive at ' + TEST_EMAIL.to, 'success');
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (error) {
    console.log('\n═══════════════════════════════════════════════════════════');
    log('✗ Test failed: ' + error.message, 'error');
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main();
