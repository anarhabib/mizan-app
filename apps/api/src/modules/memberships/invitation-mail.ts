import { createTransport } from "nodemailer";

export function createInvitationSender(env: NodeJS.ProcessEnv) {
  const sender = env.MIZAN_INVITATION_FROM;
  const smtp = env.MIZAN_SMTP_URL ? new URL(env.MIZAN_SMTP_URL) : undefined;
  const web = new URL(env.MIZAN_WEB_ORIGIN ?? "http://127.0.0.1:3000");
  const local =
    smtp && ["127.0.0.1", "localhost", "[::1]"].includes(smtp.hostname);
  if (smtp && !["smtp:", "smtps:"].includes(smtp.protocol))
    throw new Error("Invalid MIZAN_SMTP_URL protocol");
  if (!["http:", "https:"].includes(web.protocol))
    throw new Error("Invalid MIZAN_WEB_ORIGIN protocol");
  const transport = smtp
    ? createTransport({
        host: smtp.hostname.replace(/^\[|\]$/g, ""),
        port: Number(smtp.port || (smtp.protocol === "smtps:" ? 465 : 587)),
        secure: smtp.protocol === "smtps:",
        requireTLS: !local && smtp.protocol !== "smtps:",
        auth: smtp.username
          ? {
              user: decodeURIComponent(smtp.username),
              pass: decodeURIComponent(smtp.password),
            }
          : undefined,
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 5000,
      })
    : undefined;
  return async (email: string, token: string) => {
    if (!transport || !sender)
      throw new Error("Invitation email is not configured");
    const link = new URL(`/invitations/${token}`, web);
    const result = await transport.sendMail({
      from: sender,
      to: { address: email, name: "" },
      subject: "Mizan — Mağaza dəvəti / Store invitation",
      text: `Mağazaya qoşulmaq üçün bu keçidi açın. Dəvət 48 saat etibarlıdır.\nOpen this link to join your store. The invitation is valid for 48 hours.\n\n${link.href}`,
    });
    if (!result.accepted.length)
      throw new Error("Invitation email was rejected");
  };
}
