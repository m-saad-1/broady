#!/usr/bin/env node
/**
 * SES Configuration Diagnostic
 * Step-by-step verification of SES SMTP setup
 */

import net from 'node:net';
import tls from 'node:tls';

const CONFIG = {
  host: 'email-smtp.ap-south-1.amazonaws.com',
  port: 587,
  user: 'AKIA3TQ3WO5SMGCDASPB',
  pass: 'BDO6bDScov0vSZPU+tvcquBe8QuabjhX9X5yDwAg6i9a',
  from: 'msaad23305@gmail.com',
  fromName: 'Broady',
  to: 'msaad23305@gmail.com',
};

function log(msg, type = 'info') {
  const prefix = {
    info: '[ℹ]',
    success: '[✓]',
    error: '[✗]',
    debug: '[→]',
    recv: '[←]',
  }[type] || '[ ]';
  console.log(`${prefix} ${msg}`);
}

async function diagnose() {
  log('═══════════════════════════════════════════════════════════');
  log('SES SMTP Configuration Diagnostic', 'info');
  log('═══════════════════════════════════════════════════════════');
  console.log();

  // Show config
  log('Configuration:', 'info');
  log(`  Host: ${CONFIG.host}`, 'info');
  log(`  Port: ${CONFIG.port}`, 'info');
  log(`  User: ${CONFIG.user}`, 'info');
  log(`  Pass: ${CONFIG.pass.substring(0, 20)}...`, 'info');
  log(`  From: "${CONFIG.fromName}" <${CONFIG.from}>`, 'info');
  log(`  To: ${CONFIG.to}`, 'info');
  console.log();

  // Test basic connection
  log('Testing TCP connection...', 'debug');
  return new Promise((resolve) => {
    const socket = net.createConnection(
      { host: CONFIG.host, port: CONFIG.port, timeout: 10000 },
      () => {
        log('TCP connection established', 'success');
        
        let greeting = '';
        socket.once('data', (chunk) => {
          greeting = chunk.toString().trim();
          log(`Server greeting: ${greeting}`, 'recv');
          
          if (greeting.includes('220')) {
            log('✓ Server is ready', 'success');
            
            // Try STARTTLS
            log('Sending STARTTLS...', 'debug');
            socket.write('STARTTLS\r\n');
            
            let starttlsResponse = '';
            socket.once('data', (chunk) => {
              starttlsResponse = chunk.toString().trim();
              log(`STARTTLS response: ${starttlsResponse}`, 'recv');
              
              if (starttlsResponse.includes('220')) {
                log('✓ STARTTLS ready', 'success');
                
                // Upgrade to TLS
                log('Upgrading to TLS...', 'debug');
                try {
                  const tlsSocket = tls.connect(
                    {
                      socket: socket,
                      host: CONFIG.host,
                      rejectUnauthorized: false,
                    },
                    () => {
                      log('✓ TLS connection established', 'success');
                      
                      // Send AUTH LOGIN
                      log('Sending AUTH LOGIN...', 'debug');
                      tlsSocket.write('AUTH LOGIN\r\n');
                      
                      let authResponse = '';
                      tlsSocket.once('data', (chunk) => {
                        authResponse = chunk.toString().trim();
                        log(`AUTH response: ${authResponse}`, 'recv');
                        
                        if (authResponse.includes('334')) {
                          log('✓ Server requested username', 'success');
                          
                          // Encode username
                          const userB64 = Buffer.from(CONFIG.user).toString('base64');
                          log(`Sending username (base64): ${userB64}`, 'debug');
                          tlsSocket.write(userB64 + '\r\n');
                          
                          let userResponse = '';
                          tlsSocket.once('data', (chunk) => {
                            userResponse = chunk.toString().trim();
                            log(`Username response: ${userResponse}`, 'recv');
                            
                            if (userResponse.includes('334')) {
                              log('✓ Server requested password', 'success');
                              
                              // Encode password
                              const passB64 = Buffer.from(CONFIG.pass).toString('base64');
                              log(`Sending password (base64): ${passB64.substring(0, 20)}...`, 'debug');
                              tlsSocket.write(passB64 + '\r\n');
                              
                              let passResponse = '';
                              tlsSocket.once('data', (chunk) => {
                                passResponse = chunk.toString().trim();
                                log(`Password response: ${passResponse}`, 'recv');
                                
                                if (passResponse.includes('235')) {
                                  log('✓✓✓ AUTHENTICATION SUCCESSFUL ✓✓✓', 'success');
                                  console.log();
                                  log('═══════════════════════════════════════════════════════════');
                                  log('Result: ✓ SES credentials are VALID and working!', 'success');
                                  log('═══════════════════════════════════════════════════════════');
                                  tlsSocket.write('QUIT\r\n');
                                  tlsSocket.end();
                                  resolve(true);
                                } else if (passResponse.includes('535')) {
                                  log('✗✗✗ Authentication FAILED ✗✗✗', 'error');
                                  log('The credentials are incorrect or invalid', 'error');
                                  tlsSocket.end();
                                  resolve(false);
                                } else {
                                  log('Unexpected response', 'error');
                                  tlsSocket.end();
                                  resolve(false);
                                }
                              });
                            } else {
                              log('✗ Server did not request password', 'error');
                              tlsSocket.end();
                              resolve(false);
                            }
                          });
                        } else {
                          log('✗ AUTH LOGIN failed', 'error');
                          tlsSocket.end();
                          resolve(false);
                        }
                      });
                    }
                  );
                  
                  tlsSocket.on('error', (err) => {
                    log(`TLS Error: ${err.message}`, 'error');
                    resolve(false);
                  });
                } catch (err) {
                  log(`TLS Error: ${err.message}`, 'error');
                  resolve(false);
                }
              } else {
                log('✗ STARTTLS failed', 'error');
                socket.end();
                resolve(false);
              }
            });
          } else {
            log('✗ Unexpected server response', 'error');
            socket.end();
            resolve(false);
          }
        });
        
        socket.on('error', (err) => {
          log(`Socket error: ${err.message}`, 'error');
          resolve(false);
        });
      }
    );
    
    socket.on('error', (err) => {
      log(`Connection error: ${err.message}`, 'error');
      resolve(false);
    });
  });
}

diagnose().then((success) => {
  console.log();
  process.exit(success ? 0 : 1);
});
