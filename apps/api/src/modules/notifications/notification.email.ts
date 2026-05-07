import net from "node:net";
import tls from "node:tls";
import { env } from "../../config/env.js";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SmtpSocket = net.Socket | tls.TLSSocket;

function encodeHeader(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}

function dotStuff(value: string) {
  return value.replace(/^\./gm, "..");
}

function buildMessage(input: MailInput) {
  const contentType = input.html ? "text/html" : "text/plain";
  const body = input.html || input.text;
  const fromHeader = `${env.emailFromName} <${env.emailFromAddress}>`;

  return [
    `From: ${fromHeader}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}; charset=UTF-8`,
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
}

function waitForResponse(socket: SmtpSocket): Promise<{ code: number; message: string }> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const finalLine = lines.find((line) => /^\d{3}\s/.test(line));
      if (!finalLine) return;

      cleanup();
      resolve({
        code: Number(finalLine.slice(0, 3)),
        message: buffer,
      });
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(socket: SmtpSocket, command: string, expectedCodes: number[]) {
  socket.write(`${command}\r\n`);
  const response = await waitForResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.message.slice(0, 240)}`);
  }
  return response;
}

function connectSmtpSocket() {
  return new Promise<SmtpSocket>((resolve, reject) => {
    const options = {
      host: env.sesSmtpHost,
      port: env.sesSmtpPort,
      servername: env.sesSmtpHost,
    };
    const socket = env.sesSmtpSecure ? tls.connect(options) : net.connect(options);

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("secureConnect", onConnect);
      socket.off("error", onError);
    };

    socket.once(env.sesSmtpSecure ? "secureConnect" : "connect", onConnect);
    socket.once("error", onError);
  });
}

export async function sendSmtpEmail(input: MailInput) {
  if (!env.sesSmtpHost || !env.sesSmtpUser || !env.sesSmtpPass) {
    throw new Error("SES SMTP provider is not configured");
  }

  const socket = await connectSmtpSocket();

  try {
    const greeting = await waitForResponse(socket);
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed (${greeting.code}): ${greeting.message.slice(0, 240)}`);
    }

    await sendCommand(socket, `EHLO ${env.sesSmtpHost}`, [250]);

    if (env.sesSmtpUser && env.sesSmtpPass) {
      await sendCommand(socket, "AUTH LOGIN", [334]);
      await sendCommand(socket, Buffer.from(env.sesSmtpUser).toString("base64"), [334]);
      await sendCommand(socket, Buffer.from(env.sesSmtpPass).toString("base64"), [235]);
    }

    await sendCommand(socket, `MAIL FROM:<${env.emailFromAddress}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${input.to}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    await sendCommand(socket, `${dotStuff(buildMessage(input))}\r\n.`, [250]);
    await sendCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}
